import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from google.genai.errors import APIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.session import ChatMessage
from app.models.session import Session as SessionModel
from app.schemas.chat import ChatRequest
from app.services.analyze_service import analyze_entity
from app.services.answer_service import stream_answer
from app.services.build_service import build_workspace_config
from app.services.classifier_service import classify_intent
from app.services.entity_resolver import resolve_country_fips
from app.services.news_service import get_news

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_session_with_history(db: AsyncSession, session_id: UUID) -> SessionModel:
    result = await db.execute(
        select(SessionModel).options(selectinload(SessionModel.messages)).where(SessionModel.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _save_turn(db: AsyncSession, session_id: UUID, user_message: str, model_message: str) -> None:
    db.add(ChatMessage(session_id=session_id, role="user", content=user_message))
    db.add(ChatMessage(session_id=session_id, role="model", content=model_message))
    await db.commit()


@router.post("")
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = await _get_session_with_history(db, body.session_id)
    recent_history = [f"{m.role}: {m.content}" for m in session.messages[-10:]]

    try:
        classified = await classify_intent(body.message, recent_history=recent_history)
    except APIError:
        raise HTTPException(status_code=503, detail="Gemini is temporarily unavailable, please try again.")
    intent = classified.intent.value

    if intent == "build":
        try:
            config, notes = await build_workspace_config(
                classified.entities, classified.build_op, body.workspace_config
            )
        except APIError:
            raise HTTPException(status_code=503, detail="Gemini is temporarily unavailable, please try again.")
        reply_summary = notes or f"Updated your workspace with {len(config.panels)} panel(s)."
        await _save_turn(db, session.id, body.message, reply_summary)
        return JSONResponse(
            {
                "action": "build",
                "target": "workspace",
                "config": config.model_dump(),
                "switch_view": True,
                "notes": notes,
            }
        )

    if intent == "analyze":
        company = classified.entities.companies[0] if classified.entities.companies else None
        if not company:
            result = {"action": "analyze", "text": "Which company would you like me to analyze?", "evidence": None}
        else:
            try:
                result = await analyze_entity(db, company)
            except APIError:
                raise HTTPException(status_code=503, detail="Gemini is temporarily unavailable, please try again.")
        await _save_turn(db, session.id, body.message, result["text"])
        return JSONResponse(result)

    # answer - streamed
    country = resolve_country_fips(classified.entities.countries[0]) if classified.entities.countries else None
    articles = await get_news(db, country=country, limit=15)
    full_text_parts: list[str] = []

    async def event_generator():
        async for event in stream_answer(body.message, articles=articles, recent_history=recent_history):
            if event["type"] == "text":
                full_text_parts.append(event["text"])
            yield f"data: {json.dumps(event)}\n\n"
        await _save_turn(db, session.id, body.message, "".join(full_text_parts))

    return StreamingResponse(event_generator(), media_type="text/event-stream")
