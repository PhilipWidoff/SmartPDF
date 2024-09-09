import React, { useState } from 'react';

const QueryInput = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return; // Prevent submitting empty queries
    setLoading(true);
    try {
        const response = await fetch('http://127.0.0.1:5000/api/query', {
            method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'An error occurred while processing your query.' });
    } finally {
      setLoading(false);
      setQuery('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-transparent min-h-screen text-white font-sans">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your query"
            className="flex-grow p-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-700"
          >
            {loading ? 'Querying...' : 'Submit'}
          </button>
        </div>
      </form>
      
      {result && (
        <div className="border border-gray-600 rounded p-4 bg-gray-800">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-white">Query Result</h2>
          </div>
          <div>
            <p className="font-semibold text-gray-200">Query: {result.query}</p>
            <p className="mt-2 text-gray-300">{result.response}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryInput;
