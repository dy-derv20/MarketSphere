import json
from collections.abc import AsyncIterator

from google.genai import types

from app.services.gemini_service import client

MODEL = "gemini-flash-latest"

SYSTEM_INSTRUCTION = (
    "You are the analyst assistant embedded in a financial news/markets globe app. Answer using "
    "the news headlines and market data provided in context below - that data is fetched live by "
    "the app, so treat it as current. If the question isn't covered by the provided context, "
    "answer from general knowledge but do not present stale information as current. This is an "
    "educational tool, not investment advice - never phrase answers as buy/sell recommendations."
)


def _build_context_block(articles: list[dict], market_series: list[dict]) -> str:
    blocks = []
    if articles:
        headlines = [f"- {a['title']} ({a['country']}, {a['published_at']})" for a in articles[:15]]
        blocks.append("Current headlines:\n" + "\n".join(headlines))
    if market_series:
        summary = [
            f"- {s['label']}: latest close {s['ohlcv'][-1]['close']}" for s in market_series if s.get("ohlcv")
        ]
        blocks.append("Current market data:\n" + "\n".join(summary))
    return "\n\n".join(blocks)


async def stream_answer(
    message: str,
    articles: list[dict] | None = None,
    market_series: list[dict] | None = None,
    recent_history: list[str] | None = None,
) -> AsyncIterator[dict]:
    history_block = f"Recent conversation:\n{chr(10).join(recent_history)}\n\n" if recent_history else ""
    context_block = _build_context_block(articles or [], market_series or [])
    prompt = f"{history_block}{context_block}\n\nUser: {message}"
    citations = [a["url"] for a in (articles or []) if a.get("url")]

    try:
        stream = await client.aio.models.generate_content_stream(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        )
        async for chunk in stream:
            if chunk.text:
                yield {"type": "text", "text": chunk.text}
    except Exception:
        yield {"type": "error", "message": "The response was interrupted. Please try again."}
        return

    yield {"type": "done", "citations": citations}


async def stream_answer_sse(*args, **kwargs) -> AsyncIterator[str]:
    async for event in stream_answer(*args, **kwargs):
        yield f"data: {json.dumps(event)}\n\n"
