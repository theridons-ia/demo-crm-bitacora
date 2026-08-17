"""Tasas del día (Caracas). usd_to_ves = BCV oficial para liquidar VES."""

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..models import FxRate, User
from ..schemas import FxRateOut, FxRateUpsert
from ..timeutil import now_utc, today_caracas
from . import tasas_fuentes


def _out(row: FxRate) -> FxRateOut:
    return FxRateOut(
        id=row.id,
        rate_date=row.rate_date,
        usd_to_ves=row.usd_to_ves,
        eur_to_ves=row.eur_to_ves,
        usdt_to_ves=row.usdt_to_ves,
        usd_source=row.usd_source,
        eur_source=row.eur_source,
        usdt_source=row.usdt_source,
        captured_at=row.captured_at,
        notes=row.notes,
        created_by_id=row.created_by_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        created_by_name=row.created_by.full_name if row.created_by else None,
    )


def _reload(db: Session, row_id: int) -> FxRate:
    return (
        db.query(FxRate)
        .options(joinedload(FxRate.created_by))
        .filter(FxRate.id == row_id)
        .one()
    )


def get_rate_for_date(db: Session, rate_date: date) -> FxRate | None:
    return db.query(FxRate).filter(FxRate.rate_date == rate_date).first()


def get_latest_rate(db: Session, on_or_before: date | None = None) -> FxRate | None:
    query = db.query(FxRate).order_by(FxRate.rate_date.desc())
    if on_or_before is not None:
        query = query.filter(FxRate.rate_date <= on_or_before)
    return query.first()


def resolve_usd_to_ves(db: Session, on_date: date | None = None) -> Decimal | None:
    """Tasa BCV del día o la más reciente anterior (para liquidar VES)."""
    day = on_date or today_caracas()
    row = get_rate_for_date(db, day) or get_latest_rate(db, on_or_before=day)
    return Decimal(row.usd_to_ves) if row else None


def get_today_out(db: Session, on_date: date | None = None) -> FxRateOut | None:
    day = on_date or today_caracas()
    row = get_rate_for_date(db, day) or get_latest_rate(db, on_or_before=day)
    if not row:
        return None
    return _out(_reload(db, row.id))


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
        row.usd_source = "Manual (supervisor)"
        row.notes = payload.notes
        row.created_by_id = actor.id
        if payload.eur_to_ves is not None:
            row.eur_to_ves = payload.eur_to_ves
            row.eur_source = "Manual (supervisor)"
        if payload.usdt_to_ves is not None:
            row.usdt_to_ves = payload.usdt_to_ves
            row.usdt_source = "Manual (supervisor)"
    else:
        row = FxRate(
            rate_date=payload.rate_date,
            usd_to_ves=payload.usd_to_ves,
            eur_to_ves=payload.eur_to_ves,
            usdt_to_ves=payload.usdt_to_ves,
            usd_source="Manual (supervisor)",
            eur_source="Manual (supervisor)" if payload.eur_to_ves is not None else None,
            usdt_source="Manual (supervisor)" if payload.usdt_to_ves is not None else None,
            notes=payload.notes,
            created_by_id=actor.id,
        )
        db.add(row)
    db.commit()
    return _out(_reload(db, row.id))


def _quote_from_snap(snap: dict[str, Any] | None) -> tuple[Decimal, str] | None:
    if not snap or snap.get("valor") is None:
        return None
    valor = Decimal(str(snap["valor"]))
    if valor <= 0:
        return None
    fuente = str(snap.get("fuente") or "").strip() or "Fuente externa"
    return valor, fuente


def refresh_from_sources(db: Session, *, actor: User) -> FxRateOut:
    """Captura USD BCV, EUR BCV y USDT (pack SPTCA) y guarda el snapshot del día."""
    settings = get_settings()
    tasas_fuentes.configure(
        exchangerate_api_key=settings.exchangerate_api_key,
        binance_top_n=settings.binance_top_n,
        yadio_top_n=settings.yadio_top_n,
    )
    try:
        snap = tasas_fuentes.fetch_all()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudieron consultar las fuentes de tasas: {exc}",
        ) from exc

    usd = _quote_from_snap(snap.get("usd_bcv") if isinstance(snap, dict) else None)
    eur = _quote_from_snap(snap.get("eur_bcv") if isinstance(snap, dict) else None)
    usdt = _quote_from_snap(snap.get("usdt") if isinstance(snap, dict) else None)

    day = today_caracas()
    row = get_rate_for_date(db, day)
    if usd is None and row is None:
        raise HTTPException(
            status_code=502,
            detail="No se obtuvo USD BCV (DolarApi, Dolitoday ni ExchangeRate-API)",
        )

    if row is None and usd is not None:
        row = FxRate(
            rate_date=day,
            usd_to_ves=usd[0],
            created_by_id=actor.id,
        )
        db.add(row)

    assert row is not None
    if usd is not None:
        row.usd_to_ves = usd[0]
        row.usd_source = usd[1]
    if eur is not None:
        row.eur_to_ves = eur[0]
        row.eur_source = eur[1]
    if usdt is not None:
        row.usdt_to_ves = usdt[0]
        row.usdt_source = usdt[1]
    row.captured_at = now_utc()
    row.created_by_id = actor.id
    row.notes = "Captura automática (DolarApi / Binance P2P)"
    db.commit()
    return _out(_reload(db, row.id))
