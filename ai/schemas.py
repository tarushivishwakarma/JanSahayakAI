from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$", description="Role: user, assistant, or system")
    content: str = Field(..., min_length=1, max_length=4000, description="Message text (max 4000 characters)")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=50, description="Conversation history (max 50 messages)")
    user_context: Optional[Dict[str, Any]] = None
    document_context: Optional[Dict[str, Any]] = None
    scheme_context: Optional[Dict[str, Any]] = None
    language: Optional[str] = Field("en", max_length=10, description="Response language: 'en' or 'hi'")
