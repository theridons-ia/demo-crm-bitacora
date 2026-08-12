"""
Ajustes de esquema ligeros mientras no usamos Alembic (llega en Fase 3).

create_all() crea tablas NUEVAS, pero NO añade columnas a tablas existentes.
Por eso, tras create_all, corremos ALTER seguros (IF NOT EXISTS).
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base


def _add_column_if_missing(engine: Engine, table: str, column: str, ddl_type: str) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns(table)}
    if column in columns:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


def ensure_schema(engine: Engine) -> None:
    # Import models so metadata knows every table
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    _add_column_if_missing(engine, "sales", "origin", "VARCHAR(20) NOT NULL DEFAULT 'visita'")
    _add_column_if_missing(engine, "clients", "rif", "VARCHAR(20)")
    _add_column_if_missing(engine, "clients", "ci", "VARCHAR(20)")
    _add_column_if_missing(engine, "suppliers", "rif", "VARCHAR(20)")
    _add_column_if_missing(engine, "suppliers", "ci", "VARCHAR(20)")
    _add_column_if_missing(engine, "clients", "latitude", "NUMERIC(10,7)")
    _add_column_if_missing(engine, "clients", "longitude", "NUMERIC(10,7)")
    _add_column_if_missing(engine, "visits", "gps_skipped", "BOOLEAN NOT NULL DEFAULT FALSE")
    _add_column_if_missing(engine, "visits", "gps_skip_reason", "VARCHAR(255)")
    _add_column_if_missing(engine, "visits", "photo_evidence", "TEXT")
