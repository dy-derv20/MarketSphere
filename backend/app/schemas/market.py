from pydantic import BaseModel


class OHLCVPoint(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class MarketSeries(BaseModel):
    symbol: str
    label: str
    ohlcv: list[OHLCVPoint]


class MarketResponse(BaseModel):
    series: list[MarketSeries]
