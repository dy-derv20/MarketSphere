import asyncio

from google import genai
from google.genai import types
from google.genai.errors import ServerError

from app.config import settings
from app.schemas.perspective import PerspectiveResponse

_client = genai.Client(api_key=settings.gemini_api_key)

CHAT_MODEL = "gemini-flash-latest"
PERSPECTIVE_MODEL = "gemini-flash-latest"

CHAT_SYSTEM_INSTRUCTION = (
    "You are the analyst assistant embedded in MarketSphere, a globe-based world news and "
    "market exploration tool. Answer using the current scope, news headlines, and market data "
    "provided in context. Be concise and analytical. This is an educational tool, not "
    "investment advice — never phrase answers as buy/sell recommendations."
)

PERSPECTIVE_SYSTEM_INSTRUCTION = (
    "You are a financial-narrative analyst. Given news headlines and market OHLCV data for the "
    "same scope, identify the dominant narrative framing(s) in the coverage, assess whether the "
    "market's actual movement aligns with or diverges from that narrative, and score the "
    "divergence from 0 (fully aligned) to 1 (fully divergent). This is educational analysis, not "
    "investment advice."
)


async def _generate_with_retry(**kwargs):
    for attempt in range(2):
        try:
            return await _client.aio.models.generate_content(**kwargs)
        except ServerError:
            if attempt == 0:
                await asyncio.sleep(2)
            else:
                raise


def _build_context_block(session) -> str:
    lines = [f"Current scope: {session.current_scope}"]
    if session.current_news_snapshot:
        titles = [a.get("title") for a in session.current_news_snapshot.get("articles", [])[:10]]
        lines.append(f"Current headlines in view: {titles}")
    if session.current_market_snapshot:
        labels = [s.get("label") for s in session.current_market_snapshot.get("series", [])]
        lines.append(f"Current market indices in view: {labels}")
    return "\n".join(lines)


async def generate_chat_response(session, message: str) -> str:
    history = [types.Content(role=m.role, parts=[types.Part(text=m.content)]) for m in session.messages]
    context = _build_context_block(session)
    turn = types.Content(role="user", parts=[types.Part(text=f"{context}\n\nUser: {message}")])

    response = await _generate_with_retry(
        model=CHAT_MODEL,
        contents=history + [turn],
        config=types.GenerateContentConfig(system_instruction=CHAT_SYSTEM_INSTRUCTION),
    )
    return response.text


async def generate_perspective(articles: list[dict], market_series: list[dict]) -> PerspectiveResponse:
    headlines = [a.get("title") for a in articles[:15]]
    market_summary = [
        {"label": s["label"], "latest_close": s["ohlcv"][-1]["close"] if s["ohlcv"] else None}
        for s in market_series
    ]
    prompt = f"Headlines:\n{headlines}\n\nMarket snapshot:\n{market_summary}"

    response = await _generate_with_retry(
        model=PERSPECTIVE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=PERSPECTIVE_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=PerspectiveResponse,
        ),
    )
    return response.parsed
