from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import User, Visit, VisitStatus
from ..schemas import SyncRequest, SyncResponse, VisitOut
from ..services.visits import close_visit_with_optional_sale

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/offline-visits", response_model=SyncResponse)
def sync_offline_visits(
    payload: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recibe visitas+GPS(+venta) capturadas offline y las persiste."""
    accepted_ids: list[int] = []

    for item in payload.visits:
        existing = db.query(Visit).filter(Visit.local_uuid == item.local_uuid).first()
        if existing:
            accepted_ids.append(existing.id)
            continue

        now = datetime.now(timezone.utc)
        visit = Visit(
            seller_id=current_user.id,
            client_id=item.client_id,
            status=VisitStatus.en_curso,
            description=item.description,
            latitude=item.latitude,
            longitude=item.longitude,
            gps_accuracy_m=item.gps_accuracy_m,
            gps_offline=True,
            gps_captured_at=item.gps_captured_at or now,
            visited_at=item.visited_at or now,
            local_uuid=item.local_uuid,
            client_synced=True,
        )
        db.add(visit)
        db.flush()

        if item.sale:
            item.sale.created_offline = True
            if not item.sale.local_uuid:
                item.sale.local_uuid = f"sale-{item.local_uuid}"

        close_visit_with_optional_sale(
            db,
            visit,
            result=item.result,
            description=item.description,
            latitude=item.latitude,
            longitude=item.longitude,
            gps_accuracy_m=item.gps_accuracy_m,
            gps_offline=True,
            gps_captured_at=item.gps_captured_at or now,
            sale_in=item.sale,
            seller_id=current_user.id,
        )
        accepted_ids.append(visit.id)

    return SyncResponse(
        accepted=len(accepted_ids),
        visit_ids=accepted_ids,
        message="Sync offline completado",
    )


@router.get("/health")
def sync_health():
    return {"ok": True, "mode": "online-first + offline visit/sale queue"}
