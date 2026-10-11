from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from contextlib import contextmanager
import time
import logging

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    poolclass=NullPool if settings.environment == "testing" else None,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=settings.environment == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_with_retry(max_retries: int = 30, retry_interval: float = 2.0) -> None:
    from app.models import Base
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database initialized successfully")
            return
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to initialize database after {max_retries} attempts: {e}")
                raise
            logger.warning(f"Database connection attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)