from fastapi import APIRouter, HTTPException
from google.genai.errors import ServerError

from app.schemas.perspective import PerspectiveResponse
from app.services.gemini_service import generate_perspective
from app.services.market_service import get_world_market_data
from app.services.news_service import get_world_news

router = APIRouter(prefix="/perspective", tags=["perspective"])


@router.post("", response_model=PerspectiveResponse)
async def get_perspective():
    articles = await get_world_news()
    market_series = await get_world_market_data()
    try:
        return await generate_perspective(articles, market_series)
    except ServerError:
        raise HTTPException(status_code=503, detail="Gemini is temporarily unavailable, please try again.")
