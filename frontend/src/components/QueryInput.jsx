import React, { useState, useEffect, useCallback, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Base URL for API calls
const API_BASE_URL = "http://localhost:5000/api";

const QueryInput = ({ onPdfSelect, isCustomImage }) => {
  // State declarations
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [error, setError] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isFetchingPdfs, setIsFetchingPdfs] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("topics");
  const [currentPage, setCurrentPage] = useState(1);
  const [showPagePrompt, setShowPagePrompt] = useState(false);
  const [foundPages, setFoundPages] = useState([]);

  // References
  const abortController = useRef(new AbortController());
  const pdfViewerRef = useRef(null);

  // Fetch PDF files on component mount
  const fetchPdfFiles = useCallback(async () => {
    setIsFetchingPdfs(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/pdf-files`);
      if (!response.ok) throw new Error("Failed to fetch PDF files");
      const data = await response.json();
      setPdfFiles(data.pdf_files);
      if (data.pdf_files.length > 0 && !selectedPdf) {
        setSelectedPdf(data.pdf_files[0]);
        onPdfSelect(data.pdf_files[0]);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error fetching PDF files:", error);
        setError("Failed to fetch PDF files. Please try again later.");
      }
    } finally {
      setIsFetchingPdfs(false);
    }
  }, [onPdfSelect, selectedPdf]);

  useEffect(() => {
    fetchPdfFiles();
    return () => abortController.current.abort();
  }, [fetchPdfFiles]);

  // Handle query submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !selectedPdf) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          pdf_name: selectedPdf,
          conversation_history: isNewConversation ? [] : conversations,
          is_new_conversation: isNewConversation,
        }),
      });

      if (!response.ok) throw new Error("Failed to process query");

      const data = await response.json();

      // Add the initial query and response
      const updatedConversations = [
        ...(isNewConversation ? [] : conversations),
        { role: "human", content: query },
        { role: "ai", content: data.response },
      ];

      // If pages were found, add the navigation prompt
      if (data.has_location && data.pages?.length > 0) {
        setFoundPages(data.pages);
        updatedConversations.push({
          role: "ai",
          content: "Do you want me to take you to that page?",
          isPagePrompt: true,
        });
        setShowPagePrompt(true);
      }

      setConversations(updatedConversations);
      setQuery("");
      setExpandedIndex(null);
      setIsNewConversation(false);
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred while processing your query.");
    } finally {
      setLoading(false);
    }
  };

  // Handle page navigation response
  const handlePageNavigation = async (userResponse) => {
    if (userResponse.toLowerCase() === "yes" && foundPages.length > 0) {
      setShowPdfViewer(true);
      setCurrentPage(foundPages[0].page);
      setConversations((prev) => [
        ...prev,
        { role: "human", content: "Yes" },
        {
          role: "ai",
          content: `Navigating to page ${foundPages[0].page}.`,
        },
      ]);
    } else {
      setConversations((prev) => [...prev, { role: "human", content: "No" }]);
    }
    setShowPagePrompt(false);
  };

  // Handle PDF selection
  const handlePdfSelect = (e) => {
    const newSelectedPdf = e.target.value;
    setSelectedPdf(newSelectedPdf);
    onPdfSelect(newSelectedPdf);
    setIsNewConversation(true);
    setConversations([]);
    setShowPdfViewer(false);
    setAnalysisResults(null);
    setCurrentPage(1);
    setFoundPages([]);
  };

  // Toggle PDF viewer
  const togglePdfViewer = () => {
    setShowPdfViewer(!showPdfViewer);
  };

  // Handle document analysis
  const analyzeDocument = async (analysisType) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdf_name: selectedPdf,
          analysis_type: analysisType,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();
      setAnalysisResults(data);
      setActiveAnalysisTab(analysisType);
    } catch (error) {
      console.error("Analysis error:", error);
      setError("Failed to analyze document");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start new conversation
  const toggleNewConversation = () => {
    setIsNewConversation(true);
    setConversations([]);
    setSelectedPdf("");
    onPdfSelect("");
    setIsResetting(true);
    setShowPdfViewer(false);
    setAnalysisResults(null);
    setCurrentPage(1);
    setFoundPages([]);
    setTimeout(() => setIsResetting(false), 500);
  };

  // Toggle conversation expansion
  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Render conversation items
  const renderConversationItem = (conv, index, isHistory) => {
    // Special rendering for page navigation prompts
    if (conv.isPagePrompt) {
      return (
        <div className="border border-gray-600 rounded p-2 bg-gray-800 mt-2">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-green-300">Assistant:</p>
          </div>
          <p className="text-yellow-500 whitespace-pre-wrap mt-2">
            {conv.content}
          </p>
          {showPagePrompt && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handlePageNavigation("yes")}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Yes
              </button>
              <button
                onClick={() => handlePageNavigation("no")}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                No
              </button>
            </div>
          )}
        </div>
      );
    }

    // Regular conversation rendering
    const isExpanded = expandedIndex === index;
    const previewLength = 30;
    const preview =
      conv.content.length > previewLength
        ? `${conv.content.substring(0, previewLength)}...`
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
            {conv.role === "human" ? "You:" : "Assistant:"}
          </p>
          {isHistory && (
            <span className="text-yellow-500">{isExpanded ? "▲" : "▼"}</span>
          )}
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

  // Split conversations into current and history
  const currentConversation = conversations.slice(-2);
  const historyConversation = conversations.slice(0, -2);

  // Render analysis results
  const renderAnalysisResults = () => {
    if (!analysisResults) return null;

    switch (activeAnalysisTab) {
      case "topics":
        return (
          <div className="mt-4 bg-gray-800 p-4 rounded">
            <h3 className="text-yellow-500 font-bold mb-2">Key Topics</h3>
            <ul className="list-disc pl-5">
              {analysisResults.topics?.map((topic, index) => (
                <li key={index} className="text-yellow-500">
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        );
      case "entities":
        return (
          <div className="mt-4 bg-gray-800 p-4 rounded">
            <h3 className="text-yellow-500 font-bold mb-2">Named Entities</h3>
            {Object.entries(analysisResults.entities || {}).map(
              ([category, items]) => (
                <div key={category} className="mb-3">
                  <h4 className="text-blue-300">{category}</h4>
                  <ul className="list-disc pl-5">
                    {items.map((item, index) => (
                      <li key={index} className="text-yellow-500">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        );
      case "readability":
        return (
          <div className="mt-4 bg-gray-800 p-4 rounded">
            <h3 className="text-yellow-500 font-bold mb-2">
              Readability Analysis
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(analysisResults.readability || {}).map(
                ([metric, value]) => (
                  <div key={metric} className="bg-gray-700 p-2 rounded">
                    <p className="text-blue-300">
                      {metric.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <p className="text-yellow-500">{value}</p>
                  </div>
                )
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="flex flex-col lg:flex-row gap-4">
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

          {/* PDF Selection and Query Form */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex flex-col gap-2">
              <select
                value={selectedPdf}
                onChange={handlePdfSelect}
                className="w-full p-2 border border-gray-600 bg-gray-800 text-yellow-500 rounded"
                disabled={isFetchingPdfs}
              >
                <option value="">Select a PDF</option>
                {pdfFiles.map((pdf) => (
                  <option key={pdf} value={pdf}>
                    {pdf}{" "}
                    {isCustomImage && selectedPdf === pdf
                      ? " (Custom Image)"
                      : ""}
                  </option>
                ))}
              </select>

              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your query"
                className="w-full p-2 border border-gray-600 bg-gray-800 text-yellow-500 placeholder-yellow-300 rounded resize-none"
                rows="3"
              />

              <div className="flex justify-between items-center">
                <button
                  type="submit"
                  disabled={loading || !selectedPdf || !query.trim()}
                  className="px-4 py-2 shadow-lg bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-700 transition duration-300"
                >
                  {loading ? "Querying..." : "Submit Query"}
                </button>

                <button
                  type="button"
                  onClick={toggleNewConversation}
                  className={`px-4 py-2 shadow-lg rounded transition duration-300 w-40 h-10 flex items-center justify-center ${
                    isNewConversation
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-blue-600 text-yellow-500 hover:bg-blue-700"
                  }`}
                >
                  <span className="truncate">
                    {isResetting ? "Resetting..." : "New Conversation"}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* PDF Controls */}
          {selectedPdf && (
            <div className="mt-4 space-x-2">
              <Button
                onClick={togglePdfViewer}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {showPdfViewer ? "Hide PDF" : "Show PDF"}
              </Button>

              <Button
                onClick={() => analyzeDocument("topics")}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isAnalyzing}
              >
                Analyze Topics
              </Button>

              <Button
                onClick={() => analyzeDocument("entities")}
                className="bg-green-600 hover:bg-green-700"
                disabled={isAnalyzing}
              >
                Extract Entities
              </Button>

              <Button
                onClick={() => analyzeDocument("readability")}
                className="bg-yellow-600 hover:bg-yellow-700"
                disabled={isAnalyzing}
              >
                Check Readability
              </Button>
            </div>
          )}

          {/* PDF Viewer */}
          {showPdfViewer && selectedPdf && (
            <div className="mt-4 border border-gray-600 rounded">
              <div className="bg-gray-800 p-2 flex justify-between items-center">
                <span className="text-yellow-500">Page {currentPage}</span>
                {foundPages.length > 1 && (
                  <div className="flex gap-2">
                    {foundPages.map((page, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(page.page)}
                        className={`px-2 py-1 ${
                          currentPage === page.page
                            ? "bg-blue-700 text-white"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        } rounded`}
                      >
                        Page {page.page}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <iframe
                ref={pdfViewerRef}
                src={`${API_BASE_URL}/get-pdf?pdf_name=${selectedPdf}#page=${currentPage}`}
                className="w-full h-[600px]"
                title="PDF Viewer"
              />
            </div>
          )}

          {/* Analysis Results */}
          {renderAnalysisResults()}

          {/* Current Conversation */}
          {currentConversation.map((conv, index) =>
            renderConversationItem(
              conv,
              conversations.length - 2 + index,
              false
            )
          )}
        </div>

        {/* Conversation History Sidebar */}
        <div className="md:w-1/3">
          {historyConversation.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-2 text-yellow-500">
                History
              </h2>
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
