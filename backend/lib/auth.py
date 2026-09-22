# Cookie sessions, authentication and CSRF protection for the staff-only API.

from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import time
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

from lib.config import Settings, get_settings
from lib.db import db


ALGORITHM = 'HS256'
SESSION_COOKIE = 'greval_session'
CSRF_COOKIE = 'greval_csrf'
SESSION_HOURS = 8
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
router = APIRouter(prefix='/auth', tags=['auth'])
_attempts: dict[str, deque[float]] = defaultdict(deque)
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class SessionUser(BaseModel):
    username: str
    role: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _client_key(request: Request, username: str) -> str:
    address = request.client.host if request.client else 'unknown'
    return hashlib.sha256(f'{address}:{username.lower()}'.encode()).hexdigest()


def _check_attempts(key: str) -> None:
    now = time.monotonic()
    values = _attempts[key]
    while values and now - values[0] > WINDOW_SECONDS:
        values.popleft()
    if len(values) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail='Muitas tentativas. Tente novamente mais tarde.')


def _record_failure(key: str) -> None:
    _attempts[key].append(time.monotonic())


def _set_cookies(response: Response, token: str, csrf_token: str, settings: Settings) -> None:
    common = {'secure': settings.cookie_secure, 'samesite': 'strict', 'max_age': SESSION_HOURS * 3600, 'path': '/'}
    response.set_cookie(SESSION_COOKIE, token, httponly=True, **common)
    response.set_cookie(CSRF_COOKIE, csrf_token, httponly=False, **common)


def _clear_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(SESSION_COOKIE, path='/', secure=settings.cookie_secure, samesite='strict')
    response.delete_cookie(CSRF_COOKIE, path='/', secure=settings.cookie_secure, samesite='strict')


async def require_user(request: Request, greval_session: str | None = Cookie(default=None)) -> SessionUser:
    if not greval_session:
        raise HTTPException(status_code=401, detail='Autenticação obrigatória')
    settings = get_settings()
    try:
        payload = jwt.decode(greval_session, settings.session_secret, algorithms=[ALGORITHM])
        session_id, username, role = payload['jti'], payload['sub'], payload['role']
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail='Sessão inválida') from None
    session = await db.sessions.find_one({'id': session_id, 'username': username, 'expires_at': {'$gt': _now()}})
    if not session:
        raise HTTPException(status_code=401, detail='Sessão expirada ou revogada')
    request.state.session = session
    return SessionUser(username=username, role=role)


async def require_admin(user: SessionUser = Depends(require_user)) -> SessionUser:
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail='Permissão insuficiente')
    return user


async def require_csrf(request: Request, greval_csrf: str | None = Cookie(default=None)) -> None:
    supplied = request.headers.get('X-CSRF-Token')
    expected = getattr(request.state, 'session', {}).get('csrf_token')
    if not supplied or not greval_csrf or not expected or not secrets.compare_digest(supplied, greval_csrf) or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=403, detail='Token CSRF inválido')


@router.post('/login', response_model=SessionUser)
async def login(input: LoginInput, request: Request, response: Response):
    settings = get_settings()
    key = _client_key(request, input.username)
    _check_attempts(key)
    password_valid = pwd_context.verify(input.password, settings.admin_password_hash)
    valid = secrets.compare_digest(input.username, settings.admin_username) and password_valid
    if not valid:
        _record_failure(key)
        raise HTTPException(status_code=401, detail='Usuário ou senha inválidos')
    _attempts.pop(key, None)
    issued_at = _now()
    expires_at = issued_at + timedelta(hours=SESSION_HOURS)
    session_id = str(uuid4())
    csrf_token = secrets.token_urlsafe(32)
    await db.sessions.insert_one({'id': session_id, 'username': settings.admin_username, 'role': 'admin', 'csrf_token': csrf_token, 'expires_at': expires_at, 'created_at': issued_at})
    token = jwt.encode({'sub': settings.admin_username, 'role': 'admin', 'jti': session_id, 'iat': issued_at, 'exp': expires_at}, settings.session_secret, algorithm=ALGORITHM)
    _set_cookies(response, token, csrf_token, settings)
    return SessionUser(username=settings.admin_username, role='admin')


@router.get('/me', response_model=SessionUser)
async def me(user: SessionUser = Depends(require_user)):
    return user


@router.post('/logout', status_code=204, dependencies=[Depends(require_user), Depends(require_csrf)])
async def logout(request: Request, response: Response):
    await db.sessions.delete_one({'id': request.state.session['id']})
    _clear_cookies(response, get_settings())
    response.status_code = 204
