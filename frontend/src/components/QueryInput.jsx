import React, { useState, useEffect, useCallback, useRef } from "react";
import { debounce } from 'lodash';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Base URL for API calls
const API_BASE_URL = "/api";

const QueryInput = ({ onPdfSelect, isCustomImage }) => {
  // State declarations
  const [query, setQuery] = useState(""); // Current query input
  const [conversations, setConversations] = useState([]); // Chat history
  const [loading, setLoading] = useState(false); // Loading state for query submission
  const [pdfFiles, setPdfFiles] = useState([]); // List of available PDF files
  const [selectedPdf, setSelectedPdf] = useState(""); // Currently selected PDF
  const [error, setError] = useState(null); // Error state
  const [expandedIndex, setExpandedIndex] = useState(null); // Index of expanded conversation item
  const [isNewConversation, setIsNewConversation] = useState(true); // Flag for new conversation
  const [isResetting, setIsResetting] = useState(false); // Flag for resetting conversation
  const [isFetchingPdfs, setIsFetchingPdfs] = useState(false); // Loading state for fetching PDFs

  // Ref for AbortController to cancel fetch requests
  const abortController = useRef(new AbortController());

  // Function to fetch PDF files from the server
  const fetchPdfFiles = useCallback(async () => {
    setIsFetchingPdfs(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/pdf-files`, {
        signal: abortController.current.signal // For cancelling the request if needed
      });
      if (!response.ok) {
        throw new Error('Failed to fetch PDF files');
      }
      const data = await response.json();
      setPdfFiles(data.pdf_files);
      // Select the first PDF if none is selected
      if (data.pdf_files.length > 0 && !selectedPdf) {
        setSelectedPdf(data.pdf_files[0]);
        onPdfSelect(data.pdf_files[0]);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error("Error fetching PDF files:", error);
        setError("Failed to fetch PDF files. Please try again later.");
      }
    } finally {
      setIsFetchingPdfs(false);
    }
  }, [onPdfSelect, selectedPdf]);

  // Effect to fetch PDF files on component mount
  useEffect(() => {
    fetchPdfFiles();
    // Cleanup function to abort any ongoing fetch when component unmounts
    return () => abortController.current.abort();
  }, [fetchPdfFiles]);

  // Debounced function to update query state (reduces unnecessary re-renders)
  const debouncedSetQuery = useCallback(
    debounce((value) => setQuery(value), 300),
    []
  );

  // Function to handle query submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !selectedPdf) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          pdf_name: selectedPdf,
          conversation_history: isNewConversation ? [] : conversations,
          is_new_conversation: isNewConversation,
        }),
        signal: abortController.current.signal
      });
      if (!response.ok) {
        throw new Error('Failed to process query');
      }
      const data = await response.json();
      // Update conversations state
      setConversations((prev) => [
        ...(isNewConversation ? [] : prev),
        { role: "human", content: query },
        { role: "ai", content: data.response },
      ]);
      setQuery("");
      setExpandedIndex(null);
      setIsNewConversation(false);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Query aborted');
      } else {
        console.error("Error:", error);
        setError("An error occurred while processing your query.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to handle PDF selection
  const handlePdfSelect = (e) => {
    const newSelectedPdf = e.target.value;
    setSelectedPdf(newSelectedPdf);
    onPdfSelect(newSelectedPdf);
    setIsNewConversation(true);
    setConversations([]);
  };

  // Function to start a new conversation
  const toggleNewConversation = () => {
    setIsNewConversation(true);
    setConversations([]);
    setSelectedPdf("");
    onPdfSelect("");
    setIsResetting(true);
    setTimeout(() => setIsResetting(false), 500);
  };

  // Function to toggle expansion of conversation items
  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Function to render individual conversation items
  const renderConversationItem = (conv, index, isHistory) => {
    const isExpanded = expandedIndex === index;
    const previewLength = 30;
    const preview =
      conv.content.length > previewLength
        ? conv.content.substring(0, previewLength) + "..."
        : conv.content;

    return (
      <div
        key={index}
        className={`border border-gray-600 rounded p-2 bg-gray-800 mt-2 ${
          isHistory ? "cursor-pointer text-sm" : ""
        }`}
        onClick={() => isHistory && toggleExpand(index)}
      >
        <div className="flex justify-between items-center">
          <p
            className={`font-semibold ${
              conv.role === "human" ? "text-blue-300" : "text-green-300"
            }`}
          >
            {conv.role === "human" ? "Query:" : "Response:"}
          </p>
          {isHistory && <span className="text-yellow-500">{isExpanded ? "▲" : "▼"}</span>}
        </div>
        {!isHistory || isExpanded ? (
          <p className="text-yellow-500 whitespace-pre-wrap mt-2">
            {conv.content}
          </p>
        ) : (
          <p className="text-yellow-500 mt-2">{preview}</p>
        )}
      </div>
    );
  };

  // Separate current conversation and history
  const currentConversation = conversations.slice(-2);
  const historyConversation = conversations.slice(0, -2);

  // Main component render
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-grow">
          <h1
            className="text-4xl font-semibold mb-4 text-yellow-500"
            style={{
              textShadow: "4px 4px 10px rgba(0, 0, 0, 0.8)",
              WebkitTextStroke: "1px orange",
            }}
          >
            Ask and receive
          </h1>
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex flex-col gap-2">
              {/* PDF selection dropdown */}
              <select
                value={selectedPdf}
                onChange={handlePdfSelect}
                className="w-full p-2 border border-gray-600 bg-gray-800 text-yellow-500 rounded"
                disabled={isFetchingPdfs}
              >
                <option value="">Select a PDF</option>
                {pdfFiles.map((pdf) => (
                  <option key={pdf} value={pdf}>
                    {pdf} {isCustomImage && selectedPdf === pdf ? " (Custom Image)" : ""}
                  </option>
                ))}
              </select>
              {/* Query input textarea */}
              <textarea
                value={query}
                onChange={(e) => debouncedSetQuery(e.target.value)}
                placeholder="Enter your query"
                className="w-full p-2 border border-gray-600 bg-gray-800 text-yellow-500 placeholder-yellow-300 rounded resize-none"
                rows="3"
              />
              <div className="flex justify-between items-center">
                {/* Submit query button */}
                <button
                  type="submit"
                  disabled={loading || !selectedPdf || !query.trim()}
                  className="px-4 py-2 shadow-lg bg-red-600 text-white-300 rounded hover:bg-red-700 disabled:bg-gray-700 transition duration-300"
                >
                  {loading ? "Querying..." : "Submit Query"}
                </button>
                {/* New conversation button */}
                <button
                  type="button"
                  onClick={toggleNewConversation}
                  className={`px-4 py-2 shadow-lg rounded transition duration-300 w-40 h-10 flex items-center justify-center ${
                    isNewConversation
                      ? "bg-green-600 text-white-300 hover:bg-green-700"
                      : "bg-blue-600 text-yellow-500 hover:bg-blue-700"
                  }`}
                >
                  <span className="truncate">
                    {isResetting ? "Resetting..." : "New Convo"}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Display current conversation */}
          {currentConversation.map((conv, index) =>
            renderConversationItem(conv, conversations.length - 2 + index, false)
          )}
        </div>

        {/* Conversation history sidebar */}
        <div className="md:w-1/3">
          {historyConversation.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-2 text-yellow-500">History</h2>
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {historyConversation.map((conv, index) =>
                  renderConversationItem(conv, index, true)
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryInput;