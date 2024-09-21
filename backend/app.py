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

load_dotenv()

openai_api_key = os.getenv('OPENAI_API_KEY')
llama_cloud_api_key = os.getenv('LLAMA_CLOUD_API_KEY')

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

PDFS_FOLDER = "pdfs"
CACHE_FOLDER = "cache"
CUSTOM_IMAGES_FOLDER = "custom_images"

# Ensure necessary directories exist
for folder in [PDFS_FOLDER, CACHE_FOLDER, CUSTOM_IMAGES_FOLDER]:
    os.makedirs(folder, exist_ok=True)

class LlamaParser:
    def __init__(self):
        self.pdfs_folder = PDFS_FOLDER
        self.cache_folder = CACHE_FOLDER
        self.indexes = {}

    def parse_and_embed_pdf(self, file_name):
        cache_path = os.path.join(self.cache_folder, f"{file_name}.json")
        
        if os.path.exists(cache_path):
            storage_context = StorageContext.from_defaults(persist_dir=cache_path)
            index = load_index_from_storage(storage_context)
        else:
            parser = LlamaParse(result_type="markdown")
            file_extractor = {".pdf": parser}
            file_path = os.path.join(self.pdfs_folder, file_name)
            
            documents = SimpleDirectoryReader(input_files=[file_path], file_extractor=file_extractor).load_data()
            index = VectorStoreIndex.from_documents(documents)
            
            index.storage_context.persist(persist_dir=cache_path)
        
        self.indexes[file_name] = index
        return index

    def query_pdf(self, file_name, query, chat_history, is_new_conversation):
        logger.debug(f"Querying PDF: {file_name}")
        logger.debug(f"Query: {query}")
        logger.debug(f"Chat history: {chat_history}")
        logger.debug(f"Is new conversation: {is_new_conversation}")

        if file_name not in self.indexes:
            self.parse_and_embed_pdf(file_name)
        
        memory = ChatMemoryBuffer.from_defaults(token_limit=1500)
        
        if not is_new_conversation:
            for message in chat_history[-4:]:  # Only use the last 2 exchanges (4 messages)
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

parser = LlamaParser()

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

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)