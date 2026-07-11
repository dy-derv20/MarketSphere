from fastapi import APIRouter

from app.schemas.news import NewsResponse
from app.services.news_service import get_world_news

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=NewsResponse)
async def get_news():
    articles = await get_world_news()
    return NewsResponse(articles=articles)
