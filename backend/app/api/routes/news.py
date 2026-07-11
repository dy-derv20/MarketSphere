from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.news import NewsItem, NewsResponse
from app.services.news_service import get_news

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=NewsResponse)
async def get_news_route(
    continent: str | None = None,
    country: str | None = None,
    max: int = 40,
    db: AsyncSession = Depends(get_db),
):
    articles = await get_news(db, continent=continent, country=country, limit=max)
    return NewsResponse(articles=[NewsItem.model_validate(a) for a in articles])
