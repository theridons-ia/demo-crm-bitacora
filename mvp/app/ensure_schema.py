"""
Ajustes de esquema ligeros mientras no usamos Alembic (llega en Fase 3).

create_all() crea tablas NUEVAS, pero NO añade columnas a tablas existentes.
Por eso, tras create_all, corremos ALTER seguros (IF NOT EXISTS).
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .database import Base


def ensure_schema(engine: Engine) -> None:
    # Import models so metadata knows every table
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "sales" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("sales")}
    if "origin" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE sales "
                    "ADD COLUMN origin VARCHAR(20) NOT NULL DEFAULT 'visita'"
                )
            )
