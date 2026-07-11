import asyncio

from google import genai
from google.genai.errors import ServerError

from app.config import settings

client = genai.Client(api_key=settings.gemini_api_key)


async def generate_with_retry(**kwargs):
    for attempt in range(2):
        try:
            return await client.aio.models.generate_content(**kwargs)
        except ServerError:
            if attempt == 0:
                await asyncio.sleep(2)
            else:
                raise
