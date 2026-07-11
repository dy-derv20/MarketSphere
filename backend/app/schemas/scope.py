from pydantic import BaseModel

from app.schemas.panel import PanelConfig


class ContinentInfo(BaseModel):
    id: str
    label: str


class ScopeConfigResponse(BaseModel):
    scopeConfig: PanelConfig
