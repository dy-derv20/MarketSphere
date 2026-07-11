import asyncio
from datetime import datetime

import httpx

from app.services.ingestion.geo_tagging import country_to_continent, country_to_iso2

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

DEFAULT_QUERY = "(economy OR markets OR stocks OR finance)"
POLITICAL_QUERY = "(government OR election OR policy OR president OR parliament)"


async def _fetch_json(params: dict) -> dict:
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(GDELT_URL, params=params)
            return response.json()
        except Exception:
            if attempt == 0:
                await asyncio.sleep(2)
    return {}


def _parse_seendate(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%SZ")
    except ValueError:
        return None


def _normalize(raw_articles: list[dict]) -> list[dict]:
    normalized = []
    for a in raw_articles:
        published_at = _parse_seendate(a.get("seendate", ""))
        if published_at is None:
            continue
        source_country = a.get("sourcecountry") or None
        normalized.append(
            {
                "source": "gdelt",
                "url": a.get("url", ""),
                "title": a.get("title", ""),
                "body": None,
                "summary": None,
                "domain": a.get("domain") or None,
                "image_url": None,
                "language": a.get("language") or None,
                "country": country_to_iso2(source_country),
                "continent": country_to_continent(source_country),
                "topics": None,
                "sentiment_score": None,
                "published_at": published_at,
            }
        )
    return normalized


async def fetch_articles(since: datetime, max_records: int = 100) -> list[dict]:
    days = max(1, (datetime.utcnow() - since).days)
    timespan = f"{days}d"

    results: list[dict] = []
    for query in (DEFAULT_QUERY, POLITICAL_QUERY):
        params = {
            "query": query,
            "mode": "ArtList",
            "format": "json",
            "timespan": timespan,
            "maxrecords": str(max_records),
            "sort": "DateDesc",
        }
        data = await _fetch_json(params)
        results.extend(_normalize(data.get("articles", [])))

    deduped: dict[str, dict] = {}
    for article in results:
        if article["url"]:
            deduped[article["url"]] = article
    return list(deduped.values())
