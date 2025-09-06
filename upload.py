import fitz
import os
import uuid
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from ai21 import AI21Client
from ai21.models.chat import ChatMessage
import gridfs

# Load environment variables
load_dotenv()

# Get API key and MongoDB URI from environment
api_key = os.getenv('AI21_API_KEY')
mongo_client = MongoClient("mongodb://localhost:27017")  # Update if using Atlas
db = mongo_client["chat_history_db"]
fs = gridfs.GridFS(db)  # Create a GridFS instance
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

# Ask whether to upload documents
upload_choice = input("Do you want to upload documents? (yes/no): ").strip().lower()
doc_content = ""
if upload_choice == "yes":
    # Upload txt file
    try:
        with open("cat.txt", "rb") as txt_file:
            txt_file_id = fs.put(txt_file, filename="cat.txt")
            print(f"✅ Uploaded cat.txt to GridFS with ID: {txt_file_id}")
            txt_file.seek(0)
            txt_content = txt_file.read().decode("utf-8")
    except FileNotFoundError:
        print("❌ cat.txt file not found.")
        txt_content = ""

    # Upload PDF file
    pdf_content = ""
    pdf_path = "4thsemcorrected.pdf"
    if os.path.exists(pdf_path):
        with open(pdf_path, "rb") as pdf_file:
            pdf_file_id = fs.put(pdf_file, filename="4thsemcorrected.pdf")
            print(f"✅ Uploaded PDF to GridFS with ID: {pdf_file_id}")
        doc = fitz.open(pdf_path)
        for page in doc:
            pdf_content += page.get_text()
        doc.close()
    else:
        print("❌ 4thsemcorrected.pdf file not found.")

    # Upload DOCX file
    try:
        with open("Bff.docx", "rb") as docx_file:
            docx_file_id = fs.put(docx_file, filename="Bff.docx")
            print(f"✅ Uploaded Bff.docx to GridFS with ID: {docx_file_id}")
    except FileNotFoundError:
        print("❌ Bff.docx file not found.")

    doc_content = txt_content + "\n\n" + pdf_content

# Start question-answer loop
while True:
    ask_choice = input("\nDo you want to ask a question? (yes/exit): ").strip().lower()
    if ask_choice == "exit":
        print("👋 Chat ended.")
        break

    # Ask mode
    mode = input("Choose mode: (1) Local documents or (2) Global knowledge: ").strip()

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

    user_input = input("Enter your question: ").strip()
    if user_input.lower() == "exit":
        print("👋 Chat ended.")
        break

    # Initialize AI21 client
    client = AI21Client(api_key=api_key)
    messages = [
        ChatMessage(content=system, role="system"),
        ChatMessage(content=user_input, role="user"),
    ]

    chat_completions = client.chat.completions.create(
        messages=messages,
        model="jamba-large",
    )

    response = chat_completions.choices[0].message.content
    print("\n🧠 AI Response:", response)

    chat_record = {
        "session_id": session_id,
        "question": user_input,
        "answer": response,
        "timestamp": datetime.now(timezone.utc)
    }
    chat_collection.insert_one(chat_record)
