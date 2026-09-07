from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_context: Optional[Dict[str, Any]] = None
    document_context: Optional[Dict[str, Any]] = None
    scheme_context: Optional[Dict[str, Any]] = None
    language: Optional[str] = "en"
