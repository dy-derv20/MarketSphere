import argparse
import asyncio
from datetime import datetime, timedelta

from app.db.session import async_session_factory
from app.services.ingestion.pipeline import run_ingestion


async def main(days: int) -> None:
    since = datetime.utcnow() - timedelta(days=days)
    async with async_session_factory() as db:
        counts = await run_ingestion(since=since, db=db)
    print(", ".join(f"{source}: {count}" for source, count in counts.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull news from GDELT/Guardian/Alpha Vantage into Postgres.")
    parser.add_argument("--days", type=int, default=3, help="Lookback window in days (default: 3)")
    args = parser.parse_args()
    asyncio.run(main(args.days))
