from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

api_key = os.getenv("GEMMA_API_KEY")
if not api_key or api_key == "YOUR_API_KEY_HERE":
    print("ERROR: Please set your GEMMA_API_KEY in backend/.env before running this test.")
    exit(1)

client = genai.Client(
    api_key=api_key
)

try:
    response = client.models.generate_content(
        model="gemma-4-31b-it",
        contents="Explain what an ESP32-S3 is in one paragraph."
    )
    print("--- Gemma 4 Response ---")
    print(response.text)
except Exception as e:
    print(f"API Call Error: {e}")
