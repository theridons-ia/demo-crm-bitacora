"""Ciudad del PDV: inferir desde dirección para backfill."""


def infer_client_city(address: str | None, state: str | None) -> str:
    raw = (address or "").strip()
    if raw and raw.lower() not in {"por contactar", "s/n", "sin dirección"}:
        tail = raw.rsplit(",", 1)[-1].strip()
        low = tail.lower()
        if (
            tail
            and 2 <= len(tail) <= 48
            and not low.startswith(("av.", "av ", "calle", "carrera", "zona", "urb.", "cc "))
        ):
            return tail
    state_name = (state or "").strip()
    return state_name or "Sin ciudad"
