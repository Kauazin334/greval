"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    'sessions': [
        IndexModel([('id', ASCENDING)], name='session_id', unique=True),
        IndexModel([('expires_at', ASCENDING)], name='session_expiry', expireAfterSeconds=0),
    ],
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "players": [
        IndexModel([("id", ASCENDING)], name="player_id", unique=True),
        IndexModel([("category", ASCENDING), ("position", ASCENDING)], name="player_category_position"),
        IndexModel([("status", ASCENDING)], name="player_status"),
        IndexModel([("contract_end", ASCENDING)], name="player_contract_end"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                # Existing MongoDB indexes can have older options/names. This should not
                # prevent the API from starting; routes can still use the existing indexes.
                logger.warning("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
