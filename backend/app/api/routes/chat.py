from fastapi import APIRouter, Depends, HTTPException
from google.genai.errors import ServerError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_session
from app.db.session import get_db
from app.models.session import ChatMessage
from app.models.session import Session as SessionModel
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini_service import generate_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{session_id}", response_model=ChatResponse)
async def send_chat_message(
    body: ChatRequest,
    session: SessionModel = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    try:
        reply_text = await generate_chat_response(session, body.message)
    except ServerError:
        raise HTTPException(status_code=503, detail="Gemini is temporarily unavailable, please try again.")

    db.add(ChatMessage(session_id=session.id, role="user", content=body.message))
    model_message = ChatMessage(session_id=session.id, role="model", content=reply_text)
    db.add(model_message)
    await db.commit()
    await db.refresh(model_message)

    return ChatResponse(role=model_message.role, content=model_message.content, created_at=model_message.created_at)
