<!-- 
An AI chatbot that handles PDF documents, with chat history for better context
and multiple queries possible. Frontend of Vite + React with Tailwindcss for
styling

-------------------------------------------------------
Setup:

The application uses Flask for the web server, CORS for cross-origin requests, and various libraries for PDF processing and natural language understanding.
It loads environment variables for API keys.


LlamaParser class:

This class handles parsing and querying PDFs.
It uses LlamaParse to convert PDFs to markdown format.
It creates and manages vector indexes for each PDF for efficient querying.
It implements caching to avoid reprocessing PDFs unnecessarily.

--------------------------------------------------------
API Endpoints:
a. GET /api/pdf-files:

Returns a list of available PDF files.

b. POST /api/query:

Accepts a query, PDF name, conversation history, and a flag for new conversations.
Uses the LlamaParser to query the specified PDF and return a response.

c. GET /api/background-image:

Retrieves a background image for a given PDF.
Checks for custom images first, then generates one from the PDF frontpage
if not found.

-------------------------------------------
PDF Querying Process:

When a query is received, the application checks if the PDF has been parsed and indexed.
If not, it parses the PDF and creates a vector index.
It then uses a CondenseQuestionChatEngine to generate a response based on the query and conversation history.

------------------------------------------
Image Handling:

The application can serve custom images for PDFs or generate images from the first page of PDFs. -->