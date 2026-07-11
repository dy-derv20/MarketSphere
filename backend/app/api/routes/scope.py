from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_session
from app.db.session import get_db
from app.models.session import Session as SessionModel
from app.schemas.scope import ScopeResponse, ScopeUpdateRequest
from app.services.market_service import get_world_market_data
from app.services.news_service import get_world_news
from app.services.scope_service import validate_scope

router = APIRouter(prefix="/scope", tags=["scope"])


@router.put("/{session_id}", response_model=ScopeResponse)
async def update_scope(
    body: ScopeUpdateRequest,
    session: SessionModel = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
):
    try:
        label = validate_scope(body.level, body.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    session.current_scope = {"level": body.level, "id": body.id, "label": label}
    session.current_news_snapshot = {"articles": await get_world_news()}
    session.current_market_snapshot = {"series": await get_world_market_data()}
    await db.commit()
    return ScopeResponse(level=body.level, id=body.id, label=label)


@router.get("/{session_id}", response_model=ScopeResponse | None)
async def get_scope(session: SessionModel = Depends(get_current_session)):
    return session.current_scope
