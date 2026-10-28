import os

from dotenv import load_dotenv
from openai import OpenAI

# Load API_KEY from the .env file in this folder
load_dotenv()
api_key = os.getenv("API_KEY")
if not api_key:
    raise RuntimeError("API_KEY not found. Add it to your .env file.")

# Meta Model API is OpenAI-compatible
client = OpenAI(base_url="https://api.meta.ai/v1", api_key=api_key)

response = client.chat.completions.create(
    model="muse-spark-1.3",
    messages=[
        {"role": "developer", "content": "You are a helpful assistant."},
        {"role": "user", "content": "hi"},
    ],
)

print(response.choices[0].message.content)
