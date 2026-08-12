"""Ingresos y ajustes de stock (SF-3.1)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import Product, StockMovement, StockMovementKind, Supplier, User
from ..schemas import StockMovementCreate, StockMovementOut


def _movement_out(m: StockMovement, *, stock_after: int | None = None) -> StockMovementOut:
    return StockMovementOut(
        id=m.id,
        product_id=m.product_id,
        supplier_id=m.supplier_id,
        kind=m.kind,
        quantity=m.quantity,
        unit_cost_usd=m.unit_cost_usd,
        notes=m.notes,
        created_by_id=m.created_by_id,
        created_at=m.created_at,
        product_name=m.product.name if m.product else None,
        supplier_name=m.supplier.name if m.supplier else None,
        created_by_name=m.created_by.full_name if m.created_by else None,
        stock_after=stock_after,
    )


def create_stock_movement(
    db: Session,
    payload: StockMovementCreate,
    *,
    actor: User,
) -> StockMovementOut:
    product = db.query(Product).filter(Product.id == payload.product_id, Product.is_active.is_(True)).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if payload.supplier_id is not None:
        supplier = (
            db.query(Supplier)
            .filter(Supplier.id == payload.supplier_id, Supplier.is_active.is_(True))
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=400, detail="Proveedor no válido")

    new_stock = product.stock + payload.quantity
    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente: hay {product.stock}, ajuste {payload.quantity}",
        )

    movement = StockMovement(
        product_id=product.id,
        supplier_id=payload.supplier_id,
        kind=payload.kind,
        quantity=payload.quantity,
        unit_cost_usd=payload.unit_cost_usd,
        notes=payload.notes,
        created_by_id=actor.id,
    )
    product.stock = new_stock
    db.add(movement)
    db.add(product)
    db.commit()

    loaded = (
        db.query(StockMovement)
        .options(
            joinedload(StockMovement.product),
            joinedload(StockMovement.supplier),
            joinedload(StockMovement.created_by),
        )
        .filter(StockMovement.id == movement.id)
        .one()
    )
    return _movement_out(loaded, stock_after=new_stock)


def list_stock_movements(db: Session, *, limit: int = 50) -> list[StockMovementOut]:
    rows = (
        db.query(StockMovement)
        .options(
            joinedload(StockMovement.product),
            joinedload(StockMovement.supplier),
            joinedload(StockMovement.created_by),
        )
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_movement_out(m) for m in rows]
