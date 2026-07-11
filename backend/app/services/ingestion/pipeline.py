import asyncio
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.services.ingestion import alpha_vantage_client, gdelt_client, guardian_client

_UPDATE_COLUMNS = [
    "title", "body", "summary", "domain", "image_url", "language",
    "country", "continent", "topics", "sentiment_score", "published_at",
]

_SOURCES = ("gdelt", "guardian", "alpha_vantage")


async def _upsert(db: AsyncSession, articles: list[dict]) -> None:
    if not articles:
        return
    stmt = insert(NewsArticle).values(articles)
    stmt = stmt.on_conflict_do_update(
        index_elements=["source", "url"],
        set_={col: getattr(stmt.excluded, col) for col in _UPDATE_COLUMNS},
    )
    await db.execute(stmt)


async def run_ingestion(since: datetime, db: AsyncSession) -> dict[str, int]:
    results = await asyncio.gather(
        gdelt_client.fetch_articles(since),
        guardian_client.fetch_articles(since),
        alpha_vantage_client.fetch_articles(since),
        return_exceptions=True,
    )

    counts: dict[str, int] = {}
    for source_name, result in zip(_SOURCES, results):
        if isinstance(result, Exception):
            counts[source_name] = 0
            continue
        await _upsert(db, result)
        counts[source_name] = len(result)

    await db.commit()
    return counts
