from fastapi import APIRouter

from app.schemas.market import MarketResponse
from app.services.market_service import get_world_market_data

router = APIRouter(prefix="/market", tags=["market"])


@router.get("", response_model=MarketResponse)
async def get_market():
    series = await get_world_market_data()
    return MarketResponse(series=series)
