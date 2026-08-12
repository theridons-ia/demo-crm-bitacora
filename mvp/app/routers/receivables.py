from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_supervisor
from ..database import get_db
from ..models import User
from ..schemas import ReceivableOut, SalePaymentCreate
from ..services.receivables import list_receivables, register_payment

router = APIRouter(prefix="/api/receivables", tags=["receivables"])


@router.get("", response_model=list[ReceivableOut])
def get_receivables(
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
    open_only: bool = Query(default=True),
):
    """CxC: ventas a crédito con saldo (SF-3.2)."""
    return list_receivables(db, open_only=open_only)


@router.post("/{sale_id}/payments", response_model=ReceivableOut)
def post_payment(
    sale_id: int,
    payload: SalePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    return register_payment(db, sale_id, payload, actor=current_user)
