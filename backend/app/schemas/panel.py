import uuid
from enum import Enum

from pydantic import BaseModel


class PanelType(str, Enum):
    news = "news"
    market = "market"


class NewsParams(BaseModel):
    country: str | None = None
    continent: str | None = None
    query: str = "(economy OR markets OR stocks OR finance)"
    timespan: str = "24h"
    max: int = 40


class MarketParams(BaseModel):
    symbol: str
    range: str = "1mo"
    interval: str = "1d"


class Panel(BaseModel):
    id: str
    type: PanelType
    title: str
    rationale: str
    params: dict


class PanelConfig(BaseModel):
    version: int = 1
    panels: list[Panel]


def new_panel_id() -> str:
    return f"p_{uuid.uuid4().hex[:8]}"
