from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, market, news, scope, session
from app.config import settings
from app.db.session import Base, engine
from app.models import session as session_models  # noqa: F401

app = FastAPI(title="MarketSphere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(scope.router)
app.include_router(news.router)
app.include_router(market.router)
app.include_router(chat.router)


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
