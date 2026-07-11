from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.layout import LayoutCreateRequest, LayoutResponse
from app.services.layout_service import create_layout, get_layout, list_layouts

router = APIRouter(prefix="/layouts", tags=["layouts"])


@router.post("", response_model=LayoutResponse)
async def save_layout(body: LayoutCreateRequest, db: AsyncSession = Depends(get_db)):
    layout = await create_layout(db, body.name, body.config, body.session_id)
    return layout


@router.get("", response_model=list[LayoutResponse])
async def get_layouts(session_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    return await list_layouts(db, session_id)


@router.get("/{layout_id}", response_model=LayoutResponse)
async def get_one_layout(layout_id: UUID, db: AsyncSession = Depends(get_db)):
    layout = await get_layout(db, layout_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout
