from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import SaleCreate, SaleListOut, SaleOut
from ..services.sales import create_sale_without_visit, get_sale_for_user, list_sales_for_user

router = APIRouter(prefix="/api/sales", tags=["sales"])


@router.get("", response_model=list[SaleListOut])
def list_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client_id: int | None = Query(default=None),
):
    return list_sales_for_user(db, current_user, client_id=client_id)


@router.post("", response_model=SaleOut)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_sale_without_visit(db, payload, seller=current_user)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_sale_for_user(db, current_user, sale_id)
