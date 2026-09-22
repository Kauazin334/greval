# Runtime configuration. Secrets are intentionally never given insecure defaults.

from dataclasses import dataclass
import os


def _csv(name: str) -> tuple[str, ...]:
    return tuple(value.strip().rstrip(/) for value in os.getenv(name, ").split(,) if value.strip())


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
        environment=os.getenv('ENVIRONMENT', 'production').lower(),
        cors_origins=_csv('CORS_ORIGINS'),
        session_secret=os.getenv('SESSION_SECRET', ''),
        admin_username=os.getenv('ADMIN_USERNAME', ''),
        admin_password_hash=os.getenv('ADMIN_PASSWORD_HASH', ''),
        cookie_secure=os.getenv('COOKIE_SECURE', 'true').lower() == 'true',
    )


def validate_runtime_settings(settings: Settings) -> None:
    errors: list[str] = []
    if not settings.cors_origins:
        errors.append('CORS_ORIGINS deve conter as origens permitidas')
    if '*' in settings.cors_origins:
        errors.append('CORS_ORIGINS não pode conter asterisco')
    if len(settings.session_secret) < 32:
        errors.append('SESSION_SECRET deve ter ao menos 32 caracteres aleatórios')
    if not settings.admin_username:
        errors.append('ADMIN_USERNAME é obrigatório')
    if not settings.admin_password_hash.startswith('$2'):
        errors.append('ADMIN_PASSWORD_HASH deve ser um hash bcrypt')
    if settings.environment == 'production' and not settings.cookie_secure:
        errors.append('COOKIE_SECURE deve ser true em produção')
    if errors:
        raise RuntimeError('Configuração insegura: ' + '; '.join(errors))
