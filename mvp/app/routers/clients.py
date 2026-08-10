from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Client, User
from ..schemas import ClientCreate, ClientOut

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Client).filter(Client.is_active.is_(True)).order_by(Client.name).all()


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
