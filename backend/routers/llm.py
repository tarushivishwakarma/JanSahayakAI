from fastapi import APIRouter, HTTPException
from services.llm_service import generate_chat_response, ChatRequest

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
