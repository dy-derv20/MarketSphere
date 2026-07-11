from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_session
from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.schemas.session import SessionResponse

router = APIRouter(prefix="/session", tags=["session"])


@router.post("", response_model=SessionResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    session = SessionModel()
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(
        session_id=session.id,
        current_scope=session.current_scope,
        current_news_snapshot=session.current_news_snapshot,
        current_market_snapshot=session.current_market_snapshot,
        messages=[],
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session: SessionModel = Depends(get_current_session)):
    return SessionResponse(
        session_id=session.id,
        current_scope=session.current_scope,
        current_news_snapshot=session.current_news_snapshot,
        current_market_snapshot=session.current_market_snapshot,
        messages=session.messages,
    )
