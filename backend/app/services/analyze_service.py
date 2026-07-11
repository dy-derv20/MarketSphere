from google.genai import types
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.entity_resolver import resolve_company
from app.services.gemini_service import generate_with_retry
from app.services.market_service import get_market_data
from app.services.news_service import get_news

MODEL = "gemini-flash-latest"

SYSTEM_INSTRUCTION = (
    "You are a financial-narrative analyst. Given recent news headlines (with sentiment where "
    "available) and price data for a company's home index, write a short paragraph describing "
    "whether the news coverage coincides with the market movement. Use hedged language - "
    "'coincides with', 'may relate to' - NEVER state or imply causation. This is educational "
    "analysis, not investment advice."
)


class _Verdict(BaseModel):
    narrative: str


async def analyze_entity(db: AsyncSession, company_name: str) -> dict:
    resolved = resolve_company(company_name)
    if resolved is None:
        return {
            "action": "analyze",
            "text": f"I couldn't identify a ticker for '{company_name}'. Could you clarify the company name?",
            "evidence": None,
        }

    # Sequential, not gathered: both calls share one request-scoped AsyncSession, and
    # SQLAlchemy disallows concurrent operations on a single session.
    articles = await get_news(db, country=resolved["country_fips"], limit=20)
    ohlcv = await get_market_data(db, symbol=resolved["index_symbol"])

    sentiments = [a.sentiment_score for a in articles if a.sentiment_score is not None]
    tone_trend = round(sum(sentiments) / len(sentiments), 3) if sentiments else 0.0

    price_change_pct = 0.0
    if len(ohlcv) >= 2 and ohlcv[0]["close"]:
        price_change_pct = round((ohlcv[-1]["close"] - ohlcv[0]["close"]) / ohlcv[0]["close"] * 100, 2)

    headlines = [a.title for a in articles[:15]]
    prompt = (
        f"Company: {company_name} (ticker {resolved['ticker']}, home index {resolved['region']})\n"
        f"Recent headlines: {headlines}\n"
        f"Average sentiment score where available (roughly -1 negative to +1 positive): {tone_trend}\n"
        f"Home index price change over the period: {price_change_pct}%"
    )

    response = await generate_with_retry(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=_Verdict,
        ),
    )

    return {
        "action": "analyze",
        "text": response.parsed.narrative,
        "evidence": {
            "articles_used": [a.url for a in articles[:15]],
            "tone_trend": tone_trend,
            "price_change_pct": price_change_pct,
        },
    }
