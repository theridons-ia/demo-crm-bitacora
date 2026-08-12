"""Ventas de primer nivel (SF-1.8): mostrador / online sin visita."""

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import Client, Sale, SaleOrigin, User, UserRole
from ..schemas import SaleCreate, SaleIn
from .visits import apply_sale_to_inventory


def create_sale_without_visit(db: Session, payload: SaleCreate, *, seller: User) -> Sale:
    if payload.origin == SaleOrigin.visita:
        raise HTTPException(
            status_code=400,
            detail="Las ventas con origen visita se crean al cerrar la visita",
        )
    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta requiere al menos un producto")

    client = db.query(Client).filter(Client.id == payload.client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if payload.local_uuid:
        existing = db.query(Sale).filter(Sale.local_uuid == payload.local_uuid).first()
        if existing:
            return (
                db.query(Sale)
                .options(joinedload(Sale.items), joinedload(Sale.client))
                .filter(Sale.id == existing.id)
                .one()
            )

    sale_in = SaleIn(**payload.model_dump(exclude={"client_id"}))
    total, items = apply_sale_to_inventory(db, sale_in)
    sale = Sale(
        visit_id=None,
        seller_id=seller.id,
        client_id=client.id,
        origin=payload.origin,
        currency=payload.currency,
        payment_method=payload.payment_method,
        total_amount=total,
        is_credit=payload.is_credit,
        notes=payload.notes,
        local_uuid=payload.local_uuid,
        created_offline=payload.created_offline,
        items=items,
    )
    db.add(sale)
    db.commit()
    return (
        db.query(Sale)
        .options(joinedload(Sale.items), joinedload(Sale.client))
        .filter(Sale.id == sale.id)
        .one()
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
