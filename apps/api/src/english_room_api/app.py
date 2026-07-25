from typing import Any

from fastapi import FastAPI

from english_room_api.auth.router import router as auth_router
from english_room_api.health.router import router as health_router
from english_room_api.rooms.router import router as rooms_router
from english_room_api.scoring.router import router as scoring_router

OPENAPI_TAGS: list[dict[str, Any]] = [
    {"name": "health", "description": "Service availability"},
    {"name": "auth", "description": "Future client and TRTC credential issuance"},
    {"name": "rooms", "description": "Future room lifecycle and membership"},
    {"name": "scoring", "description": "Future per-player scoring jobs"},
]


def create_app() -> FastAPI:
    application = FastAPI(
        title="English Room API",
        version="0.1.0",
        openapi_tags=OPENAPI_TAGS,
    )
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(rooms_router)
    application.include_router(scoring_router)
    return application


app = create_app()
