from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..services.client_assignments import assign_client_to_seller, seller_can_see_client
from ..models import Client, GpsPointSource, Sale, User, UserRole, Visit, VisitGpsPoint, VisitStatus
from ..schemas import SaleIn, SaleOut, VisitAssign, VisitCancel, VisitClose, VisitCreate, VisitOut, VisitStart
from ..services.sales import create_sale_for_open_visit
from ..services.visits import close_visit_with_optional_sale
from ..timeutil import now_utc

router = APIRouter(prefix="/api/visits", tags=["visits"])


def _visit_query(db: Session):
    return db.query(Visit).options(
        joinedload(Visit.client),
        joinedload(Visit.seller),
        joinedload(Visit.sale).joinedload(Sale.items),
    )


@router.get("", response_model=list[VisitOut])
def list_visits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    scheduled_date: date | None = Query(default=None),
    day: date | None = Query(
        default=None,
        description="Visitas del día: programadas ese día o visitadas ese día (SF-2.5)",
    ),
    seller_id: int | None = Query(default=None),
    status: VisitStatus | None = Query(default=None),
):
    query = _visit_query(db).order_by(
        Visit.scheduled_date.asc().nullslast(),
        Visit.scheduled_time.asc().nullslast(),
        Visit.created_at.desc(),
    )
    if current_user.role.value == "vendedor":
        query = query.filter(Visit.seller_id == current_user.id)
    elif seller_id is not None:
        query = query.filter(Visit.seller_id == seller_id)
    if day is not None:
        query = query.filter(
            or_(
                Visit.scheduled_date == day,
                cast(func.timezone("America/Caracas", Visit.visited_at), Date) == day,
            )
        )
    elif scheduled_date is not None:
        query = query.filter(Visit.scheduled_date == scheduled_date)
    if status is not None:
        query = query.filter(Visit.status == status)
    return query.limit(200).all()


@router.post("/assign", response_model=VisitOut)
def assign_visit(
    payload: VisitAssign,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    """Crea visita programada para un vendedor (ruta del día)."""
    seller = db.query(User).filter(User.id == payload.seller_id).first()
    if not seller or seller.role != UserRole.vendedor or not seller.is_active:
        raise HTTPException(status_code=400, detail="Vendedor no válido")
    client = db.query(Client).filter(Client.id == payload.client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=400, detail="Cliente no válido")

    # Asegurar cartera: al planificar ruta el cliente queda asignado al vendedor
    assign_client_to_seller(db, payload.seller_id, payload.client_id)

    visit = Visit(
        seller_id=payload.seller_id,
        client_id=payload.client_id,
        status=VisitStatus.programada,
        description=payload.description,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
    )
    db.add(visit)
    db.commit()
    return _visit_query(db).filter(Visit.id == visit.id).one()


@router.delete("/{visit_id}", status_code=204)
def unassign_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    """Quita una visita solo si sigue programada (no borra historial ejecutado)."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if visit.status != VisitStatus.programada:
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden desasignar visitas programadas; el historial se conserva",
        )
    db.delete(visit)
    db.commit()
    return None


@router.post("", response_model=VisitOut)
def create_visit(
    payload: VisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.local_uuid:
        existing = db.query(Visit).filter(Visit.local_uuid == payload.local_uuid).first()
        if existing:
            return _visit_query(db).filter(Visit.id == existing.id).one()

    client = db.query(Client).filter(Client.id == payload.client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=400, detail="Cliente no válido")
    if current_user.role == UserRole.vendedor:
        if not seller_can_see_client(db, current_user, payload.client_id):
            # Alta de visita sobre cliente propio: lo mete en cartera
            assign_client_to_seller(db, current_user.id, payload.client_id)

    now = now_utc()
    visit = Visit(
        seller_id=current_user.id,
        client_id=payload.client_id,
        status=payload.status,
        description=payload.description,
        scheduled_date=payload.scheduled_date,
        scheduled_time=payload.scheduled_time,
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

    now = now_utc()
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
    return _visit_query(db).filter(Visit.id == visit_id).one()


@router.post("/{visit_id}/gps", response_model=VisitOut)
def pin_visit_gps(
    visit_id: int,
    payload: VisitStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fuerza guardar coordenadas en la visita (ficha) y deja un punto en el trail."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if current_user.role.value == "vendedor" and visit.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes actualizar GPS de otro vendedor")
    if visit.status not in (VisitStatus.programada, VisitStatus.en_curso):
        raise HTTPException(status_code=400, detail="Solo puedes fijar GPS en visitas abiertas")
    if payload.latitude is None or payload.longitude is None:
        raise HTTPException(status_code=400, detail="No hay coordenada para guardar")

    now = now_utc()
    had_fix = visit.latitude is not None and visit.longitude is not None
    visit.latitude = payload.latitude
    visit.longitude = payload.longitude
    visit.gps_accuracy_m = payload.gps_accuracy_m
    visit.gps_offline = payload.gps_offline
    visit.gps_captured_at = now
    db.add(
        VisitGpsPoint(
            visit_id=visit.id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_m=payload.gps_accuracy_m,
            captured_at=now,
            source=GpsPointSource.watch if had_fix else GpsPointSource.start,
        )
    )
    db.add(visit)
    db.commit()
    return _visit_query(db).filter(Visit.id == visit_id).one()


@router.post("/{visit_id}/cancel", response_model=VisitOut)
def cancel_visit(
    visit_id: int,
    payload: VisitCancel | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancela una visita programada o en curso sin OV."""
    body = payload or VisitCancel()
    visit = (
        db.query(Visit)
        .options(joinedload(Visit.sale), joinedload(Visit.client))
        .filter(Visit.id == visit_id)
        .first()
    )
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if current_user.role.value == "vendedor" and visit.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes cancelar visitas de otro vendedor")
    if visit.status in (VisitStatus.completada, VisitStatus.cancelada):
        raise HTTPException(status_code=400, detail="Esta visita ya está cerrada o cancelada")
    if visit.sale is not None:
        raise HTTPException(
            status_code=400,
            detail="Esta visita ya tiene OV; ciérrala en lugar de cancelarla",
        )

    visit.status = VisitStatus.cancelada
    if body.description:
        visit.description = body.description
    elif not visit.description:
        visit.description = "Cancelada"
    db.add(visit)
    db.commit()
    return _visit_query(db).filter(Visit.id == visit_id).one()


@router.post("/{visit_id}/sale", response_model=SaleOut)
def create_visit_sale(
    visit_id: int,
    payload: SaleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra la OV en una visita en_curso; la ficha sigue abierta hasta cerrar visita."""
    visit = (
        db.query(Visit)
        .options(joinedload(Visit.sale), joinedload(Visit.client))
        .filter(Visit.id == visit_id)
        .first()
    )
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    return create_sale_for_open_visit(db, visit, payload, seller=current_user)


@router.post("/{visit_id}/close", response_model=VisitOut)
def close_visit(
    visit_id: int,
    payload: VisitClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visit = (
        db.query(Visit)
        .options(joinedload(Visit.client), joinedload(Visit.sale))
        .filter(Visit.id == visit_id)
        .first()
    )
    if not visit:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    if current_user.role.value == "vendedor" and visit.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes cerrar visitas de otro vendedor")

    now = now_utc()
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
        gps_skipped=payload.gps_skipped,
        gps_skip_reason=payload.gps_skip_reason,
        photo_evidence=payload.photo_evidence,
    )
    return _visit_query(db).filter(Visit.id == visit_id).one()
