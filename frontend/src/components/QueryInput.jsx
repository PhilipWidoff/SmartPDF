import React, { useState, useEffect } from 'react';

const QueryInput = () => {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPdfFiles();
  }, []);

  const fetchPdfFiles = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/pdf-files');
      const data = await response.json();
      setPdfFiles(data.pdf_files);
    } catch (error) {
      console.error('Error fetching PDF files:', error);
      setError('Failed to fetch PDF files. Please try again later.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !selectedPdf) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://127.0.0.1:5000/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query, 
          pdf_name: selectedPdf,
          conversation_history: conversations
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(prev => [...prev, { role: 'human', content: query }, { role: 'ai', content: data.response }]);
        setQuery('');
      } else {
        console.error('Error from server:', data);
        setError(`Error from server: ${data.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('An error occurred while processing your query.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-transparent min-h-screen text-white font-sans">
      <h1 className="text-2xl font-bold mb-4">PDF Query System</h1>
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
            {loading ? 'Querying...' : 'Submit Query'}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="border border-red-600 rounded p-4 bg-red-800 mt-4">
          <p className="text-white">{error}</p>
        </div>
      )}

      {conversations.map((conv, index) => (
        <div key={index} className="border border-gray-600 rounded p-4 bg-gray-800 mt-4">
          <div className="space-y-2">
            <p className={`font-semibold ${conv.role === 'human' ? 'text-blue-300' : 'text-green-300'}`}>
              {conv.role === 'human' ? 'Query:' : 'Response:'}
            </p>
            <p className="text-gray-300 whitespace-pre-wrap">{conv.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QueryInput;