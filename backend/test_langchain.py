from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

# 1. Configure LangChain to use the local LiteLLM proxy
llm = ChatOpenAI(
    openai_api_base="http://localhost:4000", # Your local LiteLLM proxy URL
    openai_api_key="sk-1234",                # LiteLLM accepts any string by default unless configured otherwise
    model_name="Qwen3-30B-A3B-Instruct-FP8",
    temperature=0.0
)

# 2. Create your prompt using LangChain message objects
messages = [
    SystemMessage(content="You are a helpful and concise AI assistant."),
    HumanMessage(content="Explain what a proxy server is in one short sentence.")
]

# 3. Invoke the model and print the response
try:
    print("Connecting to local LiteLLM proxy...\n")
    response = llm.invoke(messages)
    print("Response:")
    print(response.content)
except Exception as e:
    print(f"An error occurred: {e}")
