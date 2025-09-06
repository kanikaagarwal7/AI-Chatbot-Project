import os
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from ai21 import AI21Client
from ai21.models.chat import ChatMessage

# Load environment variables from .env file
load_dotenv()

# Get API key from environment
api_key = os.getenv('AI21_API_KEY')
mongo_client = MongoClient("mongodb://localhost:27017")  # change if using Atlas
db = mongo_client["chat_history_db"]
collection = db["cat talk"]

client = AI21Client(api_key=api_key)

with open("cat.txt", "r", encoding="utf-8") as file:
    doc_content = file.read()

system =  (
    "You are an assistant that answers questions only from the following document.\n\n"
    f"{doc_content}\n\n"
    "If the answer is not in the document, respond with 'Not available in the document.'"
)

# Get input from user
user_input = input("Ask your question: ")
messages = [
    ChatMessage(content=system, role="system"),
    ChatMessage(content=user_input, role="user"),
]

chat_completions = client.chat.completions.create(
    messages=messages,
    model="jamba-mini-1.6-2025-03",
)

print(chat_completions.choices[0].message.content)

chat_record = { 
    "question": user_input,
    "answer":chat_completions.choices[0].message.content,
    "timestamp":datetime.now(timezone.utc)  
}
collection.insert_one(chat_record)