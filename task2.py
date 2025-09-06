# from dotenv import load_dotenv
# import os
# from ai21 import AI21Client
# from ai21.models.chat import ChatMessage

# # Load environment variables from .env file
# load_dotenv()

# # Get API key from environment
# api_key = os.getenv('AI21_API_KEY')

# client = AI21Client(api_key=api_key)

# system = "You're a support engineer in a SaaS company"
# # Get input from user
# user_input = input("Ask your question: ")
# messages = [
#     ChatMessage(content=system, role="system"),
#     ChatMessage(content=user_input, role="user"),
# ]

# chat_completions = client.chat.completions.create(
#     messages=messages,
#     model="jamba-mini-1.6-2025-03",
# )

# print(chat_completions.choices[0].message.content)
