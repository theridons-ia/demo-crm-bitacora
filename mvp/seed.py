"""Seed inicial / enriquecido del MVP (datos de prueba Venezuela)."""

from decimal import Decimal

from app.auth import hash_password
from app.database import SessionLocal, engine
from app.ensure_schema import ensure_schema
from app.models import (
    AlertSeverity,
    AlertType,
    Client,
    CurrencyCode,
    PaymentMethod,
    Product,
    Sale,
    SaleItem,
    SaleOrigin,
    SaleResult,
    SellerProductVisibility,
    Supplier,
    User,
    UserRole,
    Visit,
    VisitAlert,
    VisitStatus,
)


def run() -> None:
    ensure_schema(engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "marina@bitacora.local").first():
            db.add_all(
                [
                    User(
                        email="marina@bitacora.local",
                        full_name="Marina Gómez",
                        hashed_password=hash_password("demo1234"),
                        role=UserRole.vendedor,
                        initials="MG",
                        route_name="Ruta Centro · Lara",
                    ),
                    User(
                        email="supervisor@bitacora.local",
                        full_name="Yuliana Supervisor",
                        hashed_password=hash_password("demo1234"),
                        role=UserRole.supervisor,
                        initials="YS",
                        route_name="Equipo Occidente",
                    ),
                    User(
                        email="admin@bitacora.local",
                        full_name="Admin Bitácora",
                        hashed_password=hash_password("demo1234"),
                        role=UserRole.admin,
                        initials="AD",
                    ),
                ]
            )

        if not db.query(User).filter(User.email == "carlos@bitacora.local").first():
            db.add(
                User(
                    email="carlos@bitacora.local",
                    full_name="Carlos Ruiz",
                    hashed_password=hash_password("demo1234"),
                    role=UserRole.vendedor,
                    initials="CR",
                    route_name="Ruta Este · Yaracuy",
                )
            )

        demo_clients = [
            {
                "name": "Mercado San Rafael",
                "rif": "J-40123456-7",
                "ci": None,
                "state": "Yaracuy",
                "address": "Av. Caracas, San Felipe",
                "phone": "+58-254-5550101",
            },
            {
                "name": "Bodega La Esquina",
                "rif": "J-29876543-2",
                "ci": None,
                "state": "Carabobo",
                "address": "Calle Negra Matea, Valencia",
                "phone": "+58-241-5550202",
            },
            {
                "name": "Abastos El Río",
                "rif": None,
                "ci": "V-14567890",
                "state": "Lara",
                "address": "Carrera 19 con 28, Barquisimeto",
                "phone": "+58-251-5550303",
            },
            {
                "name": "Distribuciones Lara Sur",
                "rif": "J-31222333-4",
                "ci": None,
                "state": "Lara",
                "address": "Zona Industrial I, Cabudare",
                "phone": "+58-251-5550404",
            },
            {
                "name": "Kiosco Doña Carmen",
                "rif": None,
                "ci": "V-8123456",
                "state": "Yaracuy",
                "address": "Centro, Chivacoa",
                "phone": "+58-254-5550505",
            },
            {
                "name": "Mayorista Puerto Cabello",
                "rif": "J-40555666-1",
                "ci": None,
                "state": "Carabobo",
                "address": "Av. Principal, Puerto Cabello",
                "phone": "+58-242-5550606",
            },
        ]

        for data in demo_clients:
            existing = db.query(Client).filter(Client.name == data["name"]).first()
            if existing:
                if not existing.rif and data["rif"]:
                    existing.rif = data["rif"]
                if not existing.ci and data["ci"]:
                    existing.ci = data["ci"]
                if data.get("phone") and not existing.phone:
                    existing.phone = data["phone"]
                if data.get("address") and (
                    not existing.address or existing.address in ("San Felipe", "Valencia", "Barquisimeto")
                ):
                    existing.address = data["address"]
            else:
                db.add(Client(**data))

        # Pins demo para mapa del equipo (SF-2.5) si faltan
        demo_pins = {
            "Mercado San Rafael": (10.3397, -68.7425),
            "Bodega La Esquina": (10.1621, -68.0075),
            "Abastos El Río": (10.0731, -69.3220),
            "Distribuciones Lara Sur": (10.0260, -69.2630),
            "Kiosco Doña Carmen": (10.1602, -68.8950),
            "Mayorista Puerto Cabello": (10.4731, -68.0125),
        }
        for name, (lat, lng) in demo_pins.items():
            c = db.query(Client).filter(Client.name == name).first()
            if c and c.latitude is None:
                c.latitude = Decimal(str(lat))
                c.longitude = Decimal(str(lng))

        demo_suppliers = [
            {
                "name": "Distribuidora Central",
                "rif": "J-00011222-3",
                "ci": None,
                "phone": "+58-212-5551000",
                "email": "ventas@distcentral.demo",
            },
            {
                "name": "Embotelladora Andes C.A.",
                "rif": "J-07099888-5",
                "ci": None,
                "phone": "+58-251-5552000",
                "email": "pedidos@andes.demo",
            },
        ]
        for data in demo_suppliers:
            existing = db.query(Supplier).filter(Supplier.name == data["name"]).first()
            if existing:
                if not existing.rif and data["rif"]:
                    existing.rif = data["rif"]
                if data.get("email") and not existing.email:
                    existing.email = data["email"]
                if data.get("phone") and not existing.phone:
                    existing.phone = data["phone"]
            else:
                db.add(Supplier(**data))

        demo_products = [
            ("COLA1", "Cola #1", "caja", "12.00", 200),
            ("COLA2", "Cola #2", "caja", "15.00", 180),
            ("LECHEABC", "Leche ABC", "pack", "8.00", 250),
            ("AGUA600", "Agua 600ml", "paquete", "6.50", 320),
            ("JUGO1L", "Jugo Naranja 1L", "caja", "14.00", 140),
            ("MALTALATA", "Malta lata", "caja", "11.50", 160),
        ]
        for sku, name, unit, price, stock in demo_products:
            if not db.query(Product).filter(Product.sku == sku).first():
                db.add(
                    Product(
                        sku=sku,
                        name=name,
                        unit=unit,
                        price_usd=Decimal(price),
                        stock=stock,
                    )
                )

        if db.query(VisitAlert).count() == 0:
            marina = db.query(User).filter(User.email == "marina@bitacora.local").first()
            client = db.query(Client).order_by(Client.id.asc()).first()
            if marina and client:
                demo_visit = Visit(
                    seller_id=marina.id,
                    client_id=client.id,
                    status=VisitStatus.completada,
                    result=SaleResult.sin_venta,
                    description="Visita demo para alertas SF-2.3",
                    gps_skipped=True,
                    gps_skip_reason="Sin señal en el PDV",
                )
                db.add(demo_visit)
                db.flush()
                db.add_all(
                    [
                        VisitAlert(
                            visit_id=demo_visit.id,
                            seller_id=marina.id,
                            alert_type=AlertType.gps_skipped,
                            severity=AlertSeverity.warning,
                            message="GPS omitido al cerrar visita (demo)",
                        ),
                        VisitAlert(
                            visit_id=demo_visit.id,
                            seller_id=marina.id,
                            alert_type=AlertType.photo_only,
                            severity=AlertSeverity.info,
                            message="Cierre solo con foto de evidencia (demo)",
                        ),
                        VisitAlert(
                            visit_id=demo_visit.id,
                            seller_id=marina.id,
                            alert_type=AlertType.gps_far,
                            severity=AlertSeverity.critical,
                            message="Cierre a más de 250 m del pin del PDV (demo)",
                            meta_json='{"distance_m": 412}',
                        ),
                    ]
                )

        carlos = db.query(User).filter(User.email == "carlos@bitacora.local").first()
        if (
            carlos
            and db.query(SellerProductVisibility)
            .filter(SellerProductVisibility.seller_id == carlos.id)
            .count()
            == 0
        ):
            # Demo SF-2.4: Carlos solo ve un subconjunto; Marina sigue con catálogo completo
            subset = (
                db.query(Product)
                .filter(Product.sku.in_(["COLA1", "AGUA600", "MALTALATA"]))
                .all()
            )
            for p in subset:
                db.add(SellerProductVisibility(seller_id=carlos.id, product_id=p.id))

        # Demo SF-3.2: una venta a crédito abierta
        if db.query(Sale).filter(Sale.is_credit.is_(True)).count() == 0:
            marina = db.query(User).filter(User.email == "marina@bitacora.local").first()
            client = db.query(Client).order_by(Client.id.asc()).first()
            product = db.query(Product).filter(Product.sku == "COLA1").first()
            if marina and client and product and product.stock >= 2:
                qty = 2
                line = Decimal(product.price_usd) * qty
                product.stock -= qty
                sale = Sale(
                    seller_id=marina.id,
                    client_id=client.id,
                    origin=SaleOrigin.mostrador,
                    currency=CurrencyCode.USD,
                    payment_method=PaymentMethod.credit,
                    total_amount=line,
                    is_credit=True,
                    notes="Venta a crédito demo SF-3.2",
                )
                sale.items = [
                    SaleItem(
                        product_id=product.id,
                        quantity=qty,
                        unit_price=product.price_usd,
                        line_total=line,
                    )
                ]
                db.add(sale)

        db.commit()
        print("Seed OK")
        print(f"Clientes: {db.query(Client).count()} · Proveedores: {db.query(Supplier).count()} · Productos: {db.query(Product).count()}")
        print(f"Alertas: {db.query(VisitAlert).count()}")
        print("Usuarios: marina / carlos / supervisor / admin @bitacora.local")
        print("Password: demo1234")
    finally:
        db.close()


if __name__ == "__main__":
    run()
