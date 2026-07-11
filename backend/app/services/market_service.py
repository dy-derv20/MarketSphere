import asyncio

import yfinance as yf

from app.services.cache import TTLCache

_cache = TTLCache(ttl_seconds=300)


def _fetch_ticker_history(ticker: str, period: str, interval: str) -> list[dict]:
    history = yf.Ticker(ticker).history(period=period, interval=interval)
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


async def get_market_data(symbol: str, range_: str = "1mo", interval: str = "1d") -> list[dict]:
    cache_key = f"market:{symbol}:{range_}:{interval}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        ohlcv = await asyncio.to_thread(_fetch_ticker_history, symbol, range_, interval)
    except Exception:
        ohlcv = []

    _cache.set(cache_key, ohlcv)
    return ohlcv
