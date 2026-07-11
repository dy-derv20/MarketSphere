import asyncio

import httpx

from app.services.cache import TTLCache

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
_cache = TTLCache(ttl_seconds=300)


async def _fetch_articles(params: dict) -> list[dict]:
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(GDELT_URL, params=params)
            return response.json().get("articles", [])
        except Exception:
            if attempt == 0:
                await asyncio.sleep(2)
    return []


async def get_world_news() -> list[dict]:
    cached = _cache.get("world")
    if cached is not None:
        return cached

    params = {
        "query": "(economy OR markets OR stocks OR finance)",
        "mode": "ArtList",
        "format": "json",
        "timespan": "24h",
        "maxrecords": "20",
        "sort": "DateDesc",
    }

    articles = await _fetch_articles(params)

    normalized = [
        {
            "title": a.get("title", ""),
            "url": a.get("url", ""),
            "domain": a.get("domain", ""),
            "published_at": a.get("seendate", ""),
            "language": a.get("language", ""),
            "source_country": a.get("sourcecountry", ""),
        }
        for a in articles
    ]

    _cache.set("world", normalized)
    return normalized
