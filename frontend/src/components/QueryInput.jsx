import React, { useState, useEffect } from "react";

const QueryInput = () => {
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [error, setError] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    fetchPdfFiles();
  }, []);

  const fetchPdfFiles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/pdf-files");
      const data = await response.json();
      setPdfFiles(data.pdf_files);
    } catch (error) {
      console.error("Error fetching PDF files:", error);
      setError("Failed to fetch PDF files. Please try again later.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !selectedPdf) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://127.0.0.1:5000/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          pdf_name: selectedPdf,
          conversation_history: conversations,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setConversations((prev) => [
          ...prev,
          { role: "human", content: query },
          { role: "ai", content: data.response },
        ]);
        setQuery("");
        setExpandedIndex(null);
      } else {
        console.error("Error from server:", data);
        setError(`Error from server: ${data.error}`);
      }
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred while processing your query.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

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
          {isHistory && <span>{isExpanded ? "▲" : "▼"}</span>}
        </div>
        {!isHistory || isExpanded ? (
          <p className="text-gray-300 whitespace-pre-wrap mt-2">
            {conv.content}
          </p>
        ) : (
          <p className="text-gray-300 mt-2">{preview}</p>
        )}
      </div>
    );
  };

  const currentConversation = conversations.slice(-2);
  const historyConversation = conversations.slice(0, -2);

  return (
    <div className="flex max-w-6xl mx-auto p-4 bg-transparent min-h-screen text-white font-sans">
      <div className="flex-grow mr-4">
        <h1
          className="text-3xl font-bold mb-4 text-white"
          style={{ textStroke: "1px black", WebkitTextStroke: "1px black" }}
        >
          Ask and receive
        </h1>
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex flex-col gap-2">
            <select
              value={selectedPdf}
              onChange={(e) => setSelectedPdf(e.target.value)}
              className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded"
              disabled={conversations.length > 0}
            >
              <option value="">Select a PDF</option>
              {pdfFiles.map((pdf) => (
                <option key={pdf} value={pdf}>
                  {pdf}
                </option>
              ))}
            </select>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your query"
              className="w-full p-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded resize-none"
              rows="3"
            />
            <button
              type="submit"
              disabled={loading || !selectedPdf || !query.trim()}
              className="px-4 py-2 shadow-lg bg-red-600 text-black rounded hover:bg-red-700 disabled:bg-gray-700 transition duration-300"
            >
              {loading ? "Querying..." : "Submit Query"}
            </button>
          </div>
        </form>

        {error && (
          <div className="border border-red-600 rounded p-4 bg-red-800 mt-4">
            <p className="text-white">{error}</p>
          </div>
        )}

        {currentConversation.map((conv, index) =>
          renderConversationItem(conv, conversations.length - 2 + index, false)
        )}
      </div>

      {historyConversation.length > 0 && (
        <div className="w-1/3 ml-4">
          <h2 className="text-xl font-bold mb-2">History</h2>
          <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
            {historyConversation.map((conv, index) =>
              renderConversationItem(conv, index, true)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryInput;
