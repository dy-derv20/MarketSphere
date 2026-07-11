from fastapi import APIRouter

from app.schemas.market import MarketResponse
from app.services.market_service import get_market_data

router = APIRouter(prefix="/market", tags=["market"])


@router.get("", response_model=MarketResponse)
async def get_market_route(symbol: str, range: str = "1mo", interval: str = "1d"):
    ohlcv = await get_market_data(symbol=symbol, range_=range, interval=interval)
    return MarketResponse(symbol=symbol, ohlcv=ohlcv)
