from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import CurrencyCode, User
from ..schemas import BankAccountCreate, BankAccountOut, BankAccountUpdate, BankMovementOut, PayableOut
from ..services import banks as bank_svc
from ..services import payables as payable_svc

router = APIRouter(prefix="/api", tags=["finance"])


@router.get("/banks", response_model=list[BankAccountOut])
def get_banks(
    active_only: bool = Query(False),
    currency: CurrencyCode | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Vendedores solo ven cuentas activas (para elegir destino de cobro)
    only_active = active_only or user.role.value == "vendedor"
    return bank_svc.list_bank_accounts(db, active_only=only_active, currency=currency)


@router.post("/banks", response_model=BankAccountOut)
def post_bank(
    payload: BankAccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_supervisor),
):
    return bank_svc.create_bank_account(db, payload)


@router.patch("/banks/{account_id}", response_model=BankAccountOut)
def patch_bank(
    account_id: int,
    payload: BankAccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_supervisor),
):
    return bank_svc.update_bank_account(db, account_id, payload)


@router.get("/banks/movements", response_model=list[BankMovementOut])
def get_movements(
    bank_account_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_supervisor),
):
    return bank_svc.list_movements(db, bank_account_id=bank_account_id, limit=limit)


@router.get("/payables", response_model=list[PayableOut])
def get_payables(
    open_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(require_supervisor),
):
    return payable_svc.list_payables(db, open_only=open_only)
