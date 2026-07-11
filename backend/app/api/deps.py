from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.session import Session as SessionModel


async def get_current_session(session_id: UUID, db: AsyncSession = Depends(get_db)) -> SessionModel:
    result = await db.execute(
        select(SessionModel).options(selectinload(SessionModel.messages)).where(SessionModel.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
