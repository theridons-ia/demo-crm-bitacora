"""Cuentas por pagar (demo piloto)."""

from sqlalchemy.orm import Session

from ..models import PayableInvoice, PayableStatus
from ..schemas import PayableOut


def list_payables(db: Session, *, open_only: bool = True) -> list[PayableOut]:
    q = db.query(PayableInvoice).order_by(PayableInvoice.id.desc())
    rows = q.all()
    if open_only:
        rows = [p for p in rows if p.status != PayableStatus.paid]
    return [
        PayableOut(
            id=p.id,
            supplier_name=p.supplier_name,
            description=p.description,
            amount=p.amount,
            currency=p.currency,
            status=p.status,
            due_date=p.due_date,
            created_at=p.created_at,
        )
        for p in rows
    ]
