from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Client, User
from ..schemas import ClientCreate, ClientOut, ClientUpdate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return (
        db.query(Client)
        .filter(Client.is_active.is_(True))
        .order_by(Client.created_at.desc(), Client.id.desc())
        .all()
    )


@router.post("", response_model=ClientOut)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    data = payload.model_dump()
    for key, value in data.items():
        setattr(client, key, value)

    db.add(client)
    db.commit()
    db.refresh(client)
    return client
