from datetime import datetime

import httpx

from app.config import settings
from app.services.entity_resolver import COMPANIES
from app.services.ingestion.geo_tagging import fips_to_continent, fips_to_iso2

ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query"

# Kept to two topics per run - Alpha Vantage's free tier is rate-limited to a
# handful of requests/day, so ingestion favors breadth-per-call over per-continent
# granularity (see plan risk note).
TOPICS = ("financial_markets", "economy_macro")

_TICKER_TO_FIPS = {entry["ticker"]: entry["country_fips"] for entry in COMPANIES.values()}


def _parse_published(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%S")
    except ValueError:
        return None


def _resolve_geo(ticker_sentiment: list[dict]) -> tuple[str | None, str | None]:
    for entry in ticker_sentiment:
        fips = _TICKER_TO_FIPS.get(entry.get("ticker"))
        if fips:
            return fips_to_continent(fips), fips_to_iso2(fips)
    return None, None


async def _fetch_topic(client: httpx.AsyncClient, topic: str, time_from: str) -> list[dict]:
    params = {
        "function": "NEWS_SENTIMENT",
        "apikey": settings.alpha_vantage_api_key,
        "topics": topic,
        "time_from": time_from,
        "sort": "LATEST",
        "limit": 200,
    }
    try:
        response = await client.get(ALPHA_VANTAGE_URL, params=params, timeout=10)
        data = response.json()
    except Exception:
        return []
    return data.get("feed", [])


async def fetch_articles(since: datetime) -> list[dict]:
    if not settings.alpha_vantage_api_key:
        return []

    time_from = since.strftime("%Y%m%dT%H%M")
    normalized: dict[str, dict] = {}
    async with httpx.AsyncClient() as client:
        for topic in TOPICS:
            for a in await _fetch_topic(client, topic, time_from):
                url = a.get("url", "")
                if not url:
                    continue
                published_at = _parse_published(a.get("time_published", ""))
                if published_at is None:
                    continue
                continent, country = _resolve_geo(a.get("ticker_sentiment", []))
                topics = [t.get("topic") for t in a.get("topics", []) if t.get("topic")]
                normalized[url] = {
                    "source": "alpha_vantage",
                    "url": url,
                    "title": a.get("title", ""),
                    "body": None,
                    "summary": a.get("summary") or None,
                    "domain": a.get("source_domain") or None,
                    "image_url": a.get("banner_image") or None,
                    "language": "en",
                    "country": country,
                    "continent": continent,
                    "topics": topics or None,
                    "sentiment_score": a.get("overall_sentiment_score"),
                    "published_at": published_at,
                }
    return list(normalized.values())
