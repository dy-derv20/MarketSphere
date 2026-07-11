import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str]
    url: Mapped[str]
    title: Mapped[str]
    body: Mapped[str | None]
    summary: Mapped[str | None]
    domain: Mapped[str | None]
    image_url: Mapped[str | None]
    language: Mapped[str | None]
    country: Mapped[str | None]
    continent: Mapped[str | None]
    topics: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    sentiment_score: Mapped[float | None]
    published_at: Mapped[datetime]
    ingested_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (UniqueConstraint("source", "url", name="uq_news_source_url"),)
