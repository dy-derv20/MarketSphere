import asyncio
from datetime import datetime, timedelta

import yfinance as yf
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_bar import MarketBar

FRESHNESS_WINDOW = timedelta(minutes=5)
FETCH_PERIOD = "3mo"  # generous fixed window so most requested ranges are served from cache

_RANGE_TO_DAYS = {"5d": 5, "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365}


def _slice_range(ohlcv: list[dict], range_: str) -> list[dict]:
    days = _RANGE_TO_DAYS.get(range_)
    return ohlcv if days is None else ohlcv[-days:]


def _fetch_ticker_history(ticker: str, interval: str) -> list[dict]:
    history = yf.Ticker(ticker).history(period=FETCH_PERIOD, interval=interval)
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


async def _read_cached(db: AsyncSession, symbol: str, interval: str) -> list[dict] | None:
    result = await db.execute(
        select(MarketBar).where(MarketBar.symbol == symbol, MarketBar.interval == interval).order_by(MarketBar.date)
    )
    bars = result.scalars().all()
    if not bars:
        return None
    if datetime.utcnow() - max(b.ingested_at for b in bars) > FRESHNESS_WINDOW:
        return None
    return [
        {"date": b.date.strftime("%Y-%m-%d"), "open": b.open, "high": b.high, "low": b.low, "close": b.close, "volume": b.volume}
        for b in bars
    ]


async def _store(db: AsyncSession, symbol: str, interval: str, ohlcv: list[dict]) -> None:
    if not ohlcv:
        return
    rows = [
        {
            "symbol": symbol,
            "interval": interval,
            "date": datetime.strptime(point["date"], "%Y-%m-%d").date(),
            "open": point["open"],
            "high": point["high"],
            "low": point["low"],
            "close": point["close"],
            "volume": point["volume"],
        }
        for point in ohlcv
    ]
    stmt = insert(MarketBar).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["symbol", "interval", "date"],
        set_={
            "open": stmt.excluded.open,
            "high": stmt.excluded.high,
            "low": stmt.excluded.low,
            "close": stmt.excluded.close,
            "volume": stmt.excluded.volume,
            "ingested_at": func.now(),
        },
    )
    await db.execute(stmt)
    await db.commit()


async def get_market_data(db: AsyncSession, symbol: str, range_: str = "1mo", interval: str = "1d") -> list[dict]:
    cached = await _read_cached(db, symbol, interval)
    if cached is not None:
        return _slice_range(cached, range_)

    try:
        ohlcv = await asyncio.to_thread(_fetch_ticker_history, symbol, interval)
    except Exception:
        ohlcv = []

    await _store(db, symbol, interval, ohlcv)
    return _slice_range(ohlcv, range_)
