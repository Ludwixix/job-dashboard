"""Database session factory and SQLite WAL configuration for SQLAlchemy.

Provides SQLAlchemy 2.0 engine, scoped sessionmaker, and transaction context
managers configured with SQLite Write-Ahead Logging (WAL) mode, 5000ms busy timeout,
and foreign key enforcement.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings


def get_default_db_path() -> str:
    """Resolve the default SQLite database path from environment or settings."""
    env_dir = os.environ.get("JOB_DASHBOARD_DATA_DIR")
    if env_dir:
        data_dir = Path(env_dir)
    else:
        try:
            settings = Settings()
            data_dir = Path(settings.data_dir)
        except Exception:
            data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)
    return str(data_dir / "jobs.sqlite3")


_engines: dict[str, Engine] = {}
_session_factories: dict[str, sessionmaker] = {}


def get_engine(db_path: str | None = None) -> Engine:
    """Obtain or initialize a cached SQLAlchemy engine with SQLite WAL pragmas."""
    target_path = db_path or get_default_db_path()
    if target_path in _engines:
        return _engines[target_path]

    # Handle sqlite url vs raw path
    if target_path.startswith("sqlite:///"):
        url = target_path
    elif target_path == ":memory:":
        url = "sqlite:///:memory:"
    else:
        url = f"sqlite:///{Path(target_path).resolve()}"

    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30.0},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.execute("PRAGMA synchronous=NORMAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
        finally:
            cursor.close()

    _engines[target_path] = engine
    _session_factories[target_path] = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    return engine


def get_session_factory(db_path: str | None = None) -> sessionmaker:
    """Return the sessionmaker factory bound to the engine for the given db_path."""
    target_path = db_path or get_default_db_path()
    get_engine(target_path)
    return _session_factories[target_path]


def get_session(db_path: str | None = None) -> Generator[Session, None, None]:
    """Dependency generator for obtaining an isolated SQLAlchemy session."""
    factory = get_session_factory(db_path)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def db_session_scope(db_path: str | None = None) -> Generator[Session, None, None]:
    """Context manager providing an atomic transactional SQLAlchemy session."""
    factory = get_session_factory(db_path)
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
