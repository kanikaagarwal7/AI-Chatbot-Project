import os
import uuid
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from ai21 import AI21Client
from ai21.models.chat import ChatMessage

# Load environment variables
load_dotenv()

# Get API key and MongoDB URI from environment
api_key = os.getenv('AI21_API_KEY')
mongo_client = MongoClient("mongodb://localhost:27017")  # Update if using Atlas
db = mongo_client["chat_history_db"]
chat_collection = db["cat_talk"]
session_collection = db["chat_sessions"]

# Create or continue a session
session_choice = input("Start a new session? (yes/no): ").strip().lower()
if session_choice == "yes":
    session_id = str(uuid.uuid4())
    session_description = input("Enter a short description for this session: ").strip()
    session_collection.insert_one({
        "_id": session_id,
        "description": session_description,
        "created_at": datetime.now(timezone.utc)
    })
    print(f"✅ New session created with ID: {session_id}")
else:
    session_id = input("Enter existing session ID: ").strip()
    existing = session_collection.find_one({"_id": session_id})
    if not existing:
        print("❌ Session ID not found. Exiting.")
        exit()

# Load document content
with open("cat.txt", "r", encoding="utf-8") as file:
    doc_content = file.read()

# Define system message (fixed for all turns)
system = (
    "You are an assistant that answers questions only from the following document.\n\n"
    f"{doc_content}\n\n"
    "If the answer is not in the document, respond with 'Not available in the document.'"
)

# Initialize AI21 client
client = AI21Client(api_key=api_key)

# Loop to continue the chat
while True:
    user_input = input("\nAsk your question (or type 'exit' to end): ").strip()
    if user_input.lower() == "exit":
        print("👋 Chat ended.")
        break

    # Prepare messages
    messages = [
        ChatMessage(content=system, role="system"),
        ChatMessage(content=user_input, role="user"),
    ]

    # Get AI response
    chat_completions = client.chat.completions.create(
        messages=messages,
        model="jamba-mini-1.6-2025-03",
    )

    response = chat_completions.choices[0].message.content
    print("\n🧠 AI Response:", response)

    # Save to MongoDB
    chat_record = {
        "session_id": session_id,
        "question": user_input,
        "answer": response,
        "timestamp": datetime.now(timezone.utc)
    }
    chat_collection.insert_one(chat_record)
