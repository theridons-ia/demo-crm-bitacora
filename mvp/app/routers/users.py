from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import hash_password, require_supervisor
from ..database import get_db
from ..models import User, UserRole
from ..schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/sellers", response_model=list[UserOut])
def list_sellers(
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    """Vendedores activos para armar la ruta del día (SF-2.2)."""
    return (
        db.query(User)
        .filter(User.role == UserRole.vendedor, User.is_active.is_(True))
        .order_by(User.full_name.asc())
        .all()
    )


@router.post("", response_model=UserOut)
@router.post("/", response_model=UserOut, include_in_schema=False)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_supervisor),
):
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Ese email ya existe")

    role = payload.role
    if role == UserRole.admin and current.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo admin puede crear otro admin")
    if role == UserRole.supervisor and current.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo admin puede crear supervisores")
    if current.role == UserRole.supervisor:
        role = UserRole.vendedor

    parts = payload.full_name.strip().split()
    initials = (payload.initials or "").strip().upper()
    if not initials:
        initials = (
            f"{parts[0][0]}{parts[1][0]}" if len(parts) > 1 else parts[0][:2]
        ).upper()

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=role,
        initials=initials[:4],
        route_name=(payload.route_name or "").strip() or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
