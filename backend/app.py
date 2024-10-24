from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import logging
from llama_parse import LlamaParse
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext, load_index_from_storage
from llama_index.core.chat_engine import CondenseQuestionChatEngine
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.llms import ChatMessage, MessageRole
from dotenv import load_dotenv
import traceback
import fitz  # PyMuPDF
import io
from transformers import pipeline
import torch
import spacy
from keybert import KeyBERT
from sklearn.feature_extraction.text import TfidfVectorizer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Define constants for folder paths
PDFS_FOLDER = "pdfs"
CACHE_FOLDER = "cache"
CUSTOM_IMAGES_FOLDER = "custom_images"
ANALYSIS_CACHE_FOLDER = "analysis_cache"

# Create necessary directories
for folder in [PDFS_FOLDER, CACHE_FOLDER, CUSTOM_IMAGES_FOLDER, ANALYSIS_CACHE_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Initialize NLP models
try:
    nlp = spacy.load("en_core_web_sm")
except:
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")

# Initialize AI models with GPU support if available
device = 0 if torch.cuda.is_available() else -1
keybert_model = KeyBERT()

class LlamaParser:
    def __init__(self):
        """Initialize the parser with necessary models and tools"""
        self.pdfs_folder = PDFS_FOLDER
        self.cache_folder = CACHE_FOLDER
        self.indexes = {}
        self.tfidf = TfidfVectorizer(stop_words='english')

    def parse_and_embed_pdf(self, file_name):
        """Parse and embed PDF content for vector search"""
        cache_path = os.path.join(self.cache_folder, f"{file_name}.json")
        logger.debug(f"Attempting to parse PDF: {file_name}")
        logger.debug(f"Cache path: {cache_path}")
        
        try:
            if os.path.exists(cache_path):
                logger.debug("Loading from cache...")
                storage_context = StorageContext.from_defaults(persist_dir=cache_path)
                index = load_index_from_storage(storage_context)
            else:
                logger.debug("Creating new index...")
                parser = LlamaParse(result_type="markdown")
                file_path = os.path.join(self.pdfs_folder, file_name)
                documents = SimpleDirectoryReader(
                    input_files=[file_path], 
                    file_extractor={".pdf": parser}
                ).load_data()
                index = VectorStoreIndex.from_documents(documents)
                index.storage_context.persist(persist_dir=cache_path)
            
            self.indexes[file_name] = index
            return index
        except Exception as e:
            logger.error(f"Error parsing PDF: {str(e)}")
            raise

    def extract_key_topics(self, text, num_topics=5):
        """Extract main topics from text using KeyBERT"""
        try:
            keywords = keybert_model.extract_keywords(
                text,
                keyphrase_ngram_range=(1, 2),
                stop_words='english',
                use_maxsum=True,
                nr_candidates=20,
                top_n=num_topics
            )
            return [keyword for keyword, _ in keywords]
        except Exception as e:
            logger.error(f"Error extracting topics: {str(e)}")
            return []

    def extract_named_entities(self, text):
        """Extract and categorize named entities from text"""
        try:
            doc = nlp(text)
            entities = {}
            for ent in doc.ents:
                if ent.label_ not in entities:
                    entities[ent.label_] = []
                if ent.text not in entities[ent.label_]:  # Avoid duplicates
                    entities[ent.label_].append(ent.text)
            return entities
        except Exception as e:
            logger.error(f"Error extracting entities: {str(e)}")
            return {}

    def analyze_readability(self, text):
        """Analyze text readability using various metrics"""
        try:
            doc = nlp(text)
            
            words = len([token for token in doc if not token.is_punct])
            sentences = len(list(doc.sents))
            syllables = sum([len([y for y in x if y.lower() in 'aeiou']) 
                           for x in [token.text for token in doc]])
            
            if sentences > 0:
                flesch = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
            else:
                flesch = 0
                
            return {
                "flesch_score": round(flesch, 2),
                "avg_sentence_length": round(words/sentences if sentences > 0 else 0, 2),
                "total_words": words,
                "total_sentences": sentences
            }
        except Exception as e:
            logger.error(f"Error analyzing readability: {str(e)}")
            return {}

    def get_pdf_text(self, file_name):
        """Extract raw text from PDF file"""
        try:
            file_path = os.path.join(self.pdfs_folder, file_name)
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            return text
        except Exception as e:
            logger.error(f"Error extracting PDF text: {str(e)}")
            return ""

    def query_pdf(self, file_name, query, chat_history, is_new_conversation):
        """Query the PDF using LlamaIndex"""
        logger.debug(f"Querying PDF: {file_name}")
        logger.debug(f"Query: {query}")
        logger.debug(f"Chat history: {chat_history}")
        
        if file_name not in self.indexes:
            self.parse_and_embed_pdf(file_name)
        
        memory = ChatMemoryBuffer.from_defaults(token_limit=1500)
        
        if not is_new_conversation:
            for message in chat_history[-4:]:  # Only use last 2 exchanges
                role = MessageRole.USER if message['role'] == 'human' else MessageRole.ASSISTANT
                memory.put(ChatMessage(role=role, content=message['content']))
        
        chat_engine = CondenseQuestionChatEngine.from_defaults(
            query_engine=self.indexes[file_name].as_query_engine(),
            memory=memory,
            verbose=True
        )
        
        response = chat_engine.chat(query)
        logger.debug(f"Response: {response}")
        return str(response)

# Initialize parser
parser = LlamaParser()

@app.route('/', methods=['GET'])
def test_route():
    return jsonify({"status": "Server is running"}), 200

@app.route('/api/pdf-files', methods=['GET'])
def api_get_pdf_files():
    try:
        pdf_dir = os.path.abspath(PDFS_FOLDER)
        logger.debug(f"Looking for PDFs in: {pdf_dir}")
        
        if not os.path.exists(pdf_dir):
            logger.error(f"PDF directory not found: {pdf_dir}")
            return jsonify({'error': 'PDF directory not found', 'pdf_files': []}), 404
        
        pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
        logger.debug(f"Found PDF files: {pdf_files}")
        
        return jsonify({'pdf_files': pdf_files})
    except Exception as e:
        logger.error(f"Error listing PDF files: {str(e)}")
        return jsonify({'error': str(e), 'pdf_files': []}), 500

@app.route('/api/query', methods=['POST'])
def api_query():
    data = request.json
    logger.debug(f"Received query request: {data}")

    query = data.get('query')
    pdf_name = data.get('pdf_name')
    conversation_history = data.get('conversation_history', [])
    is_new_conversation = data.get('is_new_conversation', False)
    
    if not query or not pdf_name:
        return jsonify({'error': 'Query and PDF name are required'}), 400

    try:
        response = parser.query_pdf(pdf_name, query, conversation_history, is_new_conversation)
        return jsonify({'query': query, 'response': response})
    except Exception as e:
        logger.error(f"Query error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
def api_analyze():
    """Endpoint for analyzing PDF content"""
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.json
        pdf_name = data.get('pdf_name')
        analysis_type = data.get('analysis_type')
        
        if not pdf_name or not analysis_type:
            return jsonify({'error': 'PDF name and analysis type are required'}), 400

        logger.debug(f"Analyzing PDF: {pdf_name}, Type: {analysis_type}")
        
        # Get text from PDF
        text = parser.get_pdf_text(pdf_name)
        
        if analysis_type == 'topics':
            topics = parser.extract_key_topics(text)
            return jsonify({'topics': topics})
            
        elif analysis_type == 'entities':
            entities = parser.extract_named_entities(text)
            return jsonify({'entities': entities})
            
        elif analysis_type == 'readability':
            readability = parser.analyze_readability(text)
            return jsonify({'readability': readability})
            
        else:
            return jsonify({'error': 'Invalid analysis type'}), 400
            
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-pdf', methods=['GET'])
def get_pdf():
    pdf_name = request.args.get('pdf_name')
    if not pdf_name:
        return jsonify({'error': 'PDF name is required'}), 400
        
    try:
        pdf_path = os.path.join(PDFS_FOLDER, pdf_name)
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=False,
            download_name=pdf_name
        )
    except Exception as e:
        logger.error(f"Error serving PDF: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    logger.info("Starting Flask server...")
    logger.info(f"PDF directory path: {os.path.abspath(PDFS_FOLDER)}")
    
    try:
        pdf_files = [f for f in os.listdir(PDFS_FOLDER) if f.lower().endswith('.pdf')]
        logger.info(f"Available PDF files: {pdf_files}")
    except Exception as e:
        logger.error(f"Error checking PDF directory: {str(e)}")
    
    try:
        app.run(debug=True, host='127.0.0.1', port=5000)
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")