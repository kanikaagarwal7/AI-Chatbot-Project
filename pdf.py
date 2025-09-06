import fitz
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

# Load text from cat.txt
try:
    with open("cat.txt", "r", encoding="utf-8") as txt_file:
        txt_content = txt_file.read()
except FileNotFoundError:
    print("❌ cat.txt file not found.")
    txt_content = ""

# Load text from 4thsemcorrected.pdf
pdf_path = "4thsemcorrected.pdf"  
pdf_content = ""
if os.path.exists(pdf_path):
    doc = fitz.open(pdf_path)
    for page in doc:
        pdf_content += page.get_text()
    doc.close()
else:
    print("❌ 4thsemcorrected.pdf file not found.")        

# Combine both
doc_content = txt_content + "\n\n" + pdf_content    

# Initialize AI21 client
client = AI21Client(api_key=api_key)

# Ask mode for every question
mode = input("Choose mode: (1) Local documents or (2) Global knowledge: ").strip()

# Loop to continue the chat
while True:
    user_input = input("\nAsk your question (or type 'exit' to end): ").strip()
    if user_input.lower() == "exit":
        print("👋 Chat ended.")
        break

    if mode == "1":
        system = (
             "You are an assistant that must only answer using the following document. "
            "Do not use any external knowledge.\n\n"
            f"{doc_content}\n\n"
            "Instructions:\n"
            "- If the answer is found, respond with '(From local source)' followed by the answer.\n"
            "- If the answer is not found in the document, respond with exactly: 'Not available in the document.'\n"
            "- Do not guess or add any extra information beyond the document."
        )
    elif mode == "2":
        system = (
            "You are an AI assistant that answers questions using general world knowledge.\n"
            "Important - Along with the answer, add this phrase: (From Global source)"
        )
    else:
        print("❌ Invalid mode. Skipping this question.")
        continue

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