from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

# SQLite 需要 check_same_thread=False 以配合多线程的 FastAPI
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Stage 1 用 create_all 起步；进入多服务后切换到 Alembic 迁移
    from . import models  # noqa: F401  确保模型已注册

    Base.metadata.create_all(bind=engine)
    _lightweight_migrations()


def _lightweight_migrations() -> None:
    """对已存在的表补列（SQLite ALTER TABLE ADD COLUMN）。

    create_all 不会改已存在的表，这里手动补。只做"加可空列"这种安全操作，
    不做改类型/删列/改约束。生产应换 Alembic。
    """
    from sqlalchemy import inspect, text

    insp = inspect(engine)

    def _add_columns_if_missing(table: str, cols: list[tuple[str, str]]) -> None:
        if table not in insp.get_table_names():
            return
        existing = {c["name"] for c in insp.get_columns(table)}
        with engine.begin() as conn:
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

    # PageEvent: 加 IP / 国家字段
    _add_columns_if_missing(
        "page_events",
        [
            ("ip", "TEXT"),
            ("country_code", "TEXT"),
            ("country_name", "TEXT"),
        ],
    )
    # User: 加注册 IP / 国家字段
    _add_columns_if_missing(
        "users",
        [
            ("signup_ip", "TEXT"),
            ("signup_country", "TEXT"),
        ],
    )
