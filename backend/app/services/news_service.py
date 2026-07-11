from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.services.ingestion.geo_tagging import FIPS_TO_ISO2


async def get_news(
    db: AsyncSession,
    continent: str | None = None,
    country: str | None = None,
    limit: int = 40,
) -> list[NewsArticle]:
    stmt = select(NewsArticle).order_by(NewsArticle.published_at.desc()).limit(limit)
    if continent:
        stmt = stmt.where(NewsArticle.continent == continent)
    if country:
        iso2 = FIPS_TO_ISO2.get(country.upper(), country.upper())
        stmt = stmt.where(NewsArticle.country == iso2)
    result = await db.execute(stmt)
    return list(result.scalars().all())
