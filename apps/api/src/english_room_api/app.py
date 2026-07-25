from fastapi import FastAPI

from english_room_api.health.router import router as health_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="English Room API",
        version="0.1.0",
    )
    application.include_router(health_router)
    return application


app = create_app()
