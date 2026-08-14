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
    _add_column_if_missing(engine, "visits", "closed_at", "TIMESTAMPTZ")
    _add_column_if_missing(engine, "sales", "fx_rate_usd_ves", "NUMERIC(14,4)")
    _add_column_if_missing(engine, "sales", "bank_account_id", "INTEGER")
    _add_column_if_missing(engine, "sales", "payment_reference", "VARCHAR(64)")
    _add_column_if_missing(engine, "sales", "payment_evidence", "TEXT")
    _add_column_if_missing(engine, "sales", "quote_snapshot", "TEXT")
    _add_column_if_missing(engine, "sales", "apply_iva", "BOOLEAN NOT NULL DEFAULT FALSE")
    _add_column_if_missing(engine, "sale_payments", "bank_account_id", "INTEGER")
    _add_column_if_missing(engine, "sale_payments", "payment_reference", "VARCHAR(64)")
    _add_column_if_missing(engine, "sale_payments", "payment_evidence", "TEXT")

    # Extender enum PaymentMethod si es nativo en Postgres
    with engine.begin() as conn:
        try:
            conn.execute(
                text(
                    """
                    DO $$ BEGIN
                      ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'pago_movil';
                    EXCEPTION
                      WHEN duplicate_object THEN null;
                      WHEN undefined_object THEN null;
                    END $$;
                    """
                )
            )
        except Exception:
            pass
