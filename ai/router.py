from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from core.security import get_current_user, check_llm_rate_limit
from .schemas import ChatRequest
from .service import generate_chat_response

router = APIRouter()

@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    _rate_limit: None = Depends(check_llm_rate_limit)
):
    """
    Handle chat interactions using the LLM service.
    Protected by Firebase token verification and per-user sliding window rate limiting.
    """
    try:
        reply = await generate_chat_response(request)
        return {"reply": reply}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat endpoint error: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail="Failed to get response from AI service.")

