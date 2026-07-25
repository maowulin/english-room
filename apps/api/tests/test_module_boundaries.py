from english_room_api.app import create_app
from english_room_api.config import get_settings


def test_openapi_describes_planned_business_modules() -> None:
    schema = create_app().openapi()

    tag_names = {tag["name"] for tag in schema["tags"]}

    assert {"auth", "rooms", "scoring"}.issubset(tag_names)
    assert set(schema["paths"]) == {"/health"}


def test_settings_use_safe_development_defaults() -> None:
    settings = get_settings()

    assert settings.environment == "development"
    assert settings.cors_origins == ()
