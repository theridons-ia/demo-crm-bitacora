from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import User
from ..schemas import FxRateOut, FxRateUpsert
from ..services.fx import get_today_out, list_rates, refresh_from_sources, upsert_rate

router = APIRouter(prefix="/api/fx", tags=["fx"])


@router.get("/today", response_model=FxRateOut)
def fx_today(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    on_date: date | None = Query(default=None),
):
    """Tasa del día (default hoy Caracas) o la más reciente anterior."""
    row = get_today_out(db, on_date)
    if not row:
        raise HTTPException(status_code=404, detail="No hay tasa FX cargada")
    return row


@router.get("", response_model=list[FxRateOut])
def fx_list(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_rates(db)


@router.post("/refresh", response_model=FxRateOut)
def fx_refresh(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Captura USD BCV, EUR BCV y USDT (fuentes SPTCA) y guarda el snapshot de hoy."""
    return refresh_from_sources(db, actor=current_user)


@router.put("", response_model=FxRateOut)
def fx_upsert(
    payload: FxRateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Crea o actualiza la tasa de una fecha (supervisor)."""
    return upsert_rate(db, payload, actor=current_user)
