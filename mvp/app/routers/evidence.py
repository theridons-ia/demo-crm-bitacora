from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User, UserRole, Visit, VisitAlert, VisitGpsPoint, VisitStatus
from ..schemas import VisitAlertOut, VisitGpsPointCreate, VisitGpsPointOut

router = APIRouter(tags=["visits-evidence"])


def _get_visit_for_user(db: Session, visit_id: int, user: User) -> Visit:
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if user.role == UserRole.vendedor and visit.seller_id != user.id:
        raise HTTPException(status_code=403, detail="No puedes ver visitas de otro vendedor")
    return visit


@router.post("/api/visits/{visit_id}/gps-points", response_model=VisitGpsPointOut)
def add_gps_point(
    visit_id: int,
    payload: VisitGpsPointCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra una muestra del trail GPS (SF-0.3 modelo; UI en SF-1.5)."""
    visit = _get_visit_for_user(db, visit_id, current_user)
    if visit.status not in (VisitStatus.en_curso, VisitStatus.completada):
        raise HTTPException(status_code=400, detail="Solo visitas en curso o completadas")

    point = VisitGpsPoint(
        visit_id=visit.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_m=payload.accuracy_m,
        captured_at=payload.captured_at or datetime.now(timezone.utc),
        source=payload.source,
    )
    db.add(point)
    db.commit()
    db.refresh(point)
    return point


@router.get("/api/visits/{visit_id}/gps-points", response_model=list[VisitGpsPointOut])
def list_gps_points(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_visit_for_user(db, visit_id, current_user)
    return (
        db.query(VisitGpsPoint)
        .filter(VisitGpsPoint.visit_id == visit_id)
        .order_by(VisitGpsPoint.captured_at.asc())
        .all()
    )


@router.get("/api/alerts", response_model=list[VisitAlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inbox de alertas (supervisor ve todas; vendedor solo las suyas)."""
    query = db.query(VisitAlert).order_by(VisitAlert.created_at.desc())
    if current_user.role == UserRole.vendedor:
        query = query.filter(VisitAlert.seller_id == current_user.id)
    return query.limit(100).all()
