from uuid import UUID

from pydantic import BaseModel

from app.schemas.panel import PanelConfig


class ChatRequest(BaseModel):
    session_id: UUID
    message: str
    active_view: str = "scope"
    workspace_config: PanelConfig | None = None
    current_scope: str = "world"
