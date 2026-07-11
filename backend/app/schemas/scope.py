from pydantic import BaseModel


class ScopeUpdateRequest(BaseModel):
    level: str  # "world" | "continent" (country/state land in a later milestone)
    id: str  # e.g. "world", "europe"


class ScopeResponse(BaseModel):
    level: str
    id: str
    label: str
