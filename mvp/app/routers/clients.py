from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, or_
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import Client, SellerClientAssignment, User, UserRole
from ..schemas import (
    ClientAssignmentsOut,
    ClientAssignmentsUpdate,
    ClientCreate,
    ClientOut,
    ClientUpdate,
)
from ..services.client_assignments import (
    assign_client_to_seller,
    assigned_client_ids_for_seller,
    get_assignments,
    seller_can_see_client,
    set_assignments,
)

router = APIRouter(tags=["clients"])


@router.get("/api/clients", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    seller_id: int | None = Query(default=None, description="Solo supervisor: filtrar por vendedor"),
    for_seller_id: int | None = Query(
        default=None,
        description="Supervisor: cartera de ese vendedor + PDVs sin asignar",
    ),
):
    query = db.query(Client).filter(Client.is_active.is_(True))

    if current_user.role == UserRole.vendedor:
        ids = assigned_client_ids_for_seller(db, current_user.id)
        if not ids:
            return []
        query = query.filter(Client.id.in_(ids))
    elif for_seller_id is not None:
        assigned = assigned_client_ids_for_seller(db, for_seller_id)
        unassigned = ~exists().where(SellerClientAssignment.client_id == Client.id)
        if assigned:
            query = query.filter(or_(Client.id.in_(assigned), unassigned))
        else:
            query = query.filter(unassigned)
    elif seller_id is not None:
        ids = assigned_client_ids_for_seller(db, seller_id)
        if not ids:
            return []
        query = query.filter(Client.id.in_(ids))

    return query.order_by(Client.created_at.desc(), Client.id.desc()).all()


@router.post("/api/clients", response_model=ClientOut)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = Client(**payload.model_dump())
    db.add(client)
    db.flush()
    # Quien crea entra a su cartera (vendedor); supervisor no auto-asigna.
    if current_user.role == UserRole.vendedor:
        assign_client_to_seller(db, current_user.id, client.id)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/api/clients/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not seller_can_see_client(db, current_user, client_id):
        raise HTTPException(status_code=403, detail="No tienes este cliente en tu cartera")

    data = payload.model_dump()
    for key, value in data.items():
        setattr(client, key, value)

    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get(
    "/api/sellers/{seller_id}/client-assignments",
    response_model=ClientAssignmentsOut,
)
def get_client_assignments(
    seller_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    seller = db.query(User).filter(User.id == seller_id, User.role == UserRole.vendedor).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    return ClientAssignmentsOut(seller_id=seller_id, client_ids=get_assignments(db, seller_id))


@router.put(
    "/api/sellers/{seller_id}/client-assignments",
    response_model=ClientAssignmentsOut,
)
def put_client_assignments(
    seller_id: int,
    payload: ClientAssignmentsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    try:
        ids = set_assignments(db, seller_id, payload.client_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ClientAssignmentsOut(seller_id=seller_id, client_ids=ids)
