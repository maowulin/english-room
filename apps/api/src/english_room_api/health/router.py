from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

SERVICE_NAME = "english-room-api"


class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]


router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(service=SERVICE_NAME, status="ok")
