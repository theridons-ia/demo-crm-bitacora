from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import Route, Sale, User, UserRole, Visit
from ..schemas import RouteCardOut, RouteCreate, RouteDetailOut, VisitOut
from ..services.route_insert import resequence_route_days
from ..services.routes import (
    attach_week_orphans,
    backfill_week_routes,
    computed_status,
    get_or_create_week_route,
    route_counts,
    seller_initials,
)
from ..timeutil import route_title, today_caracas, week_end_caracas, week_start_caracas

router = APIRouter(prefix="/api/routes", tags=["routes"])


def _can_see_route(user: User, route: Route) -> bool:
    if user.role in (UserRole.supervisor, UserRole.admin):
        return True
    return route.seller_id == user.id


def _to_card(db: Session, route: Route) -> RouteCardOut:
    seller = route.seller
    planned, done, unscheduled, in_progress = route_counts(db, route.id)
    title = route.name or route_title(seller.full_name if seller else "", route.week_start)
    return RouteCardOut(
        id=route.id,
        seller_id=route.seller_id,
        seller_name=seller.full_name if seller else f"Vendedor #{route.seller_id}",
        seller_initials=seller_initials(seller),
        week_start=route.week_start,
        week_end=week_end_caracas(route.week_start),
        code=route.code,
        title=title,
        status=computed_status(route, in_progress, planned),
        planned=planned,
        done=done,
        unscheduled=unscheduled,
        in_progress=in_progress,
    )


def _to_detail(db: Session, route: Route) -> RouteDetailOut:
    card = _to_card(db, route)
    visits = (
        db.query(Visit)
        .options(
            joinedload(Visit.client),
            joinedload(Visit.seller),
            joinedload(Visit.sale).joinedload(Sale.items),
        )
        .filter(Visit.route_id == route.id)
        .order_by(
            Visit.scheduled_date.asc().nullslast(),
            Visit.sequence.asc().nullslast(),
            Visit.scheduled_time.asc().nullslast(),
            Visit.created_at.asc(),
        )
        .all()
    )
    return RouteDetailOut(**card.model_dump(), visits=[VisitOut.model_validate(v) for v in visits])


@router.get("", response_model=list[RouteCardOut])
def list_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    week_start: date | None = Query(default=None),
):
    week = week_start_caracas(week_start or today_caracas())
    if current_user.role == UserRole.vendedor:
        route = get_or_create_week_route(db, current_user.id, week)
        db.commit()
        route = db.query(Route).options(joinedload(Route.seller)).filter(Route.id == route.id).one()
        return [_to_card(db, route)]

    if current_user.role not in (UserRole.supervisor, UserRole.admin):
        raise HTTPException(status_code=403, detail="Solo supervisor o admin")
    routes = backfill_week_routes(db, week)
    db.commit()
    ids = [r.id for r in routes]
    loaded = (
        db.query(Route)
        .options(joinedload(Route.seller))
        .filter(Route.id.in_(ids))
        .all()
        if ids
        else []
    )
    by_id = {r.id: r for r in loaded}
    return [_to_card(db, by_id[i]) for i in ids if i in by_id]


@router.get("/current", response_model=RouteDetailOut)
def current_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    seller_id: int | None = Query(default=None),
    week_start: date | None = Query(default=None),
):
    week = week_start_caracas(week_start or today_caracas())
    if current_user.role == UserRole.vendedor:
        sid = current_user.id
    else:
        if seller_id is None:
            raise HTTPException(status_code=400, detail="seller_id requerido")
        sid = seller_id
    route = attach_week_orphans(db, sid, week)
    seller = db.query(User).filter(User.id == sid).first()
    if seller:
        resequence_route_days(db, seller, route.id)
    db.commit()
    route = db.query(Route).options(joinedload(Route.seller)).filter(Route.id == route.id).one()
    if not _can_see_route(current_user, route):
        raise HTTPException(status_code=403, detail="No puedes ver esta ruta")
    return _to_detail(db, route)


@router.post("", response_model=RouteDetailOut)
def create_or_get_route(
    payload: RouteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    week = week_start_caracas(payload.week_start or today_caracas())
    seller = db.query(User).filter(User.id == payload.seller_id).first()
    if not seller or seller.role != UserRole.vendedor or not seller.is_active:
        raise HTTPException(status_code=400, detail="Vendedor no válido")
    route = get_or_create_week_route(db, payload.seller_id, week)
    db.commit()
    route = db.query(Route).options(joinedload(Route.seller)).filter(Route.id == route.id).one()
    return _to_detail(db, route)


@router.get("/{route_id}", response_model=RouteDetailOut)
def get_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    route = db.query(Route).options(joinedload(Route.seller)).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Ruta no encontrada")
    if not _can_see_route(current_user, route):
        raise HTTPException(status_code=403, detail="No puedes ver esta ruta")
    return _to_detail(db, route)
