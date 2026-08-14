from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Client, GpsPointSource, User, Visit, VisitGpsPoint, VisitStatus
from ..schemas import SyncRequest, SyncResponse
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
        visit.client = db.query(Client).filter(Client.id == item.client_id).first()

        if item.latitude is not None and item.longitude is not None:
            db.add(
                VisitGpsPoint(
                    visit_id=visit.id,
                    latitude=item.latitude,
                    longitude=item.longitude,
                    accuracy_m=item.gps_accuracy_m,
                    captured_at=item.gps_captured_at or now,
                    source=GpsPointSource.start,
                )
            )

        if item.sale:
            item.sale.created_offline = True
            if not item.sale.local_uuid:
                item.sale.local_uuid = f"sale-{item.local_uuid}"

        has_end = item.end_latitude is not None and item.end_longitude is not None
        close_visit_with_optional_sale(
            db,
            visit,
            result=item.result,
            description=item.description,
            latitude=item.end_latitude if has_end else item.latitude,
            longitude=item.end_longitude if has_end else item.longitude,
            gps_accuracy_m=item.end_gps_accuracy_m if has_end else item.gps_accuracy_m,
            gps_offline=True,
            gps_captured_at=(item.end_gps_captured_at if has_end else item.gps_captured_at) or now,
            sale_in=item.sale,
            seller_id=current_user.id,
            gps_skipped=item.gps_skipped,
            gps_skip_reason=item.gps_skip_reason,
            photo_evidence=item.photo_evidence,
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
