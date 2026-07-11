from pydantic import BaseModel


class Framing(BaseModel):
    theme: str
    description: str


class PerspectiveResponse(BaseModel):
    summary: str
    dominant_framings: list[Framing]
    tone_market_divergence: str
    divergence_score: float
