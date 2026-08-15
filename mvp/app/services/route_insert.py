"""Orden de paradas del día al asignar: hora, clúster de ciudad, base del vendedor."""

from __future__ import annotations

import unicodedata
from datetime import time

from sqlalchemy.orm import Session, joinedload

from ..models import User, Visit, VisitStatus

FROZEN = {VisitStatus.completada, VisitStatus.en_curso}


def fold_place(value: str) -> str:
    nfd = unicodedata.normalize("NFD", value or "")
    stripped = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return stripped.lower().strip()


def depot_city(route_name: str | None) -> str:
    if not route_name or not route_name.strip():
        return ""
    first = route_name.replace("/", "·").split("·")[0]
    return fold_place(first)


def stop_city(visit: Visit) -> str:
    client = visit.client
    if not client:
        return ""
    return fold_place(client.city or client.state or "")


def time_minutes(visit: Visit) -> int | None:
    t = visit.scheduled_time
    if t is None:
        return None
    if isinstance(t, time):
        return t.hour * 60 + t.minute
    raw = str(t)
    if len(raw) >= 5 and raw[2] == ":":
        return int(raw[0:2]) * 60 + int(raw[3:5])
    return None


def _prev(visit: Visit) -> tuple[int, int]:
    return (visit.sequence or 0, visit.id)


def _insert_untimed(result: list[Visit], stop: Visit, depot: str) -> None:
    city = stop_city(stop)
    same = [i for i, row in enumerate(result) if city and stop_city(row) == city]
    home = bool(depot and city and city == depot)
    if same:
        at = same[0] if home else same[-1] + 1
        result.insert(at, stop)
        return
    if home:
        result.insert(0, stop)
        return
    result.append(stop)


def _auto_order(movable: list[Visit], depot: str, draft_id: int) -> list[Visit]:
    timed = sorted(
        [v for v in movable if time_minutes(v) is not None],
        key=lambda v: (time_minutes(v) or 0, *_prev(v)),
    )
    untimed = sorted(
        [v for v in movable if time_minutes(v) is None],
        key=_prev,
    )
    if timed:
        result = list(timed)
        for stop in untimed:
            _insert_untimed(result, stop, depot)
        return result

    groups: dict[str, list[Visit]] = {}
    for stop in untimed:
        key = stop_city(stop) or "_"
        groups.setdefault(key, []).append(stop)

    def city_rank(key: str) -> tuple[int, int]:
        home = 0 if key != "_" and key == depot else 1
        seq = min((v.sequence or v.id) for v in groups[key])
        return (home, seq)

    out: list[Visit] = []
    for key in sorted(groups, key=city_rank):
        lst = groups[key]
        home = key != "_" and key == depot
        if home:
            lst = sorted(
                lst,
                key=lambda v: (0 if v.id == draft_id else 1, v.sequence or 0, v.id),
            )
        out.extend(lst)
    return out


def place_day_stops(
    stops: list[Visit],
    draft_id: int,
    place: str,
    depot: str,
) -> list[Visit]:
    frozen = sorted([v for v in stops if v.status in FROZEN], key=_prev)
    movable = [v for v in stops if v.status not in FROZEN]
    draft = next((v for v in movable if v.id == draft_id), None)
    rest = sorted([v for v in movable if v.id != draft_id], key=_prev)
    if draft is None:
        return order_day_plan(stops, depot)
    if place == "start":
        return frozen + [draft] + rest
    if place == "end":
        return frozen + rest + [draft]
    return frozen + _auto_order(rest + [draft], depot, draft_id)


def order_day_plan(stops: list[Visit], depot: str) -> list[Visit]:
    frozen = sorted([v for v in stops if v.status in FROZEN], key=_prev)
    movable = [v for v in stops if v.status not in FROZEN]
    return frozen + _auto_order(movable, depot, 0)


def resequence_day(
    db: Session,
    *,
    seller: User,
    scheduled_date,
    new_visit: Visit,
    place: str,
) -> None:
    """Reescribe `sequence` 1..n del día (o sin día) tras agregar una parada."""
    q = (
        db.query(Visit)
        .options(joinedload(Visit.client))
        .filter(
            Visit.seller_id == seller.id,
            Visit.status != VisitStatus.cancelada,
        )
    )
    if scheduled_date is None:
        q = q.filter(Visit.scheduled_date.is_(None))
    else:
        q = q.filter(Visit.scheduled_date == scheduled_date)
    rows = q.all()
    if new_visit not in rows and new_visit.status != VisitStatus.cancelada:
        rows.append(new_visit)
    ordered = place_day_stops(rows, new_visit.id, place or "auto", depot_city(seller.route_name))
    for i, visit in enumerate(ordered, start=1):
        visit.sequence = i


def resequence_route_days(db: Session, seller: User, route_id: int) -> None:
    """Aplica el trazo hora/ciudad a cada día de la ruta (lista y mapa del vendedor)."""
    rows = (
        db.query(Visit)
        .options(joinedload(Visit.client))
        .filter(
            Visit.route_id == route_id,
            Visit.status != VisitStatus.cancelada,
        )
        .all()
    )
    groups: dict[object, list[Visit]] = {}
    for visit in rows:
        groups.setdefault(visit.scheduled_date, []).append(visit)
    depot = depot_city(seller.route_name)
    for group in groups.values():
        ordered = order_day_plan(group, depot)
        for i, visit in enumerate(ordered, start=1):
            visit.sequence = i
