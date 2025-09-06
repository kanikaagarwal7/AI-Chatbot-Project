import fitz
import os
import uuid
import gridfs
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
fs = gridfs.GridFS(db)  # Create a GridFS instance
chat_collection = db["cat_talk"]
session_collection = db["chat_sessions"]

# Upload pdf file to MongoDB using GridFS
file_path = "4thsemcorrected.pdf"  # Change this to your file name
with open(file_path, "rb") as f:
    file_id = fs.put(f, filename="4thsemcorrected.pdf")

# Upload txt file to MongoDB using GridFS
file_path = "cat.txt"  # Change this to your file name
with open(file_path, "rb") as f:
    file_id = fs.put(f, filename="cat.txt")

# Upload doc file to MongoDB using GridFS
file_path = "Bff.docx"  # Change this to your file name
with open(file_path, "rb") as f:
    file_id = fs.put(f, filename="Bff.docx")    

print("File uploaded successfully with ID:", file_id)

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

# Upload cat.txt to GridFS and read it
try:
    with open("cat.txt", "rb") as txt_file:
        txt_file_id = fs.put(txt_file, filename="cat.txt")
        print(f"✅ Uploaded cat.txt to GridFS with ID: {txt_file_id}")
        txt_file.seek(0)
        txt_content = txt_file.read().decode("utf-8")
except FileNotFoundError:
    print("❌ cat.txt file not found.")
    txt_content = ""

# Upload 4thsemcorrected.pdf to GridFS and extract text
pdf_path = "4thsemcorrected.pdf"
pdf_content = ""
if os.path.exists(pdf_path):
    with open(pdf_path, "rb") as pdf_file:
        pdf_file_id = fs.put(pdf_file, filename="4thsemcorrected.pdf")
        print(f"✅ Uploaded PDF to GridFS with ID: {pdf_file_id}")

    # Extract pdf text using PyMuPDF
    doc = fitz.open(pdf_path)
    for page in doc:
        pdf_content += page.get_text()
    doc.close()
else:
    print("❌ 4thsemcorrected.pdf file not found.")

# Combine for AI use
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
        model="jamba-large",
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