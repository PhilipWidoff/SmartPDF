from flask import Flask, request, jsonify, send_file, Response
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
from transformers import (
    pipeline,
    T5ForConditionalGeneration,
    T5Tokenizer,
    BartForQuestionAnswering,
    BartTokenizer
)
from PIL import Image
import numpy as np
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains.summarize import load_summarize_chain
from langchain.chat_models import ChatOpenAI
from langchain.docstore.document import Document
import torch
import spacy
from keybert import KeyBERT

load_dotenv()

# Initialize environment variables
openai_api_key = os.getenv('OPENAI_API_KEY')
llama_cloud_api_key = os.getenv('LLAMA_CLOUD_API_KEY')

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Define constants for directory paths
PDFS_FOLDER = "pdfs"
CACHE_FOLDER = "cache"
CUSTOM_IMAGES_FOLDER = "custom_images"
SUMMARIES_FOLDER = "summaries"

# Create necessary directories
for folder in [PDFS_FOLDER, CACHE_FOLDER, CUSTOM_IMAGES_FOLDER, SUMMARIES_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Initialize AI models with GPU support if available
device = 0 if torch.cuda.is_available() else -1

# Initialize various AI models
sentiment_analyzer = pipeline("sentiment-analysis", device=device)
text_classifier = pipeline("zero-shot-classification", device=device)
image_classifier = pipeline("image-classification", device=device)
nlp = spacy.load("en_core_web_sm")
keyword_model = KeyBERT()
qa_model = pipeline("question-answering", device=device)

class EnhancedLlamaParser(LlamaParse):
    """Enhanced version of LlamaParser with additional AI capabilities"""
    
    def __init__(self):
        """Initialize the parser with various AI models and utilities"""
        super().__init__()
        self.llm = ChatOpenAI(temperature=0, openai_api_key=openai_api_key)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200
        )

    def analyze_sentiment(self, text):
        """
        Analyze the sentiment of text
        Returns: Dictionary containing sentiment label and score
        """
        return sentiment_analyzer(text)

    def extract_entities(self, text):
        """
        Extract named entities from text using spaCy
        Returns: Dictionary of entities grouped by type
        """
        doc = nlp(text)
        entities = {}
        for ent in doc.ents:
            if ent.label_ not in entities:
                entities[ent.label_] = []
            entities[ent.label_].append(ent.text)
        return entities

    def extract_keywords(self, text, top_n=10):
        """
        Extract key terms from text using KeyBERT
        Returns: List of (keyword, score) tuples
        """
        keywords = keyword_model.extract_keywords(
            text,
            top_n=top_n,
            stop_words='english'
        )
        return keywords

    def answer_specific_question(self, context, question):
        """
        Use BART model for precise question answering
        Returns: Dictionary containing answer and confidence score
        """
        return qa_model(question=question, context=context)

    def generate_summary(self, file_name):
        """
        Generate a comprehensive summary of the PDF
        Caches results for efficiency
        Returns: String containing the summary
        """
        cache_path = os.path.join(SUMMARIES_FOLDER, f"{file_name}_summary.txt")
        
        if os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                return f.read()

        file_path = os.path.join(self.pdfs_folder, file_name)
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()

        # Split and summarize text
        texts = self.text_splitter.split_text(text)
        docs = [Document(page_content=t) for t in texts]
        chain = load_summarize_chain(self.llm, chain_type="map_reduce")
        summary = chain.run(docs)

        # Cache results
        with open(cache_path, 'w') as f:
            f.write(summary)

        return summary

parser = EnhancedLlamaParser()

# Existing routes remain the same...

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """
    Enhanced analysis endpoint supporting multiple types of analysis
    Supports: summary, entities, keywords, sentiment, qa
    """
    data = request.json
    pdf_name = data.get('pdf_name')
    analysis_type = data.get('analysis_type')
    
    if not pdf_name or not analysis_type:
        return jsonify({'error': 'PDF name and analysis type are required'}), 400

    try:
        if analysis_type == 'summary':
            result = parser.generate_summary(pdf_name)
            return jsonify({'summary': result})
            
        elif analysis_type == 'entities':
            text = data.get('text')
            if not text:
                return jsonify({'error': 'Text required for entity extraction'}), 400
            result = parser.extract_entities(text)
            return jsonify({'entities': result})
            
        elif analysis_type == 'keywords':
            text = data.get('text')
            if not text:
                return jsonify({'error': 'Text required for keyword extraction'}), 400
            result = parser.extract_keywords(text)
            return jsonify({'keywords': result})
            
        elif analysis_type == 'sentiment':
            text = data.get('text')
            if not text:
                return jsonify({'error': 'Text required for sentiment analysis'}), 400
            result = parser.analyze_sentiment(text)
            return jsonify({'sentiment': result})
            
        elif analysis_type == 'qa':
            context = data.get('context')
            question = data.get('question')
            if not context or not question:
                return jsonify({'error': 'Context and question required for QA'}), 400
            result = parser.answer_specific_question(context, question)
            return jsonify({'answer': result})
            
        else:
            return jsonify({'error': 'Invalid analysis type'}), 400
            
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
@app.route('/api/pdf-files', methods=['GET'])
def api_get_pdf_files():
    pdf_files = [f for f in os.listdir(PDFS_FOLDER) if f.lower().endswith('.pdf')]
    return jsonify({'pdf_files': pdf_files})

@app.route('/api/query', methods=['POST'])
def api_query():
    data = request.json
    logger.debug(f"Received data: {data}")

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
        logger.error(f"An error occurred: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/background-image', methods=['GET'])
def api_get_background_image():
    pdf_name = request.args.get('pdf')
    if not pdf_name:
        return jsonify({'error': 'PDF name is required'}), 400

    # Check for a custom image first
    image_name = os.path.splitext(pdf_name)[0]  # Remove the .pdf extension
    for ext in ['.jpg', '.jpeg', '.png']:
        custom_image_path = os.path.join(CUSTOM_IMAGES_FOLDER, f"{image_name}{ext}")
        if os.path.exists(custom_image_path):
            return send_file(custom_image_path, mimetype=f'image/{ext[1:]}'), 200, {'X-Image-Type': 'custom'}

    # If no custom image found, generate from PDF
    pdf_path = os.path.join(PDFS_FOLDER, pdf_name)
    if not os.path.exists(pdf_path):
        return jsonify({'error': 'PDF not found'}), 404

    try:
        doc = fitz.open(pdf_path)
        page = doc.load_page(0)  # Load the first page
        pix = page.get_pixmap()
        img_bytes = pix.tobytes("png")
        
        return send_file(
            io.BytesIO(img_bytes),
            mimetype='image/png',
            as_attachment=False,
            download_name=f"{image_name}.png"
        ), 200, {'X-Image-Type': 'generated'}
    except Exception as e:
        logger.error(f"Failed to process PDF: {str(e)}")
        return jsonify({'error': f'Failed to process PDF: {str(e)}'}), 500

@app.route('/api/pdf/<path:filename>')
def serve_pdf(filename):
    """Serve PDF files securely"""
    try:
        return send_file(
            os.path.join(PDFS_FOLDER, filename),
            mimetype='application/pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 404

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)