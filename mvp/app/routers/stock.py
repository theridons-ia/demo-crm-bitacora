from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_supervisor
from ..database import get_db
from ..models import User
from ..schemas import StockMovementCreate, StockMovementOut
from ..services.stock import create_stock_movement, list_stock_movements

router = APIRouter(prefix="/api/stock-movements", tags=["stock"])


@router.get("", response_model=list[StockMovementOut])
def get_movements(
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    return list_stock_movements(db)


@router.post("", response_model=StockMovementOut)
def post_movement(
    payload: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    return create_stock_movement(db, payload, actor=current_user)
