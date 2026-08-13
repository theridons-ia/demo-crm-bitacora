from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    AlertSeverity,
    AlertType,
    CurrencyCode,
    GpsPointSource,
    Product,
    Sale,
    SaleItem,
    SaleOrigin,
    SaleResult,
    User,
    Visit,
    VisitAlert,
    VisitGpsPoint,
    VisitStatus,
)
from ..schemas import SaleIn
from .catalog_visibility import assert_seller_can_use_products
from .fx import resolve_usd_to_ves

# Umbrales evidencia (metros)
GPS_ACCURACY_WARN_M = Decimal("100")
GPS_FAR_CLIENT_M = Decimal("250")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlmb = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlmb / 2) ** 2
    return 2 * r * asin(sqrt(a))


def apply_sale_to_inventory(db: Session, sale_in: SaleIn) -> tuple[Decimal, list[SaleItem]]:
    if not sale_in.items:
        raise HTTPException(status_code=400, detail="La venta requiere al menos un producto")

    total = Decimal("0")
    items: list[SaleItem] = []

    for line in sale_in.items:
        product = db.query(Product).filter(Product.id == line.product_id, Product.is_active.is_(True)).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {line.product_id} no encontrado")
        if product.stock < line.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente de {product.name}: hay {product.stock}, pediste {line.quantity}",
            )

        unit_price = Decimal(product.price_usd)
        line_total = unit_price * line.quantity
        product.stock -= line.quantity
        total += line_total
        items.append(
            SaleItem(
                product_id=product.id,
                quantity=line.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    return total, items


def _add_alert(
    db: Session,
    *,
    visit: Visit,
    seller_id: int,
    alert_type: AlertType,
    severity: AlertSeverity,
    message: str,
    meta_json: str | None = None,
) -> None:
    db.add(
        VisitAlert(
            visit_id=visit.id,
            seller_id=seller_id,
            alert_type=alert_type,
            severity=severity,
            message=message,
            meta_json=meta_json,
        )
    )


def close_visit_with_optional_sale(
    db: Session,
    visit: Visit,
    *,
    result: SaleResult,
    description: str | None,
    latitude,
    longitude,
    gps_accuracy_m,
    gps_offline: bool,
    gps_captured_at,
    sale_in: SaleIn | None,
    seller_id: int,
    gps_skipped: bool = False,
    gps_skip_reason: str | None = None,
    photo_evidence: str | None = None,
) -> Visit:
    if visit.status == VisitStatus.completada:
        raise HTTPException(status_code=400, detail="La visita ya está completada")

    has_fix = latitude is not None and longitude is not None
    if gps_skipped and not photo_evidence and not has_fix:
        # Permitir saltar GPS, pero pedimos foto si no hay coordenada
        raise HTTPException(
            status_code=400,
            detail="Si omites el GPS, adjunta una foto de evidencia del PDV",
        )

    visit.status = VisitStatus.completada
    visit.result = result
    if description is not None:
        visit.description = description
    visit.visited_at = gps_captured_at or visit.visited_at
    if latitude is not None:
        visit.latitude = latitude
    if longitude is not None:
        visit.longitude = longitude
    if gps_accuracy_m is not None:
        visit.gps_accuracy_m = gps_accuracy_m
    visit.gps_offline = gps_offline
    visit.gps_skipped = gps_skipped
    visit.gps_skip_reason = gps_skip_reason
    if photo_evidence:
        visit.photo_evidence = photo_evidence
    if gps_captured_at is not None:
        visit.gps_captured_at = gps_captured_at

    if has_fix:
        db.add(
            VisitGpsPoint(
                visit_id=visit.id,
                latitude=latitude,
                longitude=longitude,
                accuracy_m=gps_accuracy_m,
                captured_at=gps_captured_at or visit.gps_captured_at,
                source=GpsPointSource.end,
            )
        )

    # Alertas de evidencia
    if gps_skipped or (not has_fix and gps_offline):
        _add_alert(
            db,
            visit=visit,
            seller_id=seller_id,
            alert_type=AlertType.gps_skipped if gps_skipped else AlertType.no_gps,
            severity=AlertSeverity.warning,
            message=gps_skip_reason or "Visita cerrada sin GPS confiable",
        )
    if photo_evidence and (gps_skipped or not has_fix):
        _add_alert(
            db,
            visit=visit,
            seller_id=seller_id,
            alert_type=AlertType.photo_only,
            severity=AlertSeverity.info,
            message="Evidencia fotográfica adjunta (sin GPS o GPS omitido)",
        )
    if has_fix and gps_accuracy_m is not None and Decimal(gps_accuracy_m) > GPS_ACCURACY_WARN_M:
        _add_alert(
            db,
            visit=visit,
            seller_id=seller_id,
            alert_type=AlertType.gps_low_accuracy,
            severity=AlertSeverity.warning,
            message=f"GPS con baja precisión (±{gps_accuracy_m} m)",
            meta_json=f'{{"accuracy_m": {gps_accuracy_m}}}',
        )

    client = visit.client
    if (
        has_fix
        and client is not None
        and client.latitude is not None
        and client.longitude is not None
        and (gps_accuracy_m is None or Decimal(gps_accuracy_m) <= GPS_ACCURACY_WARN_M)
    ):
        dist = haversine_m(
            float(latitude),
            float(longitude),
            float(client.latitude),
            float(client.longitude),
        )
        if dist > float(GPS_FAR_CLIENT_M):
            _add_alert(
                db,
                visit=visit,
                seller_id=seller_id,
                alert_type=AlertType.gps_far,
                severity=AlertSeverity.warning,
                message=f"Cierre a ~{dist:.0f} m del PDV registrado",
                meta_json=f'{{"distance_m": {dist:.1f}}}',
            )

    needs_sale = result in (SaleResult.venta_parcial, SaleResult.venta_cerrada)
    if needs_sale:
        if not sale_in or not sale_in.items:
            raise HTTPException(status_code=400, detail="Debes indicar productos para una venta")
        seller = db.query(User).filter(User.id == seller_id).first()
        if seller:
            assert_seller_can_use_products(db, seller, [line.product_id for line in sale_in.items])
        total, items = apply_sale_to_inventory(db, sale_in)
        fx_rate = None
        if sale_in.currency == CurrencyCode.VES:
            fx_rate = resolve_usd_to_ves(db)
            if fx_rate is None:
                raise HTTPException(
                    status_code=400,
                    detail="No hay tasa FX del día: el supervisor debe cargarla",
                )
        sale = Sale(
            visit_id=visit.id,
            seller_id=seller_id,
            client_id=visit.client_id,
            origin=SaleOrigin.visita,
            currency=sale_in.currency,
            payment_method=sale_in.payment_method,
            total_amount=total,
            is_credit=sale_in.is_credit,
            fx_rate_usd_ves=fx_rate,
            notes=sale_in.notes,
            local_uuid=sale_in.local_uuid,
            created_offline=sale_in.created_offline,
            items=items,
        )
        db.add(sale)
    elif sale_in and sale_in.items:
        raise HTTPException(status_code=400, detail="No envíes productos si el resultado es sin venta")

    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit
