from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import FxRate, User
from ..schemas import FxRateOut, FxRateUpsert
from ..services.fx import get_latest_rate, get_rate_for_date, list_rates, upsert_rate

router = APIRouter(prefix="/api/fx", tags=["fx"])


def _with_user(db: Session, row: FxRate) -> FxRate:
    return (
        db.query(FxRate)
        .options(joinedload(FxRate.created_by))
        .filter(FxRate.id == row.id)
        .one()
    )


@router.get("/today", response_model=FxRateOut)
def fx_today(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    on_date: date | None = Query(default=None),
):
    """Tasa del día (default hoy) o la más reciente anterior."""
    day = on_date or date.today()
    row = get_rate_for_date(db, day) or get_latest_rate(db, on_or_before=day)
    if not row:
        raise HTTPException(status_code=404, detail="No hay tasa FX cargada")
    loaded = _with_user(db, row)
    return FxRateOut(
        id=loaded.id,
        rate_date=loaded.rate_date,
        usd_to_ves=loaded.usd_to_ves,
        notes=loaded.notes,
        created_by_id=loaded.created_by_id,
        created_at=loaded.created_at,
        updated_at=loaded.updated_at,
        created_by_name=loaded.created_by.full_name if loaded.created_by else None,
    )


@router.get("", response_model=list[FxRateOut])
def fx_list(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_rates(db)


@router.put("", response_model=FxRateOut)
def fx_upsert(
    payload: FxRateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Crea o actualiza la tasa de una fecha (supervisor)."""
    return upsert_rate(db, payload, actor=current_user)
