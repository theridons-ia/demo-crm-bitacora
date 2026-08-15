import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import AlertType, User, UserRole, Visit, VisitAlert, VisitGpsPoint, VisitStatus
from ..schemas import VisitAlertOut, VisitGpsPointCreate, VisitGpsPointOut

router = APIRouter(tags=["visits-evidence"])


def _get_visit_for_user(db: Session, visit_id: int, user: User) -> Visit:
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if user.role == UserRole.vendedor and visit.seller_id != user.id:
        raise HTTPException(status_code=403, detail="No puedes ver visitas de otro vendedor")
    return visit


def _alert_meta(alert: VisitAlert) -> dict:
    if not alert.meta_json:
        return {}
    try:
        data = json.loads(alert.meta_json)
    except (TypeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _alert_out(alert: VisitAlert) -> VisitAlertOut:
    client = alert.visit.client if alert.visit else None
    meta = _alert_meta(alert)
    assigned = meta.get("assigned_by")
    stop_date = meta.get("scheduled_date")
    stop_time = meta.get("scheduled_time")
    return VisitAlertOut(
        id=alert.id,
        visit_id=alert.visit_id,
        seller_id=alert.seller_id,
        alert_type=alert.alert_type,
        severity=alert.severity,
        message=alert.message,
        meta_json=alert.meta_json,
        acknowledged_at=alert.acknowledged_at,
        created_at=alert.created_at,
        seller_name=alert.seller.full_name if alert.seller else None,
        client_name=client.name if client else None,
        client_id=client.id if client else None,
        assigned_by=assigned if isinstance(assigned, str) else None,
        stop_date=stop_date if isinstance(stop_date, str) else None,
        stop_time=stop_time if isinstance(stop_time, str) else None,
    )


def _alerts_query(db: Session):
    return db.query(VisitAlert).options(
        joinedload(VisitAlert.seller),
        joinedload(VisitAlert.visit).joinedload(Visit.client),
    )


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
    unacked_only: bool = Query(default=False),
):
    """Supervisor: GPS/foto. Vendedor: avisos de ruta asignada."""
    query = _alerts_query(db).order_by(VisitAlert.created_at.desc())
    if current_user.role == UserRole.vendedor:
        query = query.filter(
            VisitAlert.seller_id == current_user.id,
            VisitAlert.alert_type == AlertType.route_assigned,
        )
    else:
        query = query.filter(VisitAlert.alert_type != AlertType.route_assigned)
    if unacked_only:
        query = query.filter(VisitAlert.acknowledged_at.is_(None))
    return [_alert_out(a) for a in query.limit(100).all()]


@router.post("/api/alerts/{alert_id}/ack", response_model=VisitAlertOut)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca una alerta como vista (supervisor o el vendedor dueño)."""
    alert = _alerts_query(db).filter(VisitAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if current_user.role == UserRole.vendedor and alert.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes marcar avisos de otro vendedor")
    if alert.acknowledged_at is None:
        alert.acknowledged_at = datetime.now(timezone.utc)
        db.add(alert)
        db.commit()
        alert = _alerts_query(db).filter(VisitAlert.id == alert_id).one()
    return _alert_out(alert)
