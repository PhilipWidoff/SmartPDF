<!-- 
Smart PDF Parser AI by Philip Widoff
--------------
An intelligent PDF analysis and query system that combines LlamaIndex, OpenAI, and various NLP models to provide advanced document interaction capabilities.


----------------
*Features*

Core Functionality

Interactive PDF Query System: Ask questions about PDF content and receive contextual answers
PDF Viewer Integration: View PDFs directly in the interface while querying
Conversation History: Maintains context of previous queries and responses
Multi-PDF Support: Switch between different PDF documents seamlessly

*AI Capabilities*

Document Analysis

Topic Extraction using KeyBERT
Named Entity Recognition with spaCy
Readability Analysis with comprehensive metrics
Sentiment Analysis
Smart Question Answering


Chat Interface

Context-aware responses
Conversation memory
Real-time query processing

----------------------------------

*Technology Stack*
Backend

Framework: Flask - FastAPI is more modern, but I wanted to experiment with flask.
Core Libraries:

LlamaIndex: Document indexing and querying
OpenAI: LLM integration
spaCy: NLP processing
KeyBERT: Keyword extraction
PyMuPDF: PDF processing
LangChain: Text processing and chain operations


Frontend

Framework: React
UI Components:

Custom components
Shadcn/UI library
Tailwind CSS for styling
---------------------------------------


*Project Structure*

pdfparser/
├── backend/
│   ├── app.py             # Main Flask application
│   ├── pdfs/              # PDF storage directory
│   ├── cache/             # Index cache directory
│   └── custom_images/     # Custom image storage
└── frontend/
    └── src/
        └── components/
            └── QueryInput.jsx  # Main React component


Setup Instructions
-------------------------------
Backend Setup

bashCopy# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install flask flask-cors python-dotenv llama-index langchain openai spacy keybert scikit-learn PyMuPDF pillow transformers torch

# Download spaCy model
python -m spacy download en_core_web_sm

# Set up environment variables
# Create .env file with:
OPENAI_API_KEY=your_api_key
LLAMA_CLOUD_API_KEY=your_llama_api_key

Frontend Setup
--------------------------
bashCopy# Install dependencies
cd frontend
npm install

# Install required UI components
npm install @/components/ui lodash
Usage

Start the backend server:

bashCopycd backend
python app.py

Start the frontend development server:

bashCopycd frontend
npm run dev

Access the application at http://localhost:3000

How It Works

Document Processing

PDFs are uploaded to the backend
LlamaIndex processes and indexes the documents
Indexes are cached for improved performance


Query Processing
--------------------
User submits a query through the frontend
Query is processed against the document index
Response is generated using OpenAI's language model
Conversation history is maintained for context


Analysis Features
---------------------
Documents can be analyzed for:

Key topics (using KeyBERT)
Named entities (using spaCy)
Readability metrics
Sentiment analysis




User Interface
----------------
Interactive query input
PDF viewer integration
Conversation history sidebar
Analysis results display
Real-time response rendering



*API Endpoints*
------------------
Main Endpoints

GET /api/pdf-files: List available PDFs
POST /api/query: Process queries against PDFs
GET /api/get-pdf: Serve PDF files
POST /api/analyze: Perform document analysis

Analysis Types

topics: Extract key topics
entities: Extract named entities
readability: Analyze text readability
qa: Direct question answering

Performance Considerations

Caching implemented for:

Document indexes
Analysis results
PDF summaries


GPU acceleration when available
Debounced query input
Optimized conversation history

Future Enhancements
Potential areas for improvement:

Multi-language support
Batch document processing
Advanced visualization features
Custom model integration
Enhanced caching mechanisms

Contributing
Feel free to submit issues and enhancement requests.
-->