"""Ventas de primer nivel (SF-1.8) y venta en visita abierta."""

import json
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models import (
    Client,
    CurrencyCode,
    PaymentMethod,
    Sale,
    SaleOrigin,
    User,
    UserRole,
    Visit,
    VisitStatus,
)
from ..schemas import SaleCreate, SaleIn
from ..timeutil import CARACAS, now_caracas
from .banks import record_sale_collection
from .catalog_visibility import assert_seller_can_use_products
from .fx import resolve_usd_to_ves
from .visits import apply_sale_to_inventory


def _allocate_sale_code(db: Session, *, sale_id: int) -> str:
    """OV-AAMMDD-HHMM-0001 — correlativo del día en hora Caracas."""
    now = now_caracas()
    start = datetime.combine(now.date(), time.min, tzinfo=CARACAS).astimezone(timezone.utc)
    end = start + timedelta(days=1)
    prior = (
        db.query(func.count(Sale.id))
        .filter(Sale.created_at >= start, Sale.created_at < end, Sale.id != sale_id)
        .scalar()
        or 0
    )
    return f"OV-{now.strftime('%y%m%d')}-{now.strftime('%H%M')}-{int(prior) + 1:04d}"


def _stamp_quote_snapshot(raw: str | None, *, code: str) -> str | None:
    """Guarda el snapshot y fija el código definitivo de la OV."""
    if not raw or not raw.strip():
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return raw
        data["code"] = code
        data["confirmed"] = True
        return json.dumps(data, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        return raw


def _persist_sale(
    db: Session,
    *,
    sale_in: SaleIn,
    seller: User,
    client_id: int,
    visit_id: int | None,
    origin: SaleOrigin,
) -> Sale:
    if not sale_in.items:
        raise HTTPException(status_code=400, detail="La venta requiere al menos un producto")

    assert_seller_can_use_products(db, seller, [line.product_id for line in sale_in.items])

    if sale_in.local_uuid:
        existing = db.query(Sale).filter(Sale.local_uuid == sale_in.local_uuid).first()
        if existing:
            return (
                db.query(Sale)
                .options(joinedload(Sale.items), joinedload(Sale.client))
                .filter(Sale.id == existing.id)
                .one()
            )

    total, items = apply_sale_to_inventory(db, sale_in)
    payment_method = PaymentMethod.credit if sale_in.is_credit else sale_in.payment_method
    fx_rate = None
    if sale_in.currency == CurrencyCode.VES:
        fx_rate = resolve_usd_to_ves(db)
        if fx_rate is None:
            raise HTTPException(
                status_code=400,
                detail="No hay tasa FX del día: el supervisor debe cargarla en /api/fx",
            )
    else:
        # Conservar tasa del día en snapshot/consulta aunque la OV sea USD
        fx_rate = resolve_usd_to_ves(db)

    sale = Sale(
        visit_id=visit_id,
        seller_id=seller.id,
        client_id=client_id,
        origin=origin,
        currency=sale_in.currency,
        payment_method=payment_method,
        bank_account_id=None if sale_in.is_credit else sale_in.bank_account_id,
        payment_reference=None if sale_in.is_credit else sale_in.payment_reference,
        payment_evidence=None if sale_in.is_credit else sale_in.payment_evidence,
        total_amount=total,
        is_credit=sale_in.is_credit,
        apply_iva=sale_in.apply_iva,
        fx_rate_usd_ves=fx_rate,
        notes=sale_in.notes,
        quote_snapshot=sale_in.quote_snapshot,
        local_uuid=sale_in.local_uuid,
        created_offline=sale_in.created_offline,
        items=items,
    )
    db.add(sale)
    db.flush()
    sale.quote_snapshot = _stamp_quote_snapshot(
        sale_in.quote_snapshot, code=_allocate_sale_code(db, sale_id=sale.id)
    )

    if not sale_in.is_credit:
        record_sale_collection(
            db,
            sale=sale,
            actor=seller,
            payment_method=payment_method,
            bank_account_id=sale_in.bank_account_id,
            payment_reference=sale_in.payment_reference,
            payment_evidence=sale_in.payment_evidence,
        )

    db.commit()
    return (
        db.query(Sale)
        .options(joinedload(Sale.items), joinedload(Sale.client))
        .filter(Sale.id == sale.id)
        .one()
    )


def create_sale_for_open_visit(db: Session, visit: Visit, sale_in: SaleIn, *, seller: User) -> Sale:
    """Registra OV en visita en_curso; la visita sigue abierta hasta cerrarla."""
    if visit.status != VisitStatus.en_curso:
        raise HTTPException(status_code=400, detail="Solo puedes vender en una visita en curso")
    if seller.role == UserRole.vendedor and visit.seller_id != seller.id:
        raise HTTPException(status_code=403, detail="No puedes vender en visitas de otro vendedor")
    if visit.sale is not None or (
        db.query(Sale.id).filter(Sale.visit_id == visit.id).first() is not None
    ):
        raise HTTPException(status_code=400, detail="Esta visita ya tiene una venta registrada")

    return _persist_sale(
        db,
        sale_in=sale_in,
        seller=seller,
        client_id=visit.client_id,
        visit_id=visit.id,
        origin=SaleOrigin.visita,
    )


def create_sale_without_visit(db: Session, payload: SaleCreate, *, seller: User) -> Sale:
    if payload.origin == SaleOrigin.visita:
        raise HTTPException(
            status_code=400,
            detail="Las ventas de visita se crean desde la visita abierta (POST /api/visits/{id}/sale)",
        )
    client = db.query(Client).filter(Client.id == payload.client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    sale_in = SaleIn(**payload.model_dump(exclude={"client_id"}))
    return _persist_sale(
        db,
        sale_in=sale_in,
        seller=seller,
        client_id=client.id,
        visit_id=None,
        origin=payload.origin,
    )


def list_sales_for_user(db: Session, user: User, *, limit: int = 100) -> list[Sale]:
    query = (
        db.query(Sale)
        .options(joinedload(Sale.items), joinedload(Sale.client))
        .order_by(Sale.created_at.desc())
    )
    if user.role == UserRole.vendedor:
        query = query.filter(Sale.seller_id == user.id)
    return query.limit(limit).all()
