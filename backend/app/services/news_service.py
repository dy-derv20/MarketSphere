from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.news_article import NewsArticle
from app.services.ingestion.geo_tagging import FIPS_TO_ISO2

# Sources disagree on how they represent English: Guardian/Alpha Vantage use
# the ISO 639-1 code ("en"), GDELT stores the full language name
# ("English") - both are matched here, case-insensitively. A NULL language
# (unset) is excluded rather than assumed English.
_ENGLISH_LANGUAGE_VALUES = ("en", "english")


async def get_news(
    db: AsyncSession,
    continent: str | None = None,
    country: str | None = None,
    limit: int = 40,
) -> list[NewsArticle]:
    stmt = (
        select(NewsArticle)
        .where(func.lower(NewsArticle.language).in_(_ENGLISH_LANGUAGE_VALUES))
        .order_by(NewsArticle.published_at.desc())
        .limit(limit)
    )
    if continent:
        stmt = stmt.where(NewsArticle.continent == continent)
    if country:
        iso2 = FIPS_TO_ISO2.get(country.upper(), country.upper())
        stmt = stmt.where(NewsArticle.country == iso2)
    result = await db.execute(stmt)
    return list(result.scalars().all())
