"""Tasa de cambio USD→VES del día (SF-3.3)."""

from datetime import date
from decimal import Decimal

from ..timeutil import today_caracas

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import FxRate, User
from ..schemas import FxRateOut, FxRateUpsert


def _out(row: FxRate) -> FxRateOut:
    return FxRateOut(
        id=row.id,
        rate_date=row.rate_date,
        usd_to_ves=row.usd_to_ves,
        notes=row.notes,
        created_by_id=row.created_by_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        created_by_name=row.created_by.full_name if row.created_by else None,
    )


def get_rate_for_date(db: Session, rate_date: date) -> FxRate | None:
    return db.query(FxRate).filter(FxRate.rate_date == rate_date).first()


def get_latest_rate(db: Session, on_or_before: date | None = None) -> FxRate | None:
    query = db.query(FxRate).order_by(FxRate.rate_date.desc())
    if on_or_before is not None:
        query = query.filter(FxRate.rate_date <= on_or_before)
    return query.first()


def resolve_usd_to_ves(db: Session, on_date: date | None = None) -> Decimal | None:
    """Tasa del día o la más reciente anterior (para liquidar VES)."""
    day = on_date or today_caracas()
    row = get_rate_for_date(db, day) or get_latest_rate(db, on_or_before=day)
    return Decimal(row.usd_to_ves) if row else None


def list_rates(db: Session, *, limit: int = 30) -> list[FxRateOut]:
    rows = (
        db.query(FxRate)
        .options(joinedload(FxRate.created_by))
        .order_by(FxRate.rate_date.desc())
        .limit(limit)
        .all()
    )
    return [_out(r) for r in rows]


def upsert_rate(db: Session, payload: FxRateUpsert, *, actor: User) -> FxRateOut:
    if payload.usd_to_ves <= 0:
        raise HTTPException(status_code=400, detail="La tasa debe ser mayor que 0")

    row = get_rate_for_date(db, payload.rate_date)
    if row:
        row.usd_to_ves = payload.usd_to_ves
        row.notes = payload.notes
        row.created_by_id = actor.id
    else:
        row = FxRate(
            rate_date=payload.rate_date,
            usd_to_ves=payload.usd_to_ves,
            notes=payload.notes,
            created_by_id=actor.id,
        )
        db.add(row)
    db.commit()
    loaded = (
        db.query(FxRate)
        .options(joinedload(FxRate.created_by))
        .filter(FxRate.id == row.id)
        .one()
    )
    return _out(loaded)
