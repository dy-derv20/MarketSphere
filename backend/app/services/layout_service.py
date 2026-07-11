from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.layout import Layout
from app.schemas.panel import PanelConfig


async def create_layout(db: AsyncSession, name: str, config: PanelConfig, session_id: UUID | None) -> Layout:
    layout = Layout(name=name, config=config.model_dump(), session_id=session_id)
    db.add(layout)
    await db.commit()
    await db.refresh(layout)
    return layout


async def list_layouts(db: AsyncSession, session_id: UUID | None) -> list[Layout]:
    stmt = select(Layout).order_by(Layout.created_at.desc())
    if session_id is not None:
        stmt = stmt.where(Layout.session_id == session_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_layout(db: AsyncSession, layout_id: UUID) -> Layout | None:
    return await db.get(Layout, layout_id)
