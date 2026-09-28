"""AERO-TWIN — Database Setup"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import sys
from pathlib import Path

# Ensure backend directory is in sys.path so app.* imports always resolve
_backend_root = str(Path(__file__).resolve().parent.parent.parent)
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.database.models import Base
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Apply SQLite-specific thread safety and timeout settings only when using SQLite
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables() -> None:
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
