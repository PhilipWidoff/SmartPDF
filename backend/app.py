from flask import Flask, request, jsonify
from flask_cors import CORS
from main import LlamaParser

app = Flask(__name__)
CORS(app)

# Initialize the LlamaParser
file_path = "C:/Users/phili/Downloads/FH_Rulebook.pdf"
parser = LlamaParser()
index = parser.parse_and_embed_pdf(file_path)
print("Indexing complete")

@app.route('/api/query', methods=['POST'])
def query():
    data = request.json
    query = data.get('query')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    response = parser.query_pdf(query)
    return jsonify({'query': query, 'response': str(response)})

if __name__ == '__main__':
    app.run(debug=True)