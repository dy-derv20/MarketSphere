from datetime import datetime

from pydantic import BaseModel


class NewsItem(BaseModel):
    source: str
    title: str
    url: str
    domain: str | None
    body: str | None
    summary: str | None
    image_url: str | None
    language: str | None
    country: str | None
    continent: str | None
    sentiment_score: float | None
    published_at: datetime

    model_config = {"from_attributes": True}


class NewsResponse(BaseModel):
    articles: list[NewsItem]
