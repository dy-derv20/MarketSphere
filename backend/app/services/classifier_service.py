from google.genai import types

from app.schemas.classifier import ClassifierResult
from app.services.gemini_service import generate_with_retry

MODEL = "gemini-flash-latest"

SYSTEM_INSTRUCTION = (
    "You are an intent classifier for a financial news/markets chat assistant. "
    "Classify the user's message into exactly one intent:\n"
    "- 'answer': a general question or request for information/explanation "
    "(e.g. 'what's happening in markets today', 'explain what a yield curve is').\n"
    "- 'build': a request to show, add, or remove specific news or market panels "
    "(e.g. 'show me Japanese news and markets', 'now add Korea', 'remove the France panel').\n"
    "- 'analyze': a request connecting news sentiment to a specific company's market movement "
    "(e.g. 'how is the news affecting Tesla's stock').\n"
    "Extract any countries, companies, and topics mentioned as plain names exactly as the user "
    "said them - do not convert country names to codes yourself, a separate step handles that. "
    "Restate the request in one clear sentence."
)


async def classify_intent(message: str, recent_history: list[str] | None = None) -> ClassifierResult:
    history_block = ""
    if recent_history:
        history_block = "Recent conversation:\n" + "\n".join(recent_history) + "\n\n"

    response = await generate_with_retry(
        model=MODEL,
        contents=f"{history_block}User message: {message}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=ClassifierResult,
        ),
    )
    return response.parsed
