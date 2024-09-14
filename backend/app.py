from flask import Flask, request, jsonify
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

load_dotenv()

openai_api_key = os.getenv('OPENAI_API_KEY')
llama_cloud_api_key = os.getenv('LLAMA_CLOUD_API_KEY')

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class LlamaParser:
    def __init__(self):
        self.pdfs_folder = "pdfs"
        self.cache_folder = "cache"
        self.indexes = {}
        if not os.path.exists(self.cache_folder):
            os.makedirs(self.cache_folder)

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

    def query_pdf(self, file_name, query, chat_history):
        logger.debug(f"Querying PDF: {file_name}")
        logger.debug(f"Query: {query}")
        logger.debug(f"Chat history: {chat_history}")

        if file_name not in self.indexes:
            self.parse_and_embed_pdf(file_name)
        
        memory = ChatMemoryBuffer.from_defaults(token_limit=1500)
        
        for message in chat_history:
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

def get_pdf_files(folder):
    return [f for f in os.listdir(folder) if f.lower().endswith('.pdf')]

parser = LlamaParser()

@app.route('/api/pdf-files', methods=['GET'])
def api_get_pdf_files():
    pdf_files = get_pdf_files(parser.pdfs_folder)
    return jsonify({'pdf_files': pdf_files})

@app.route('/api/query', methods=['POST'])
def api_query():
    data = request.json
    logger.debug(f"Received data: {data}")

    query = data.get('query')
    pdf_name = data.get('pdf_name')
    conversation_history = data.get('conversation_history', [])
    
    if not query or not pdf_name:
        return jsonify({'error': 'Query and PDF name are required'}), 400

    try:
        response = parser.query_pdf(pdf_name, query, conversation_history)
        return jsonify({'query': query, 'response': response})
    except Exception as e:
        logger.error(f"An error occurred: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

if __name__ == "__main__":
    app.run(debug=True)