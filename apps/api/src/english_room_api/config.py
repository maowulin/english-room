from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ENGLISH_ROOM_",
        extra="ignore",
    )

    environment: str = "development"
    cors_origins: tuple[str, ...] = ()
    tencent_sdk_app_id: int | None = None
    tencent_secret_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
