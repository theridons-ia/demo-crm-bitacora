from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import GpsPointSource, Product, Sale, SaleItem, SaleOrigin, SaleResult, Visit, VisitGpsPoint, VisitStatus
from ..schemas import SaleIn


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
) -> Visit:
    if visit.status == VisitStatus.completada:
        raise HTTPException(status_code=400, detail="La visita ya está completada")

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
    if gps_captured_at is not None:
        visit.gps_captured_at = gps_captured_at

    if latitude is not None and longitude is not None:
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

    needs_sale = result in (SaleResult.venta_parcial, SaleResult.venta_cerrada)
    if needs_sale:
        if not sale_in or not sale_in.items:
            raise HTTPException(status_code=400, detail="Debes indicar productos para una venta")
        total, items = apply_sale_to_inventory(db, sale_in)
        sale = Sale(
            visit_id=visit.id,
            seller_id=seller_id,
            client_id=visit.client_id,
            origin=SaleOrigin.visita,
            currency=sale_in.currency,
            payment_method=sale_in.payment_method,
            total_amount=total,
            is_credit=sale_in.is_credit,
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
