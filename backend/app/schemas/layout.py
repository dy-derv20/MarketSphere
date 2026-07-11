from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.panel import PanelConfig


class LayoutCreateRequest(BaseModel):
    name: str
    config: PanelConfig
    session_id: UUID | None = None


class LayoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID | None
    name: str
    config: dict
    created_at: datetime
    updated_at: datetime
