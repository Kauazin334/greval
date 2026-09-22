from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import logging
from pathlib import Path
from routers.players import router as players_router
from lib.config import get_settings, validate_runtime_settings


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, db, ensure_indexes


# Startup runs before the yield, shutdown after it. Add your own setup/teardown here.
@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_settings(get_settings())
    await ensure_indexes()
    yield
    client.close()


# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Team Database API", "status": "online"}


api_router.include_router(players_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=list(get_settings().cors_origins) or ["https://kauazin334.github.io"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
MAX_REQUEST_BYTES = 11 * 1024 * 1024


@app.middleware('http')
async def security_headers(request: Request, call_next):
    content_length = request.headers.get('content-length')
    if content_length and content_length.isdigit() and int(content_length) > MAX_REQUEST_BYTES:
        return Response(status_code=413, content='Request too large')
    response = await call_next(request)
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'no-referrer')
    response.headers.setdefault('Cache-Control', 'no-store')
    if get_settings().cookie_secure:
        response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    return response

# Include the router in the main app. Keep this as the final registration statement.
app.include_router(api_router)
