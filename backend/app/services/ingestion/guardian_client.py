import asyncio
from datetime import datetime

import httpx

from app.config import settings

GUARDIAN_URL = "https://content.guardianapis.com/search"

# Guardian section ids we query directly, each mapped to a continent/country at the
# query level (not inferred from per-article tags, since exact geographic tag ids
# like "world/europe" are not verified against the live tag API - see plan risk note).
# "world"/"politics"/"business" cover international stories but aren't reliably
# single-continent, so they're left unclassified (continent=None -> shows in world scope).
SECTION_GEO = {
    "us-news": ("north-america", "US"),
    "australia-news": ("oceania", "AU"),
    "uk-news": ("europe", "GB"),
    "world": (None, None),
    "politics": (None, None),
    "business": (None, None),
}


async def _fetch_section(client: httpx.AsyncClient, section: str, from_date: str) -> list[dict]:
    params = {
        "api-key": settings.guardian_api_key,
        "section": section,
        "order-by": "newest",
        "from-date": from_date,
        "page-size": 50,
        "show-fields": "bodyText,thumbnail",
    }
    try:
        response = await client.get(GUARDIAN_URL, params=params, timeout=10)
        data = response.json()
    except Exception:
        return []
    return data.get("response", {}).get("results", [])


def _parse_published(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


async def fetch_articles(since: datetime) -> list[dict]:
    if not settings.guardian_api_key:
        return []

    from_date = since.strftime("%Y-%m-%d")
    async with httpx.AsyncClient() as client:
        section_results = await asyncio.gather(
            *(_fetch_section(client, section, from_date) for section in SECTION_GEO)
        )

    normalized: dict[str, dict] = {}
    for section, raw_articles in zip(SECTION_GEO.keys(), section_results):
        continent, country = SECTION_GEO[section]
        for a in raw_articles:
            url = a.get("webUrl", "")
            if not url:
                continue
            published_at = _parse_published(a.get("webPublicationDate", ""))
            if published_at is None:
                continue
            fields = a.get("fields", {})
            normalized[url] = {
                "source": "guardian",
                "url": url,
                "title": a.get("webTitle", ""),
                "body": fields.get("bodyText") or None,
                "summary": None,
                "domain": "theguardian.com",
                "image_url": fields.get("thumbnail") or None,
                "language": "en",
                "country": country,
                "continent": continent,
                "topics": [a.get("sectionId")] if a.get("sectionId") else None,
                "sentiment_score": None,
                "published_at": published_at,
            }
    return list(normalized.values())
