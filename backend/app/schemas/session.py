from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.panel import PanelConfig


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    scopeConfig: PanelConfig
