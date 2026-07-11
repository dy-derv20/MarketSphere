from pydantic import BaseModel


class NewsItem(BaseModel):
    title: str
    url: str
    domain: str
    published_at: str
    language: str
    source_country: str


class NewsResponse(BaseModel):
    articles: list[NewsItem]
