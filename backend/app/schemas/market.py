from pydantic import BaseModel


class OHLCVPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class MarketResponse(BaseModel):
    symbol: str
    ohlcv: list[OHLCVPoint]
