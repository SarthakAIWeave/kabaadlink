import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

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
    logger.info("Startup complete and database verified.")
    yield
    logger.info("Shutting down KabaadLink API...")


app = FastAPI(
    title="KabaadLink API",
    description="Hyperlocal scrap pickup marketplace backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Standardized Error Envelope Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": f"HTTP_{exc.status_code}", "message": str(exc.detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_err = exc.errors()[0] if exc.errors() else {"msg": "Validation failed"}
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": first_err.get("msg", "Validation error"),
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected internal server error occurred.",
            }
        },
    )


# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.amplifyapp\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router Registration
app.include_router(health.router)
app.include_router(demo.router)
app.include_router(rates.router)
app.include_router(requests.router)


@app.get("/")
def root():
    return {"service": "kabaadlink-api", "version": "1.0.0", "docs": "/docs"}