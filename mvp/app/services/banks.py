"""Cuentas bancarias / movimientos de cobro."""

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models import (
    BankAccount,
    BankAccountType,
    BankMovement,
    BankMovementKind,
    CurrencyCode,
    PaymentMethod,
    Sale,
    SalePayment,
    User,
)
from ..schemas import BankAccountCreate, BankAccountOut, BankAccountUpdate, BankMovementOut

CASH_METHODS = {
    PaymentMethod.cash_usd,
    PaymentMethod.cash_ves,
    PaymentMethod.cash_eur,
}


def _balance_for(db: Session, account_id: int) -> Decimal:
    income = (
        db.query(func.coalesce(func.sum(BankMovement.amount), 0))
        .filter(
            BankMovement.bank_account_id == account_id,
            BankMovement.kind == BankMovementKind.income,
        )
        .scalar()
    )
    expense = (
        db.query(func.coalesce(func.sum(BankMovement.amount), 0))
        .filter(
            BankMovement.bank_account_id == account_id,
            BankMovement.kind == BankMovementKind.expense,
        )
        .scalar()
    )
    return Decimal(income) - Decimal(expense)


def _account_out(db: Session, account: BankAccount) -> BankAccountOut:
    return BankAccountOut(
        id=account.id,
        name=account.name,
        bank_name=account.bank_name,
        account_type=account.account_type,
        currency=account.currency,
        pay_hint=account.pay_hint,
        holder_name=account.holder_name,
        is_active=account.is_active,
        sort_order=account.sort_order,
        balance=_balance_for(db, account.id),
        created_at=account.created_at,
    )


def list_bank_accounts(
    db: Session,
    *,
    active_only: bool = False,
    currency: CurrencyCode | None = None,
) -> list[BankAccountOut]:
    q = db.query(BankAccount).order_by(BankAccount.sort_order.asc(), BankAccount.id.asc())
    if active_only:
        q = q.filter(BankAccount.is_active.is_(True))
    if currency is not None:
        q = q.filter(BankAccount.currency == currency)
    return [_account_out(db, a) for a in q.all()]


def create_bank_account(db: Session, payload: BankAccountCreate) -> BankAccountOut:
    account = BankAccount(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return _account_out(db, account)


def update_bank_account(db: Session, account_id: int, payload: BankAccountUpdate) -> BankAccountOut:
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(account, key, value)
    db.add(account)
    db.commit()
    db.refresh(account)
    return _account_out(db, account)


def list_movements(
    db: Session,
    *,
    bank_account_id: int | None = None,
    limit: int = 50,
) -> list[BankMovementOut]:
    q = (
        db.query(BankMovement)
        .options(joinedload(BankMovement.bank_account))
        .order_by(BankMovement.created_at.desc())
    )
    if bank_account_id is not None:
        q = q.filter(BankMovement.bank_account_id == bank_account_id)
    rows = q.limit(limit).all()
    return [
        BankMovementOut(
            id=m.id,
            bank_account_id=m.bank_account_id,
            kind=m.kind,
            amount=m.amount,
            currency=m.currency,
            payment_method=m.payment_method,
            reference=m.reference,
            notes=m.notes,
            sale_id=m.sale_id,
            sale_payment_id=m.sale_payment_id,
            created_at=m.created_at,
            account_name=m.bank_account.name if m.bank_account else None,
        )
        for m in rows
    ]


def resolve_cash_account(db: Session, currency: CurrencyCode) -> BankAccount | None:
    return (
        db.query(BankAccount)
        .filter(
            BankAccount.is_active.is_(True),
            BankAccount.account_type == BankAccountType.cash,
            BankAccount.currency == currency,
        )
        .order_by(BankAccount.sort_order.asc())
        .first()
    )


def resolve_payment_account(
    db: Session,
    *,
    payment_method: PaymentMethod,
    currency: CurrencyCode,
    bank_account_id: int | None,
) -> BankAccount | None:
    if payment_method == PaymentMethod.credit:
        return None

    if bank_account_id is not None:
        account = (
            db.query(BankAccount)
            .filter(BankAccount.id == bank_account_id, BankAccount.is_active.is_(True))
            .first()
        )
        if not account:
            raise HTTPException(status_code=400, detail="Cuenta de cobro inválida")
        return account

    if payment_method in CASH_METHODS:
        return resolve_cash_account(db, currency)

    # Intentar mapear método → tipo de cuenta
    type_map = {
        PaymentMethod.zelle: BankAccountType.zelle,
        PaymentMethod.pago_movil: BankAccountType.pago_movil,
        PaymentMethod.transfer_ves: BankAccountType.bank,
        PaymentMethod.transfer_usd: BankAccountType.bank,
        PaymentMethod.usdt: BankAccountType.usdt,
    }
    wanted = type_map.get(payment_method)
    if wanted:
        account = (
            db.query(BankAccount)
            .filter(
                BankAccount.is_active.is_(True),
                BankAccount.account_type == wanted,
                BankAccount.currency == currency,
            )
            .order_by(BankAccount.sort_order.asc())
            .first()
        )
        if account:
            return account
    return resolve_cash_account(db, currency)


def record_sale_collection(
    db: Session,
    *,
    sale: Sale,
    actor: User,
    amount: Decimal | None = None,
    payment_method: PaymentMethod | None = None,
    bank_account_id: int | None = None,
    payment_reference: str | None = None,
    payment_evidence: str | None = None,
    notes: str | None = None,
) -> SalePayment | None:
    """Registra cobro (contado o abono) y genera movimiento bancario si aplica."""
    method = payment_method or sale.payment_method
    if method == PaymentMethod.credit:
        return None

    pay_amount = amount if amount is not None else Decimal(sale.total_amount)
    account = resolve_payment_account(
        db,
        payment_method=method,
        currency=sale.currency,
        bank_account_id=bank_account_id or sale.bank_account_id,
    )

    payment = SalePayment(
        sale_id=sale.id,
        amount=pay_amount,
        currency=sale.currency,
        payment_method=method,
        bank_account_id=account.id if account else None,
        payment_reference=payment_reference or sale.payment_reference,
        payment_evidence=payment_evidence or sale.payment_evidence,
        notes=notes,
        received_by_id=actor.id,
    )
    db.add(payment)
    db.flush()

    if account:
        movement = BankMovement(
            bank_account_id=account.id,
            kind=BankMovementKind.income,
            amount=pay_amount,
            currency=sale.currency,
            payment_method=method,
            reference=payment.payment_reference,
            notes=notes or f"Cobro OV-{sale.id}",
            sale_id=sale.id,
            sale_payment_id=payment.id,
            created_by_id=actor.id,
        )
        db.add(movement)

    return payment
