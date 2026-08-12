from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import GpsPointSource, Sale, User, Visit, VisitGpsPoint, VisitStatus
from ..schemas import VisitClose, VisitCreate, VisitOut, VisitStart
from ..services.visits import close_visit_with_optional_sale

router = APIRouter(prefix="/api/visits", tags=["visits"])


def _visit_query(db: Session):
    return db.query(Visit).options(joinedload(Visit.client), joinedload(Visit.sale).joinedload(Sale.items))


@router.get("", response_model=list[VisitOut])
def list_visits(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(Visit)
        .options(joinedload(Visit.client), joinedload(Visit.sale).joinedload(Sale.items))
        .order_by(Visit.created_at.desc())
    )
    if current_user.role.value == "vendedor":
        query = query.filter(Visit.seller_id == current_user.id)
    return query.limit(100).all()


@router.post("", response_model=VisitOut)
def create_visit(
    payload: VisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.local_uuid:
        existing = db.query(Visit).filter(Visit.local_uuid == payload.local_uuid).first()
        if existing:
            return (
                db.query(Visit)
                .options(joinedload(Visit.client), joinedload(Visit.sale).joinedload(Sale.items))
                .filter(Visit.id == existing.id)
                .one()
            )

    now = datetime.now(timezone.utc)
    visit = Visit(
        seller_id=current_user.id,
        client_id=payload.client_id,
        status=payload.status,
        description=payload.description,
        scheduled_date=payload.scheduled_date,
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_accuracy_m=payload.gps_accuracy_m,
        gps_offline=payload.gps_offline,
        gps_captured_at=now if payload.latitude is not None else None,
        visited_at=now if payload.status == VisitStatus.en_curso else None,
        local_uuid=payload.local_uuid,
    )
    db.add(visit)
    db.flush()
    if payload.latitude is not None and payload.longitude is not None:
        db.add(
            VisitGpsPoint(
                visit_id=visit.id,
                latitude=payload.latitude,
                longitude=payload.longitude,
                accuracy_m=payload.gps_accuracy_m,
                captured_at=now,
                source=GpsPointSource.start if payload.status == VisitStatus.en_curso else GpsPointSource.watch,
            )
        )
    db.commit()
    return _visit_query(db).filter(Visit.id == visit.id).one()


@router.post("/{visit_id}/start", response_model=VisitOut)
def start_visit(
    visit_id: int,
    payload: VisitStart | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pasa una visita programada a en_curso; opcionalmente guarda GPS de inicio."""
    body = payload or VisitStart()
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if current_user.role.value == "vendedor" and visit.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes iniciar visitas de otro vendedor")
    if visit.status != VisitStatus.programada:
        raise HTTPException(status_code=400, detail="Solo se pueden iniciar visitas programadas")

    now = datetime.now(timezone.utc)
    visit.status = VisitStatus.en_curso
    visit.visited_at = now
    if body.latitude is not None and body.longitude is not None:
        visit.latitude = body.latitude
        visit.longitude = body.longitude
        visit.gps_accuracy_m = body.gps_accuracy_m
        visit.gps_offline = body.gps_offline
        visit.gps_captured_at = now
        db.add(
            VisitGpsPoint(
                visit_id=visit.id,
                latitude=body.latitude,
                longitude=body.longitude,
                accuracy_m=body.gps_accuracy_m,
                captured_at=now,
                source=GpsPointSource.start,
            )
        )
    db.add(visit)
    db.commit()
    return (
        db.query(Visit)
        .options(joinedload(Visit.client), joinedload(Visit.sale).joinedload(Sale.items))
        .filter(Visit.id == visit_id)
        .one()
    )


@router.post("/{visit_id}/close", response_model=VisitOut)
def close_visit(
    visit_id: int,
    payload: VisitClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if current_user.role.value == "vendedor" and visit.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes cerrar visitas de otro vendedor")

    now = datetime.now(timezone.utc)
    close_visit_with_optional_sale(
        db,
        visit,
        result=payload.result,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        gps_accuracy_m=payload.gps_accuracy_m,
        gps_offline=payload.gps_offline,
        gps_captured_at=payload.gps_captured_at or now,
        sale_in=payload.sale,
        seller_id=current_user.id,
    )
    return (
        db.query(Visit)
        .options(joinedload(Visit.client), joinedload(Visit.sale).joinedload(Sale.items))
        .filter(Visit.id == visit_id)
        .one()
    )
