import logging
import time
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.config import settings

logger = logging.getLogger(__name__)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enforce foreign key constraints in SQLite."""
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_app_engine(database_url: str) -> Engine:
    """Create SQLAlchemy engine with automatic fallback to SQLite if PostgreSQL is unreachable."""
    if database_url.startswith("sqlite"):
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=NullPool if settings.environment == "testing" else None,
            echo=settings.environment == "development",
        )

    try:
        eng = create_engine(
            database_url,
            poolclass=NullPool if settings.environment == "testing" else None,
            pool_pre_ping=True,
            pool_recycle=300,
            echo=settings.environment == "development",
        )
        # Test connection immediately
        with eng.connect():
            pass
        logger.info(f"Connected to primary database: {database_url}")
        return eng
    except Exception as e:
        logger.warning(
            f"Could not connect to PostgreSQL ({e}). "
            f"Gracefully falling back to local SQLite database (sqlite:///./kabaadlink.db) for zero blockers."
        )
        return create_engine(
            "sqlite:///./kabaadlink.db",
            connect_args={"check_same_thread": False},
            echo=settings.environment == "development",
        )


engine = create_app_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_with_retry(max_retries: int = 5, retry_interval: float = 1.0) -> None:
    """Initialize database tables idempotently, falling back to SQLite if needed."""
    from app.models import Base

    global engine, SessionLocal
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database schema initialized successfully")
            return
        except Exception as e:
            if attempt == max_retries - 1:
                # Last resort fallback if engine wasn't already SQLite
                if not str(engine.url).startswith("sqlite"):
                    logger.warning(f"Retries failed on {engine.url}. Switching to SQLite fallback.")
                    engine = create_engine(
                        "sqlite:///./kabaadlink.db",
                        connect_args={"check_same_thread": False},
                    )
                    SessionLocal.configure(bind=engine)
                    Base.metadata.create_all(bind=engine)
                    logger.info("Database initialized successfully on SQLite fallback")
                    return
                logger.error(f"Failed to initialize database: {e}")
                raise
            logger.warning(
                f"Database init attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {retry_interval}s..."
            )
            time.sleep(retry_interval)