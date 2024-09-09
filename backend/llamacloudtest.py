import os
from llama_parse import LlamaParse
from dotenv import load_dotenv

load_dotenv()

# Retrieve your Llama Cloud API key from environment variables
llama_cloud_api_key = os.getenv("LLAMA_CLOUD_API_KEY")

# Initialize the LlamaParse parser with the API key
parser = LlamaParse(api_key=llama_cloud_api_key, result_type="markdown")

# Test the API by parsing a simple string or document (you can replace this with any other functionality supported by LlamaParse)
try:
    test_input = "This is a test document."
    parsed_result = parser.parse(test_input)
    print("Llama Cloud API Key is working!")
    print("Parsed Result:", parsed_result)
except Exception as e:
    print("Llama Cloud API Key test failed.")
    print(e)
