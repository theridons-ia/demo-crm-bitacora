"""Cuentas por cobrar / abonos (SF-3.2)."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import PaymentMethod, Sale, SalePayment, User
from ..schemas import ReceivableOut, SalePaymentCreate, SalePaymentOut
from .banks import record_sale_collection


def _paid_amount(sale: Sale) -> Decimal:
    return sum((p.amount for p in sale.payments), Decimal("0"))


def _payment_out(p: SalePayment) -> SalePaymentOut:
    return SalePaymentOut(
        id=p.id,
        sale_id=p.sale_id,
        amount=p.amount,
        currency=p.currency,
        payment_method=p.payment_method,
        bank_account_id=p.bank_account_id,
        payment_reference=p.payment_reference,
        notes=p.notes,
        received_by_id=p.received_by_id,
        created_at=p.created_at,
        received_by_name=p.received_by.full_name if p.received_by else None,
    )


def _receivable_out(sale: Sale) -> ReceivableOut:
    paid = _paid_amount(sale)
    total = Decimal(sale.total_amount)
    return ReceivableOut(
        sale_id=sale.id,
        client_id=sale.client_id,
        client_name=sale.client.name if sale.client else None,
        seller_id=sale.seller_id,
        seller_name=sale.seller.full_name if sale.seller else None,
        currency=sale.currency,
        total_amount=total,
        paid_amount=paid,
        balance=total - paid,
        created_at=sale.created_at,
        notes=sale.notes,
        payments=[_payment_out(p) for p in sorted(sale.payments, key=lambda x: x.created_at)],
    )


def list_receivables(
    db: Session,
    *,
    open_only: bool = True,
    limit: int = 100,
) -> list[ReceivableOut]:
    sales = (
        db.query(Sale)
        .options(
            joinedload(Sale.client),
            joinedload(Sale.seller),
            joinedload(Sale.payments).joinedload(SalePayment.received_by),
        )
        .filter(Sale.is_credit.is_(True))
        .order_by(Sale.created_at.desc())
        .limit(limit)
        .all()
    )
    rows = [_receivable_out(s) for s in sales]
    if open_only:
        rows = [r for r in rows if r.balance > 0]
    return rows


def register_payment(
    db: Session,
    sale_id: int,
    payload: SalePaymentCreate,
    *,
    actor: User,
) -> ReceivableOut:
    sale = (
        db.query(Sale)
        .options(
            joinedload(Sale.client),
            joinedload(Sale.seller),
            joinedload(Sale.payments).joinedload(SalePayment.received_by),
        )
        .filter(Sale.id == sale_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if not sale.is_credit:
        raise HTTPException(status_code=400, detail="Solo se abonan ventas a crédito")

    paid = _paid_amount(sale)
    balance = Decimal(sale.total_amount) - paid
    if payload.amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"El abono ({payload.amount}) supera el saldo ({balance})",
        )

    if payload.payment_method == PaymentMethod.credit:
        raise HTTPException(status_code=400, detail="El abono no puede ser a crédito")

    record_sale_collection(
        db,
        sale=sale,
        actor=actor,
        amount=payload.amount,
        payment_method=payload.payment_method,
        bank_account_id=payload.bank_account_id,
        payment_reference=payload.payment_reference,
        payment_evidence=payload.payment_evidence,
        notes=payload.notes,
    )
    db.commit()

    sale = (
        db.query(Sale)
        .options(
            joinedload(Sale.client),
            joinedload(Sale.seller),
            joinedload(Sale.payments).joinedload(SalePayment.received_by),
        )
        .filter(Sale.id == sale_id)
        .one()
    )
    return _receivable_out(sale)
