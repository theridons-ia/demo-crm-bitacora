"""Visibilidad de catálogo por vendedor (SF-2.4)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Product, SellerProductVisibility, User, UserRole


def visible_product_ids_for_seller(db: Session, seller_id: int) -> list[int] | None:
    """None = sin restricción (ve todo). Lista = solo esos IDs."""
    rows = (
        db.query(SellerProductVisibility.product_id)
        .filter(SellerProductVisibility.seller_id == seller_id)
        .all()
    )
    if not rows:
        return None
    return [r[0] for r in rows]


def assert_seller_can_use_products(db: Session, seller: User, product_ids: list[int]) -> None:
    if seller.role != UserRole.vendedor:
        return
    allowed = visible_product_ids_for_seller(db, seller.id)
    if allowed is None:
        return
    forbidden = [pid for pid in product_ids if pid not in allowed]
    if forbidden:
        raise HTTPException(
            status_code=403,
            detail=f"Productos fuera de tu catálogo asignado: {forbidden}",
        )


def get_visibility(db: Session, seller_id: int) -> tuple[bool, list[int]]:
    ids = visible_product_ids_for_seller(db, seller_id)
    if ids is None:
        return True, []
    return False, ids


def set_visibility(
    db: Session,
    *,
    seller_id: int,
    unrestricted: bool,
    product_ids: list[int],
) -> tuple[bool, list[int]]:
    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller or seller.role != UserRole.vendedor:
        raise HTTPException(status_code=400, detail="Vendedor no válido")

    db.query(SellerProductVisibility).filter(SellerProductVisibility.seller_id == seller_id).delete()

    if unrestricted:
        db.commit()
        return True, []

    unique_ids = sorted(set(product_ids))
    if unique_ids:
        products = (
            db.query(Product.id)
            .filter(Product.id.in_(unique_ids), Product.is_active.is_(True))
            .all()
        )
        valid = {p[0] for p in products}
        missing = [pid for pid in unique_ids if pid not in valid]
        if missing:
            raise HTTPException(status_code=400, detail=f"Productos inválidos: {missing}")
        for pid in unique_ids:
            db.add(SellerProductVisibility(seller_id=seller_id, product_id=pid))

    db.commit()
    return False, unique_ids
