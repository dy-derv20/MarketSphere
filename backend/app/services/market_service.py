import asyncio

import yfinance as yf

from app.services.cache import TTLCache
from app.services.scope_service import REGIONS

_cache = TTLCache(ttl_seconds=300)


def _fetch_ticker_history(ticker: str) -> list[dict]:
    history = yf.Ticker(ticker).history(period="1mo", interval="1d")
    return [
        {
            "date": index.strftime("%Y-%m-%d"),
            "open": round(float(row.Open), 2),
            "high": round(float(row.High), 2),
            "low": round(float(row.Low), 2),
            "close": round(float(row.Close), 2),
            "volume": int(row.Volume),
        }
        for index, row in history.iterrows()
    ]


async def get_world_market_data() -> list[dict]:
    cached = _cache.get("world")
    if cached is not None:
        return cached

    series = []
    for entry in REGIONS:
        try:
            ohlcv = await asyncio.to_thread(_fetch_ticker_history, entry["yf_ticker"])
        except Exception:
            ohlcv = []
        series.append({"symbol": entry["yf_ticker"], "label": entry["region"], "ohlcv": ohlcv})

    _cache.set("world", series)
    return series
