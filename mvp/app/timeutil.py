"""Hora de negocio EnRutas: Caracas (UTC−4, sin DST). Instants en DB siguen en UTC."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CARACAS = ZoneInfo("America/Caracas")
UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(UTC)


def now_caracas() -> datetime:
    return datetime.now(CARACAS)


def today_caracas() -> date:
    return now_caracas().date()


def week_start_caracas(day: date | None = None) -> date:
    """Lunes de la semana (calendario Caracas)."""
    current = day or today_caracas()
    return current - timedelta(days=current.weekday())


def week_end_caracas(week_start: date) -> date:
    return week_start + timedelta(days=6)


_MONTHS_SHORT = (
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
)


def format_week_span(week_start: date) -> str:
    end = week_end_caracas(week_start)
    if week_start.month == end.month:
        return f"{week_start.day}–{end.day} {_MONTHS_SHORT[week_start.month - 1]}"
    return (
        f"{week_start.day} {_MONTHS_SHORT[week_start.month - 1]}"
        f"–{end.day} {_MONTHS_SHORT[end.month - 1]}"
    )


def route_title(seller_name: str, week_start: date) -> str:
    first = seller_name.split()[0] if seller_name.strip() else "Ruta"
    return f"{first} · {format_week_span(week_start)}"
