import os
import json
import httpx
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Configure environment variables
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo") # Default model
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1") # Default generic base URL

# Load schemes data once to keep in memory for reference
SCHEMES_DATA = []
try:
    # Path is relative to the backend directory
    schemes_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data", "schemes.json")
    with open(schemes_path, "r", encoding="utf-8") as f:
        SCHEMES_DATA = json.load(f)
except Exception as e:
    print(f"Warning: Could not load schemes data for LLM service: {e}")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[Dict[str, Any]] = None
    document_context: Optional[Dict[str, Any]] = None
    scheme_context: Optional[Dict[str, Any]] = None
    language: Optional[str] = "en"

async def generate_chat_response(request: ChatRequest) -> str:
    """
    Generates a response from the LLM based on the conversation history and provided context.
    Uses an agnostic OpenAI-compatible REST API format.
    """
    if not LLM_API_KEY:
        # Fallback if no API key is provided
        raise ValueError("LLM_API_KEY is not configured.")

    # Construct System Prompt with context
    system_prompt = (
        "You are an AI assistant for JanSahayakAI, helping Indian citizens find government schemes, "
        "understand documents, and navigate applications.\n"
        "RULES:\n"
        "- Never hallucinate government schemes, eligibility criteria, benefits, application links, or document requirements.\n"
        "- Use the provided application context to answer. If the information is not in the context, clearly state that it is unavailable.\n"
        "- Keep answers simple, accurate, and easy to understand.\n"
        f"- The user's preferred language is {request.language}. Please respond in this language.\n\n"
    )

    if request.user_context:
        system_prompt += f"USER PROFILE CONTEXT:\n{json.dumps(request.user_context, indent=2)}\n\n"

    if request.scheme_context:
        system_prompt += f"SCHEME CONTEXT (User is asking about this specific scheme):\n{json.dumps(request.scheme_context, indent=2)}\n\n"
    elif request.document_context:
        system_prompt += f"DOCUMENT CONTEXT (User has uploaded a document with these extracted fields. Explain them):\n{json.dumps(request.document_context, indent=2)}\n\n"
    else:
        # Provide general schemes info if no specific context
        # Limit to basic info to avoid token limit if schemes list is large
        basic_schemes = [{"name": s.get("name"), "benefit": s.get("benefit")} for s in SCHEMES_DATA]
        system_prompt += f"AVAILABLE SCHEMES SUMMARY:\n{json.dumps(basic_schemes, indent=2)}\n\n"

    api_messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for msg in request.messages:
        api_messages.append({"role": msg.role, "content": msg.content})

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": LLM_MODEL,
        "messages": api_messages,
        "temperature": 0.3
    }

    # Remove trailing slash if present
    base_url = LLM_BASE_URL.rstrip("/")
    endpoint = f"{base_url}/chat/completions"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(endpoint, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM API Error: {e}")
            raise Exception("Failed to get response from AI service.")
