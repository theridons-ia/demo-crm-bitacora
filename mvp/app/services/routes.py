"""Ruta semanal: 1 vendedor × 1 lunes Caracas (SF-5.1)."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import (
    AlertSeverity,
    AlertType,
    Route,
    RouteStatus,
    User,
    UserRole,
    Visit,
    VisitAlert,
    VisitStatus,
)
from ..timeutil import (
    _MONTHS_SHORT,
    route_title,
    today_caracas,
    week_end_caracas,
    week_start_caracas,
)


def next_route_code(db: Session) -> str:
    codes = [row[0] for row in db.query(Route.code).filter(Route.code.isnot(None)).all()]
    max_n = 0
    for code in codes:
        try:
            max_n = max(max_n, int(str(code).split("-", 1)[1]))
        except (ValueError, IndexError):
            continue
    return f"RUT-{max_n + 1}"


def get_or_create_week_route(db: Session, seller_id: int, week_start: date) -> Route:
    week = week_start_caracas(week_start)
    existing = (
        db.query(Route)
        .filter(Route.seller_id == seller_id, Route.week_start == week)
        .first()
    )
    if existing:
        if not existing.name:
            seller = db.query(User).filter(User.id == seller_id).first()
            existing.name = route_title(seller.full_name if seller else "", week)
        return existing

    seller = db.query(User).filter(User.id == seller_id).first()
    route = Route(
        seller_id=seller_id,
        week_start=week,
        code=next_route_code(db),
        name=route_title(seller.full_name if seller else "", week),
        status=RouteStatus.publicada,
    )
    db.add(route)
    db.flush()
    return route


def attach_visit_to_week_route(
    db: Session,
    visit: Visit,
    *,
    origin: str,
    locked: bool = False,
    week_start: date | None = None,
) -> Route:
    if visit.scheduled_date:
        week = week_start_caracas(visit.scheduled_date)
    elif week_start:
        week = week_start_caracas(week_start)
    else:
        week = week_start_caracas()
    route = get_or_create_week_route(db, visit.seller_id, week)
    visit.route_id = route.id
    visit.origin_plan = origin
    visit.schedule_locked = locked
    if visit.sequence is None:
        max_seq = (
            db.query(func.coalesce(func.max(Visit.sequence), 0))
            .filter(Visit.route_id == route.id)
            .scalar()
        )
        visit.sequence = int(max_seq or 0) + 1
    return route


def attach_week_orphans(db: Session, seller_id: int, week_start: date) -> Route:
    week = week_start_caracas(week_start)
    week_end = week_end_caracas(week)
    route = get_or_create_week_route(db, seller_id, week)
    orphans = (
        db.query(Visit)
        .filter(
            Visit.seller_id == seller_id,
            Visit.route_id.is_(None),
            Visit.status != VisitStatus.cancelada,
            Visit.scheduled_date >= week,
            Visit.scheduled_date <= week_end,
        )
        .all()
    )
    for visit in orphans:
        attach_visit_to_week_route(
            db,
            visit,
            origin="supervisor",
            locked=bool(visit.scheduled_date and visit.scheduled_time),
        )
    return route


def backfill_week_routes(db: Session, week_start: date) -> list[Route]:
    week = week_start_caracas(week_start)
    sellers = (
        db.query(User)
        .filter(User.role == UserRole.vendedor, User.is_active.is_(True))
        .order_by(User.full_name.asc())
        .all()
    )
    routes = [attach_week_orphans(db, seller.id, week) for seller in sellers]
    db.flush()
    return routes


def route_counts(db: Session, route_id: int) -> tuple[int, int, int, int]:
    visits = (
        db.query(Visit)
        .filter(Visit.route_id == route_id, Visit.status != VisitStatus.cancelada)
        .all()
    )
    planned = len(visits)
    done = sum(1 for v in visits if v.status == VisitStatus.completada)
    unscheduled = sum(1 for v in visits if v.scheduled_date is None)
    in_progress = sum(1 for v in visits if v.status == VisitStatus.en_curso)
    return planned, done, unscheduled, in_progress


def computed_status(route: Route, in_progress: int, planned: int, today: date | None = None) -> str:
    day = today or today_caracas()
    if week_end_caracas(route.week_start) < day:
        return RouteStatus.cerrada.value
    if in_progress:
        return RouteStatus.en_curso.value
    if planned == 0:
        return RouteStatus.borrador.value
    return route.status.value if route.status else RouteStatus.publicada.value


def notify_route_assigned(db: Session, visit: Visit, client_name: str) -> None:
    """Aviso en la campanita del vendedor: le metieron una parada a la semana."""
    if visit.scheduled_date:
        d = visit.scheduled_date
        when = f"{d.day} {_MONTHS_SHORT[d.month - 1]}"
        if visit.scheduled_time:
            when = f"{when} · {visit.scheduled_time.strftime('%H:%M')}"
        else:
            when = f"{when} · sin hora"
    else:
        when = "sin día"
    db.add(
        VisitAlert(
            visit_id=visit.id,
            seller_id=visit.seller_id,
            alert_type=AlertType.route_assigned,
            severity=AlertSeverity.info,
            message=f"Nueva parada: {client_name} · {when}",
        )
    )


def seller_initials(seller: User | None) -> str:
    if seller and seller.initials:
        return seller.initials
    name = seller.full_name if seller else ""
    parts = [p for p in name.split() if p]
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    if parts:
        return parts[0][:2].upper()
    return "?"
