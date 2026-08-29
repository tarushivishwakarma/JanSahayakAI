from fastapi import APIRouter, HTTPException
from .schemas import ChatRequest
from .service import generate_chat_response

router = APIRouter()

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Handle chat interactions using the LLM service.
    """
    try:
        reply = await generate_chat_response(request)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
