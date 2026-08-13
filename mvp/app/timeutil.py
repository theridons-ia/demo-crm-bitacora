"""Hora de negocio EnRutas: Caracas (UTC−4, sin DST). Instants en DB siguen en UTC."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

CARACAS = ZoneInfo("America/Caracas")
UTC = timezone.utc


def now_utc() -> datetime:
    return datetime.now(UTC)


def now_caracas() -> datetime:
    return datetime.now(CARACAS)


def today_caracas() -> date:
    return now_caracas().date()
