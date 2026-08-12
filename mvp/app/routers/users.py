from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_supervisor
from ..database import get_db
from ..models import User, UserRole
from ..schemas import UserOut

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
