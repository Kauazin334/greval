# Runtime configuration.

from dataclasses import dataclass
import os


def _csv(name: str) -> tuple[str, ...]:
    return tuple(
        value.strip().rstrip("/")
        for value in os.getenv(name, "").split(",")
        if value.strip()
    )


@dataclass(frozen=True)
class Settings:
    environment: str
    cors_origins: tuple[str, ...]
    session_secret: str
    admin_username: str
    admin_password_hash: str
    cookie_secure: bool


def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("ENVIRONMENT", "production").lower(),
        cors_origins=_csv("CORS_ORIGINS"),
        session_secret=os.getenv("SESSION_SECRET", ""),
        admin_username=os.getenv("ADMIN_USERNAME", ""),
        admin_password_hash=os.getenv("ADMIN_PASSWORD_HASH", ""),
        cookie_secure=os.getenv("COOKIE_SECURE", "true").lower() == "true",
    )


def validate_runtime_settings(settings: Settings) -> None:
    # Authentication was removed from the public frontend. Do not prevent the
    # API from starting because optional admin/session settings are absent.
    return
