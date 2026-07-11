from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, layouts, market, news, regions, scope, session
from app.config import settings
from app.db.session import Base, engine
from app.models import layout as layout_models  # noqa: F401
from app.models import market_bar as market_bar_models  # noqa: F401
from app.models import news_article as news_article_models  # noqa: F401
from app.models import session as session_models  # noqa: F401

app = FastAPI(title="MarketSphere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router, prefix="/api")
app.include_router(scope.router, prefix="/api")
app.include_router(regions.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(layouts.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
