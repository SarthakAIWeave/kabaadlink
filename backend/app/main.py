from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.db import init_db_with_retry, get_db
from app.seed import ensure_seed
from app.routers import health, demo, rates, requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up KabaadLink API...")
    init_db_with_retry()
    db = next(get_db())
    try:
        ensure_seed(db)
    finally:
        db.close()
    logger.info("Startup complete")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="KabaadLink API",
    description="Hyperlocal scrap pickup marketplace backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.amplifyapp\.com",
    allow_methods=["GET", "POST", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "X-Demo-User-Id"],
)

app.include_router(health.router)
app.include_router(demo.router)
app.include_router(rates.router)
app.include_router(requests.router)


@app.get("/")
def root():
    return {"service": "kabaadlink-api", "version": "1.0.0", "docs": "/docs"}