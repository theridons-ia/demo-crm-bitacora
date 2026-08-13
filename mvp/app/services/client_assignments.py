"""Asignación de clientes a vendedores (cartera)."""

from sqlalchemy.orm import Session

from ..models import Client, SellerClientAssignment, User, UserRole


def assigned_client_ids_for_seller(db: Session, seller_id: int) -> list[int]:
    rows = (
        db.query(SellerClientAssignment.client_id)
        .filter(SellerClientAssignment.seller_id == seller_id)
        .all()
    )
    return [r[0] for r in rows]


def seller_can_see_client(db: Session, user: User, client_id: int) -> bool:
    if user.role in (UserRole.supervisor, UserRole.admin):
        return True
    if user.role != UserRole.vendedor:
        return False
    return (
        db.query(SellerClientAssignment)
        .filter(
            SellerClientAssignment.seller_id == user.id,
            SellerClientAssignment.client_id == client_id,
        )
        .first()
        is not None
    )


def assign_client_to_seller(db: Session, seller_id: int, client_id: int) -> None:
    exists = (
        db.query(SellerClientAssignment)
        .filter(
            SellerClientAssignment.seller_id == seller_id,
            SellerClientAssignment.client_id == client_id,
        )
        .first()
    )
    if exists:
        return
    db.add(SellerClientAssignment(seller_id=seller_id, client_id=client_id))


def get_assignments(db: Session, seller_id: int) -> list[int]:
    return assigned_client_ids_for_seller(db, seller_id)


def set_assignments(db: Session, seller_id: int, client_ids: list[int]) -> list[int]:
    seller = db.query(User).filter(User.id == seller_id, User.role == UserRole.vendedor).first()
    if not seller:
        raise ValueError("Vendedor no válido")

    unique_ids = sorted({int(cid) for cid in client_ids})
    if unique_ids:
        found = (
            db.query(Client.id)
            .filter(Client.id.in_(unique_ids), Client.is_active.is_(True))
            .all()
        )
        found_ids = {r[0] for r in found}
        missing = [cid for cid in unique_ids if cid not in found_ids]
        if missing:
            raise ValueError(f"Clientes no válidos: {missing}")

    db.query(SellerClientAssignment).filter(SellerClientAssignment.seller_id == seller_id).delete()
    for cid in unique_ids:
        db.add(SellerClientAssignment(seller_id=seller_id, client_id=cid))
    db.commit()
    return unique_ids
