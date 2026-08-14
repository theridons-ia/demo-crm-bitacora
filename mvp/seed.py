"""Seed demo EnRutas — dataset ficticio amplio para probar el CRM.

Idempotente: re-ejecutar no duplica. El bloque “rico” se salta si ya existe
el cliente marcador «Autoservicio El Parque».

Usuarios (password demo1234):
  marina@bitacora.local · carlos@bitacora.local · laura@bitacora.local
  arodriguez@bitacora.local · supervisor@bitacora.local · admin@bitacora.local
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.auth import hash_password
from app.database import SessionLocal, engine
from app.ensure_schema import ensure_schema
from app.models import (
    AlertSeverity,
    AlertType,
    BankAccount,
    BankAccountType,
    BankMovement,
    BankMovementKind,
    Client,
    CurrencyCode,
    FxRate,
    GpsPointSource,
    PayableInvoice,
    PayableStatus,
    PaymentMethod,
    Product,
    Sale,
    SaleItem,
    SaleOrigin,
    SalePayment,
    SaleResult,
    SellerClientAssignment,
    SellerProductVisibility,
    StockMovement,
    StockMovementKind,
    Supplier,
    User,
    UserRole,
    Visit,
    VisitAlert,
    VisitGpsPoint,
    VisitStatus,
)

# Demo en Venezuela: alinear “hoy” con el navegador local (no UTC).
CARACAS = ZoneInfo("America/Caracas")
UTC = timezone.utc
RICH_MARKER = "Autoservicio El Parque"
PWD = hash_password("demo1234")


def _dt(days_ago: int = 0, hour: int = 10, minute: int = 0) -> datetime:
    base = datetime.now(CARACAS).replace(second=0, microsecond=0)
    local = base - timedelta(days=days_ago)
    local = local.replace(hour=hour, minute=minute)
    return local.astimezone(UTC)


def _today() -> date:
    return datetime.now(CARACAS).date()


def _ensure_users(db) -> dict[str, User]:
    specs = [
        ("marina@bitacora.local", "Marina Gómez", UserRole.vendedor, "MG", "Ruta Centro · Lara"),
        ("carlos@bitacora.local", "Carlos Ruiz", UserRole.vendedor, "CR", "Ruta Este · Yaracuy"),
        ("laura@bitacora.local", "Laura Méndez", UserRole.vendedor, "LM", "Ruta Sur · Carabobo"),
        ("arodriguez@bitacora.local", "Ali Rodríguez", UserRole.vendedor, "AR", "Valencia · Puerto Cabello"),
        ("supervisor@bitacora.local", "Yuliana Supervisor", UserRole.supervisor, "YS", "Equipo Occidente"),
        ("admin@bitacora.local", "Admin Bitácora", UserRole.admin, "AD", None),
    ]
    out: dict[str, User] = {}
    for email, name, role, initials, route in specs:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                full_name=name,
                hashed_password=PWD,
                role=role,
                initials=initials,
                route_name=route,
            )
            db.add(u)
            db.flush()
        out[email.split("@")[0]] = u
    return out


def _ensure_suppliers(db) -> list[Supplier]:
    rows = [
        ("Distribuidora Central", "J-00011222-3", "+58-212-5551000", "ventas@distcentral.demo"),
        ("Embotelladora Andes C.A.", "J-07099888-5", "+58-251-5552000", "pedidos@andes.demo"),
        ("Alimentos del Centro", "J-29111222-0", "+58-241-5553000", "compras@alimentos.demo"),
    ]
    out: list[Supplier] = []
    for name, rif, phone, email in rows:
        s = db.query(Supplier).filter(Supplier.name == name).first()
        if not s:
            s = Supplier(name=name, rif=rif, phone=phone, email=email)
            db.add(s)
            db.flush()
        out.append(s)
    return out


def _ensure_products(db) -> list[Product]:
    today = _today()
    rows = [
        ("COLA1", "Glup! Cola 1L", "caja", "12.00", 420, "/products/glup-cola-1l.jpg"),
        ("COLA2", "Cola #2", "caja", "15.00", 380, None),
        ("LECHEABC", "Purísima Leche Completa 1L", "pack", "8.00", 510, "/products/leche-purisima-completa.jpg"),
        ("AGUA600", "Agua Minalba 600ml", "paquete", "6.50", 640, "/products/minalba-600.jpg"),
        ("JUGO1L", "Jugo Naranja 1L", "caja", "14.00", 290, None),
        ("MALTALATA", "Malta lata", "caja", "11.50", 310, None),
        ("ARROZ5K", "Arroz 5kg", "saco", "9.80", 220, None),
        ("ACEITE1L", "Aceite vegetal 1L", "caja", "18.50", 180, None),
        ("HARINA1K", "Harina P.A.N. 1kg", "paquete", "2.40", 800, "/products/harina-pan.jpg"),
        ("CAFE250", "Café molido 250g", "unidad", "4.75", 260, None),
        ("GALLETAS", "Galletas surtidas", "caja", "7.20", 340, None),
        ("JABON", "Jabón en polvo 1kg", "unidad", "3.90", 400, None),
        ("LECHEDESC", "Purísima Leche Descremada 1L", "unidad", "1.85", 420, "/products/leche-purisima-descremada.jpg"),
        ("GLUPMANZ", "Glup! Manzanita 2L", "unidad", "2.20", 280, "/products/glup-manzanita-2l.jpg"),
        ("GLUPUVA", "Glup! Uva 1L", "unidad", "1.50", 300, "/products/glup-uva-1l.jpg"),
        ("GREENSPOT", "Green Spot Iced Tea Limón", "unidad", "1.20", 240, "/products/greenspot-te-limon.jpg"),
        ("ARIZMANGO", "AriZona Mucho Mango 200ml", "unidad", "1.60", 260, "/products/arizona-mucho-mango.jpg"),
        ("PASTORENA", "La Pastoreña Leche Completa 1L", "unidad", "1.75", 360, "/products/leche-pastorena.jpg"),
        ("MINALBA15", "Agua Minalba 1.5L", "unidad", "1.10", 400, "/products/minalba-15l.jpg"),
    ]
    extras: dict[str, dict] = {
        "COLA1": dict(brand="Glup!", category="Bebidas", presentation="Caja x12 · botella 1 L", barcode="759100000011", cost_usd="8.40", pack_units=12, min_stock=40, lot="G2607C", expires_on=today + timedelta(days=180)),
        "COLA2": dict(brand="Cola", category="Bebidas", presentation="Caja x12", barcode="759100000012", cost_usd="10.50", pack_units=12, min_stock=40),
        "LECHEABC": dict(brand="Purísima", category="Lácteos", presentation="Pack x6 · cartón 1 L", barcode="759200000021", cost_usd="6.20", pack_units=6, min_stock=50, lot="PU2608A", expires_on=today + timedelta(days=50), notes="UHT larga duración, vitaminas A y D."),
        "AGUA600": dict(brand="Minalba", category="Bebidas", presentation="Paquete x12 · 600 ml", barcode="759300000031", cost_usd="4.10", pack_units=12, min_stock=60, notes="Agua mineral de manantial, libre de sodio."),
        "JUGO1L": dict(brand="Jugo", category="Bebidas", presentation="Caja x6 · 1 L", barcode="759400000041", cost_usd="10.20", pack_units=6, min_stock=30, expires_on=today + timedelta(days=90)),
        "MALTALATA": dict(brand="Malta", category="Bebidas", presentation="Caja x24 latas", barcode="759100000042", cost_usd="8.00", pack_units=24, min_stock=30),
        "ARROZ5K": dict(brand="Abarrotes", category="Abarrotes", presentation="Saco 5 kg", barcode="759500000051", cost_usd="7.40", pack_units=1, min_stock=40, lot="AR2606"),
        "ACEITE1L": dict(brand="Abarrotes", category="Abarrotes", presentation="Caja x12 · 1 L", barcode="759500000052", cost_usd="14.80", pack_units=12, min_stock=24),
        "HARINA1K": dict(brand="P.A.N.", category="Abarrotes", presentation="Bolsa 1 kg", barcode="759000100001", cost_usd="1.90", pack_units=1, min_stock=80, lot="PAN2608", expires_on=today + timedelta(days=210), notes="Harina de maíz blanco precocida. Libre de gluten."),
        "CAFE250": dict(brand="Café", category="Abarrotes", presentation="Bolsa 250 g", barcode="759500000053", cost_usd="3.40", pack_units=1, min_stock=30, expires_on=today + timedelta(days=240)),
        "GALLETAS": dict(brand="Snacks", category="Snacks", presentation="Caja surtida", barcode="759600000061", cost_usd="5.10", pack_units=12, min_stock=40, expires_on=today + timedelta(days=150)),
        "JABON": dict(brand="Limpieza", category="Limpieza", presentation="Bolsa 1 kg", barcode="759700000071", cost_usd="2.60", pack_units=1, min_stock=40),
        "LECHEDESC": dict(brand="Purísima", category="Lácteos", presentation="Cartón 1 L", barcode="759200000022", cost_usd="1.35", pack_units=1, min_stock=40, lot="PD2608B", expires_on=today + timedelta(days=45), notes="Descremada UHT, menos de 1% de grasa."),
        "GLUPMANZ": dict(brand="Glup!", category="Bebidas", presentation="Botella 2 L", barcode="759100000013", cost_usd="1.55", pack_units=1, min_stock=36, lot="GM2607", expires_on=today + timedelta(days=160)),
        "GLUPUVA": dict(brand="Glup!", category="Bebidas", presentation="Botella 1 L", barcode="759100000014", cost_usd="1.05", pack_units=1, min_stock=36, lot="GU2607", expires_on=today + timedelta(days=160)),
        "GREENSPOT": dict(brand="Green Spot", category="Bebidas", presentation="Botella 500 ml", barcode="759400000043", cost_usd="0.82", pack_units=1, min_stock=30, lot="GS2608", expires_on=today + timedelta(days=90)),
        "ARIZMANGO": dict(brand="AriZona", category="Bebidas", presentation="Caja 200 ml", barcode="850000000201", cost_usd="1.10", pack_units=1, min_stock=24, lot="AZ2606", expires_on=today + timedelta(days=120), notes="Jugo cocktail de mango. Libre de gluten."),
        "PASTORENA": dict(brand="La Pastoreña", category="Lácteos", presentation="Cartón 1 L", barcode="759200000023", cost_usd="1.25", pack_units=1, min_stock=40, lot="LP2608", expires_on=today + timedelta(days=55), notes="Leche completa larga vida, vitaminas A y D."),
        "MINALBA15": dict(brand="Minalba", category="Bebidas", presentation="Botella 1.5 L", barcode="759300000032", cost_usd="0.72", pack_units=1, min_stock=48, notes="Agua mineral de manantial, libre de sodio."),
    }
    out: list[Product] = []
    for sku, name, unit, price, stock, image_url in rows:
        extra = extras.get(sku, {})
        cost = extra.get("cost_usd")
        p = db.query(Product).filter(Product.sku == sku).first()
        if not p:
            p = Product(
                sku=sku,
                name=name,
                unit=unit,
                price_usd=Decimal(price),
                stock=stock,
                image_url=image_url,
                brand=extra.get("brand"),
                category=extra.get("category"),
                presentation=extra.get("presentation"),
                barcode=extra.get("barcode"),
                cost_usd=Decimal(cost) if cost else None,
                pack_units=extra.get("pack_units"),
                min_stock=extra.get("min_stock") or 40,
                lot=extra.get("lot"),
                expires_on=extra.get("expires_on"),
                notes=extra.get("notes"),
            )
            db.add(p)
            db.flush()
        else:
            if p.stock < 80:
                p.stock = stock
            p.name = name
            # No pisar fotos que el supervisor ya cargó (data URL u otra ruta).
            if image_url and (not p.image_url or p.image_url.startswith("/products/")):
                p.image_url = image_url
            if extra and p.brand is None:
                p.brand = extra.get("brand")
                p.category = extra.get("category")
                p.presentation = extra.get("presentation")
                p.barcode = extra.get("barcode")
                p.cost_usd = Decimal(cost) if cost else None
                p.pack_units = extra.get("pack_units")
                p.min_stock = extra.get("min_stock") or 40
                p.lot = extra.get("lot")
                p.expires_on = extra.get("expires_on")
                p.notes = extra.get("notes")
        out.append(p)
    return out


def _ensure_fx(db, supervisor: User) -> None:
    today = _today()
    rates = [
        (today - timedelta(days=2), "36.2000", "Tasa demo −2d"),
        (today - timedelta(days=1), "36.3500", "Tasa demo −1d"),
        (today, "36.5000", "Tasa demo del día"),
    ]
    for d, val, notes in rates:
        if not db.query(FxRate).filter(FxRate.rate_date == d).first():
            db.add(
                FxRate(
                    rate_date=d,
                    usd_to_ves=Decimal(val),
                    notes=notes,
                    created_by_id=supervisor.id,
                )
            )


def _client_by_name(db, name: str) -> Client | None:
    return db.query(Client).filter(Client.name == name).first()


def _assign(db, seller: User, client: Client) -> None:
    exists = (
        db.query(SellerClientAssignment)
        .filter(
            SellerClientAssignment.seller_id == seller.id,
            SellerClientAssignment.client_id == client.id,
        )
        .first()
    )
    if not exists:
        db.add(SellerClientAssignment(seller_id=seller.id, client_id=client.id))


def _sale_with_items(
    db,
    *,
    seller: User,
    client: Client,
    products: list[tuple[Product, int]],
    origin: SaleOrigin,
    payment: PaymentMethod,
    is_credit: bool,
    notes: str | None,
    visit: Visit | None = None,
    created_at: datetime | None = None,
    fx: Decimal | None = None,
) -> Sale:
    total = Decimal("0")
    items: list[SaleItem] = []
    for product, qty in products:
        line = Decimal(product.price_usd) * qty
        total += line
        if product.stock >= qty:
            product.stock -= qty
        items.append(
            SaleItem(
                product_id=product.id,
                quantity=qty,
                unit_price=product.price_usd,
                line_total=line,
            )
        )
    sale = Sale(
        visit_id=visit.id if visit else None,
        seller_id=seller.id,
        client_id=client.id,
        origin=origin,
        currency=CurrencyCode.USD,
        payment_method=payment,
        total_amount=total,
        is_credit=is_credit,
        fx_rate_usd_ves=fx,
        notes=notes,
        created_at=created_at or _dt(0, 12, 0),
    )
    sale.items = items
    db.add(sale)
    db.flush()
    return sale


def seed_rich_demo(db, users: dict[str, User], products: list[Product], suppliers: list[Supplier]) -> None:
    """Dataset amplio: clientes, rutas, ventas, CxC, stock, alertas."""
    if _client_by_name(db, RICH_MARKER):
        print("Dataset rico ya presente — omitiendo (borra el marcador o la DB para regenerar).")
        return

    marina, carlos, laura = users["marina"], users["carlos"], users["laura"]
    supervisor = users["supervisor"]
    by_sku = {p.sku: p for p in products}

    clients_data = [
        # Marina — Lara / Yaracuy
        ("Mercado San Rafael", "J-40123456-7", None, "Yaracuy", "Av. Caracas, San Felipe", "+58-254-5550101", 10.3397, -68.7425, marina),
        ("Abastos El Río", None, "V-14567890", "Lara", "Carrera 19 con 28, Barquisimeto", "+58-251-5550303", 10.0731, -69.3220, marina),
        ("Distribuciones Lara Sur", "J-31222333-4", None, "Lara", "Zona Industrial I, Cabudare", "+58-251-5550404", 10.0260, -69.2630, marina),
        ("Kiosco Doña Carmen", None, "V-8123456", "Yaracuy", "Centro, Chivacoa", "+58-254-5550505", 10.1602, -68.8950, marina),
        ("Mini Market Los Próceres", "J-29881122-1", None, "Lara", "Av. Vargas, Barquisimeto", "+58-251-5550707", 10.0675, -69.3168, marina),
        ("Bodega 24 Horas Centro", None, "V-15881234", "Lara", "Calle 25 con 18, Barquisimeto", "+58-251-5550808", 10.0642, -69.3215, marina),
        ("Abasto Familia Pérez", None, "V-9911223", "Yaracuy", "Calle Bolívar, Yaritagua", "+58-254-5550909", 10.0801, -69.1260, marina),
        ("Supermercado La Cascada", "J-40778899-2", None, "Lara", "Urb. El Parque, Cabudare", "+58-251-5551010", 10.0335, -69.2588, marina),
        (RICH_MARKER, "J-40990011-3", None, "Lara", "Av. Lara, Barquisimeto", "+58-251-5551111", 10.0550, -69.3100, marina),
        ("Panadería El Trigal", None, "V-12233445", "Lara", "El Trigal, Barquisimeto", "+58-251-5551212", 10.0488, -69.3450, marina),
        # Carlos — Yaracuy / este
        ("Bodega La Esquina", "J-29876543-2", None, "Carabobo", "Calle Negra Matea, Valencia", "+58-241-5550202", 10.1621, -68.0075, carlos),
        ("Mayorista Puerto Cabello", "J-40555666-1", None, "Carabobo", "Av. Principal, Puerto Cabello", "+58-242-5550606", 10.4731, -68.0125, carlos),
        ("Abastos San Felipe Norte", "J-30112233-8", None, "Yaracuy", "Zona Norte, San Felipe", "+58-254-5551313", 10.3520, -68.7350, carlos),
        ("Kiosco Terminal Yaracuy", None, "V-16778899", "Yaracuy", "Terminal de pasajeros, San Felipe", "+58-254-5551414", 10.3455, -68.7480, carlos),
        ("Distribuidora Chivacoa", "J-28880011-6", None, "Yaracuy", "Av. Principal, Chivacoa", "+58-254-5551515", 10.1650, -68.8920, carlos),
        ("Minimarket Cocorote", None, "V-13445566", "Yaracuy", "Calle Real, Cocorote", "+58-254-5551616", 10.3200, -68.7800, carlos),
        ("Bodega Nirgua Centro", "J-39990022-4", None, "Yaracuy", "Plaza Bolívar, Nirgua", "+58-254-5551717", 10.1505, -68.5660, carlos),
        # Laura — Carabobo
        ("Autoservicio Naguanagua", "J-41223344-5", None, "Carabobo", "Av. Universidad, Naguanagua", "+58-241-5551818", 10.2500, -68.0100, laura),
        ("Abastos Guacara", None, "V-17665544", "Carabobo", "Calle Comercio, Guacara", "+58-245-5551919", 10.1950, -67.9010, laura),
        ("Mayorista Tocuyito", "J-30556677-9", None, "Carabobo", "Zona Industrial, Tocuyito", "+58-241-5552020", 10.1000, -68.0800, laura),
        ("Kiosco Bejuma", None, "V-14556677", "Carabobo", "Calle Principal, Bejuma", "+58-249-5552121", 10.1720, -68.2600, laura),
        ("Supermercado San Diego", "J-41889900-1", None, "Carabobo", "Av. Don Julio Centeno, San Diego", "+58-241-5552222", 10.2200, -67.9600, laura),
        ("Bodega Los Guayos", None, "V-18889900", "Carabobo", "Calle 3, Los Guayos", "+58-241-5552323", 10.1830, -67.9350, laura),
        ("Distribuciones Valencia Este", "J-42221100-7", None, "Carabobo", "Av. Bolívar Norte, Valencia", "+58-241-5552424", 10.1850, -68.0005, laura),
        # Sin asignar (para probar filtro)
        ("Cliente Prospecto Sin Ruta", "J-43000000-0", None, "Lara", "Por contactar", None, None, None, None),
    ]

    clients: dict[str, Client] = {}
    for name, rif, ci, state, address, phone, lat, lng, seller in clients_data:
        c = _client_by_name(db, name)
        if not c:
            c = Client(
                name=name,
                rif=rif,
                ci=ci,
                state=state,
                address=address,
                phone=phone,
                latitude=Decimal(str(lat)) if lat is not None else None,
                longitude=Decimal(str(lng)) if lng is not None else None,
                notes="PDV demo EnRutas",
            )
            db.add(c)
            db.flush()
        else:
            if lat is not None and c.latitude is None:
                c.latitude = Decimal(str(lat))
                c.longitude = Decimal(str(lng))
        clients[name] = c
        if seller is not None:
            _assign(db, seller, c)

    # Catálogo restringido para Carlos
    if (
        db.query(SellerProductVisibility)
        .filter(SellerProductVisibility.seller_id == carlos.id)
        .count()
        == 0
    ):
        for sku in ("COLA1", "AGUA600", "MALTALATA", "HARINA1K", "JABON"):
            p = by_sku.get(sku)
            if p:
                db.add(SellerProductVisibility(seller_id=carlos.id, product_id=p.id))

    # —— Visitas programadas (otros vendedores; Marina hoy la arma sync_marina_today_route) ——
    today = _today()
    scheduled = [
        (carlos, "Abastos San Felipe Norte", today, time(10, 0), None),
        (carlos, "Kiosco Terminal Yaracuy", today, time(14, 0), "Reposición malta"),
        (laura, "Autoservicio Naguanagua", today, time(9, 30), None),
        (laura, "Supermercado San Diego", today, time(13, 0), "Pedido semanal"),
        (marina, "Kiosco Doña Carmen", today + timedelta(days=1), time(10, 0), None),
        (carlos, "Distribuidora Chivacoa", today + timedelta(days=1), time(11, 0), None),
        (laura, "Mayorista Tocuyito", today + timedelta(days=1), time(8, 30), "Entrega mayor"),
        (laura, "Abastos Guacara", today + timedelta(days=2), time(16, 0), None),
        (marina, "Panadería El Trigal", today + timedelta(days=1), time(15, 0), "Cobrar pendiente"),
    ]
    for seller, cname, d, t, note in scheduled:
        c = clients[cname]
        db.add(
            Visit(
                seller_id=seller.id,
                client_id=c.id,
                status=VisitStatus.programada,
                description=note,
                scheduled_date=d,
                scheduled_time=t,
            )
        )

    # —— Visitas completadas + ventas ——
    completed_specs = [
        # days_ago, seller, client, result, sale_items, payment, credit, origin_note
        (1, marina, "Mercado San Rafael", SaleResult.venta_cerrada, [("COLA1", 4), ("AGUA600", 6)], PaymentMethod.cash_usd, False),
        (1, marina, "Abastos El Río", SaleResult.venta_parcial, [("LECHEABC", 3), ("HARINA1K", 10)], PaymentMethod.transfer_ves, False),
        (2, marina, "Distribuciones Lara Sur", SaleResult.venta_cerrada, [("ACEITE1L", 5), ("ARROZ5K", 8)], PaymentMethod.credit, True),
        (2, marina, "Supermercado La Cascada", SaleResult.sin_venta, [], PaymentMethod.cash_usd, False),
        (3, marina, "Mini Market Los Próceres", SaleResult.venta_cerrada, [("CAFE250", 6), ("GALLETAS", 4)], PaymentMethod.zelle, False),
        (4, marina, "Autoservicio El Parque", SaleResult.venta_cerrada, [("COLA2", 3), ("JUGO1L", 2)], PaymentMethod.credit, True),
        (1, carlos, "Bodega La Esquina", SaleResult.venta_cerrada, [("COLA1", 5), ("MALTALATA", 3)], PaymentMethod.cash_usd, False),
        (2, carlos, "Mayorista Puerto Cabello", SaleResult.venta_cerrada, [("AGUA600", 20), ("COLA1", 10)], PaymentMethod.credit, True),
        (3, carlos, "Abastos San Felipe Norte", SaleResult.venta_parcial, [("HARINA1K", 15), ("JABON", 8)], PaymentMethod.cash_ves, False),
        (5, carlos, "Minimarket Cocorote", SaleResult.sin_venta, [], PaymentMethod.cash_usd, False),
        (1, laura, "Autoservicio Naguanagua", SaleResult.venta_cerrada, [("COLA2", 6), ("LECHEABC", 8)], PaymentMethod.cash_usd, False),
        (2, laura, "Supermercado San Diego", SaleResult.venta_cerrada, [("ACEITE1L", 4), ("ARROZ5K", 6)], PaymentMethod.credit, True),
        (3, laura, "Mayorista Tocuyito", SaleResult.venta_parcial, [("JUGO1L", 5), ("MALTALATA", 4)], PaymentMethod.usdt, False),
        (4, laura, "Abastos Guacara", SaleResult.venta_cerrada, [("GALLETAS", 5), ("CAFE250", 3)], PaymentMethod.credit, True),
        (6, laura, "Bodega Los Guayos", SaleResult.sin_venta, [], PaymentMethod.cash_usd, False),
        (7, marina, "Kiosco Doña Carmen", SaleResult.venta_cerrada, [("AGUA600", 4)], PaymentMethod.cash_usd, False),
        (8, carlos, "Bodega Nirgua Centro", SaleResult.venta_cerrada, [("COLA1", 2), ("JABON", 5)], PaymentMethod.transfer_ves, False),
    ]

    credit_sales: list[Sale] = []
    for days_ago, seller, cname, result, items, pay, credit in completed_specs:
        c = clients[cname]
        visited = _dt(days_ago, 11, 20)
        visit = Visit(
            seller_id=seller.id,
            client_id=c.id,
            status=VisitStatus.completada,
            result=result,
            description=f"Cierre demo · {cname}",
            scheduled_date=visited.date(),
            scheduled_time=time(10, 0),
            visited_at=visited,
            closed_at=visited + timedelta(minutes=25),
            latitude=c.latitude,
            longitude=c.longitude,
            gps_accuracy_m=Decimal("18.0") if c.latitude is not None else None,
            gps_captured_at=visited if c.latitude is not None else None,
            end_latitude=c.latitude,
            end_longitude=c.longitude,
            end_gps_accuracy_m=Decimal("16.0") if c.latitude is not None else None,
            end_gps_captured_at=visited + timedelta(minutes=25) if c.latitude is not None else None,
            gps_skipped=c.latitude is None,
            gps_skip_reason="Sin pin PDV" if c.latitude is None else None,
            created_at=visited - timedelta(hours=2),
        )
        db.add(visit)
        db.flush()

        if c.latitude is not None:
            lat0, lng0 = float(c.latitude), float(c.longitude)
            db.add_all(
                [
                    VisitGpsPoint(
                        visit_id=visit.id,
                        latitude=Decimal(str(lat0)),
                        longitude=Decimal(str(lng0)),
                        accuracy_m=Decimal("14.0"),
                        captured_at=visited - timedelta(minutes=40),
                        source=GpsPointSource.start,
                    ),
                    VisitGpsPoint(
                        visit_id=visit.id,
                        latitude=Decimal(str(round(lat0 + 0.0004, 7))),
                        longitude=Decimal(str(round(lng0 - 0.0003, 7))),
                        accuracy_m=Decimal("22.0"),
                        captured_at=visited - timedelta(minutes=15),
                        source=GpsPointSource.watch,
                    ),
                    VisitGpsPoint(
                        visit_id=visit.id,
                        latitude=Decimal(str(lat0)),
                        longitude=Decimal(str(lng0)),
                        accuracy_m=Decimal("11.0"),
                        captured_at=visited,
                        source=GpsPointSource.end,
                    ),
                ]
            )

        if items:
            product_lines = [(by_sku[sku], qty) for sku, qty in items if sku in by_sku]
            sale = _sale_with_items(
                db,
                seller=seller,
                client=c,
                products=product_lines,
                origin=SaleOrigin.visita,
                payment=pay if not credit else PaymentMethod.credit,
                is_credit=credit,
                notes=f"Venta en visita · {cname}",
                visit=visit,
                created_at=visited,
                fx=Decimal("36.5000") if pay in (PaymentMethod.cash_ves, PaymentMethod.transfer_ves) else None,
            )
            if credit:
                credit_sales.append(sale)

    # Ventas sin visita (mostrador / online)
    extra_sales = [
        (marina, "Mercado San Rafael", [("COLA1", 2)], SaleOrigin.mostrador, PaymentMethod.cash_usd, False, 0),
        (marina, "Abastos El Río", [("LECHEABC", 5)], SaleOrigin.online, PaymentMethod.zelle, False, 1),
        (carlos, "Mayorista Puerto Cabello", [("AGUA600", 12)], SaleOrigin.mostrador, PaymentMethod.credit, True, 2),
        (laura, "Distribuciones Valencia Este", [("ACEITE1L", 3), ("ARROZ5K", 4)], SaleOrigin.online, PaymentMethod.credit, True, 1),
        (laura, "Kiosco Bejuma", [("GALLETAS", 2)], SaleOrigin.mostrador, PaymentMethod.cash_usd, False, 3),
    ]
    for seller, cname, items, origin, pay, credit, days_ago in extra_sales:
        c = clients[cname]
        product_lines = [(by_sku[sku], qty) for sku, qty in items if sku in by_sku]
        sale = _sale_with_items(
            db,
            seller=seller,
            client=c,
            products=product_lines,
            origin=origin,
            payment=pay if not credit else PaymentMethod.credit,
            is_credit=credit,
            notes=f"Orden {origin.value} demo",
            created_at=_dt(days_ago, 16, 30),
        )
        if credit:
            credit_sales.append(sale)

    # Abonos parciales a CxC
    if credit_sales:
        # Primer crédito: abono parcial
        s0 = credit_sales[0]
        half = (Decimal(s0.total_amount) / 2).quantize(Decimal("0.01"))
        db.add(
            SalePayment(
                sale_id=s0.id,
                amount=half,
                currency=CurrencyCode.USD,
                payment_method=PaymentMethod.cash_usd,
                notes="Abono parcial demo",
                received_by_id=supervisor.id,
                created_at=_dt(1, 17, 0),
            )
        )
        # Segundo: liquidado completo (no aparece en open_only)
        if len(credit_sales) > 1:
            s1 = credit_sales[1]
            db.add(
                SalePayment(
                    sale_id=s1.id,
                    amount=s1.total_amount,
                    currency=CurrencyCode.USD,
                    payment_method=PaymentMethod.transfer_ves,
                    notes="Liquidación total demo",
                    received_by_id=supervisor.id,
                    created_at=_dt(0, 18, 0),
                )
            )
        # Tercero: abono chico
        if len(credit_sales) > 2:
            s2 = credit_sales[2]
            db.add(
                SalePayment(
                    sale_id=s2.id,
                    amount=Decimal("20.00"),
                    currency=CurrencyCode.USD,
                    payment_method=PaymentMethod.zelle,
                    notes="Abono inicial",
                    received_by_id=marina.id,
                    created_at=_dt(1, 12, 0),
                )
            )

    # Movimientos de stock
    central, andes, alimentos = suppliers[0], suppliers[1], suppliers[2]
    movements = [
        (by_sku["COLA1"], central, StockMovementKind.purchase, 80, "10.50", "Compra semanal cola"),
        (by_sku["AGUA600"], andes, StockMovementKind.purchase, 120, "5.10", "Ingreso agua"),
        (by_sku["HARINA1K"], alimentos, StockMovementKind.purchase, 200, "1.90", "Harina PAN"),
        (by_sku["ACEITE1L"], central, StockMovementKind.adjustment, -5, None, "Merma demo"),
        (by_sku["JABON"], None, StockMovementKind.adjustment, 15, None, "Conteo físico +"),
    ]
    for product, supplier, kind, qty, cost, notes in movements:
        db.add(
            StockMovement(
                product_id=product.id,
                supplier_id=supplier.id if supplier else None,
                kind=kind,
                quantity=qty,
                unit_cost_usd=Decimal(cost) if cost else None,
                notes=notes,
                created_by_id=supervisor.id,
                created_at=_dt(2, 9, 0),
            )
        )
        product.stock = max(0, product.stock + qty)

    # Alertas pendientes + una reconocida
    far_client = clients["Mercado San Rafael"]
    far_visit = (
        db.query(Visit)
        .filter(
            Visit.client_id == far_client.id,
            Visit.status == VisitStatus.completada,
            Visit.seller_id == marina.id,
        )
        .order_by(Visit.id.desc())
        .first()
    )
    if far_visit and db.query(VisitAlert).filter(VisitAlert.visit_id == far_visit.id).count() == 0:
        db.add_all(
            [
                VisitAlert(
                    visit_id=far_visit.id,
                    seller_id=marina.id,
                    alert_type=AlertType.gps_far,
                    severity=AlertSeverity.critical,
                    message="Cierre a más de 250 m del pin del PDV (demo)",
                    meta_json='{"distance_m": 312}',
                ),
                VisitAlert(
                    visit_id=far_visit.id,
                    seller_id=marina.id,
                    alert_type=AlertType.gps_low_accuracy,
                    severity=AlertSeverity.warning,
                    message="Precisión GPS > 50 m al cerrar (demo)",
                    meta_json='{"accuracy_m": 68}',
                ),
            ]
        )

    skip_client = clients["Supermercado La Cascada"]
    skip_visit = (
        db.query(Visit)
        .filter(Visit.client_id == skip_client.id, Visit.status == VisitStatus.completada)
        .order_by(Visit.id.desc())
        .first()
    )
    if skip_visit:
        skip_visit.gps_skipped = True
        skip_visit.gps_skip_reason = "Sin señal en el PDV"
        if db.query(VisitAlert).filter(VisitAlert.visit_id == skip_visit.id).count() == 0:
            db.add_all(
                [
                    VisitAlert(
                        visit_id=skip_visit.id,
                        seller_id=marina.id,
                        alert_type=AlertType.gps_skipped,
                        severity=AlertSeverity.warning,
                        message="GPS omitido al cerrar visita (demo)",
                    ),
                    VisitAlert(
                        visit_id=skip_visit.id,
                        seller_id=marina.id,
                        alert_type=AlertType.photo_only,
                        severity=AlertSeverity.info,
                        message="Cierre solo con foto de evidencia (demo)",
                        acknowledged_at=_dt(1, 20, 0),
                    ),
                ]
            )

    carlos_client = clients["Minimarket Cocorote"]
    carlos_visit = (
        db.query(Visit)
        .filter(Visit.client_id == carlos_client.id, Visit.seller_id == carlos.id)
        .order_by(Visit.id.desc())
        .first()
    )
    if carlos_visit and db.query(VisitAlert).filter(VisitAlert.visit_id == carlos_visit.id).count() == 0:
        db.add(
            VisitAlert(
                visit_id=carlos_visit.id,
                seller_id=carlos.id,
                alert_type=AlertType.no_gps,
                severity=AlertSeverity.warning,
                message="Visita sin coordenadas de cierre (demo)",
            )
        )


MARINA_TODAY_MARKER = "Ruta hoy ·"
MARINA_OVERDUE_MARKER = "Sin asistir ·"
ALI_TODAY_MARKER = "Ruta Ali ·"


def sync_marina_today_route(db, users: dict[str, User], products: list[Product]) -> None:
    """Marina: exactamente 6 visitas hoy en Lara, orden horario (mapa = agenda).

    Se puede re-ejecutar: regenera la ruta del día de Marina.
    """
    from sqlalchemy import Date, cast, or_

    marina = users["marina"]
    today = _today()
    yesterday = today - timedelta(days=1)
    by_sku = {p.sku: p for p in products}

    today_visits = (
        db.query(Visit)
        .filter(
            Visit.seller_id == marina.id,
            or_(
                Visit.scheduled_date == today,
                cast(Visit.visited_at, Date) == today,
            ),
        )
        .all()
    )

    for v in today_visits:
        is_demo = bool(v.description and v.description.startswith(MARINA_TODAY_MARKER))
        if is_demo:
            sale = db.query(Sale).filter(Sale.visit_id == v.id).first()
            if sale:
                sale.visit_id = None
            db.delete(v)
        else:
            if v.scheduled_date == today:
                v.scheduled_date = yesterday
            if v.visited_at is not None:
                va = v.visited_at
                if va.tzinfo is None:
                    va = va.replace(tzinfo=UTC)
                if va.astimezone(CARACAS).date() == today:
                    v.visited_at = va - timedelta(days=1)

    # Limpiar demos "Ruta hoy" de otros días (p. ej. residual UTC)
    orphans = (
        db.query(Visit)
        .filter(
            Visit.seller_id == marina.id,
            Visit.description.isnot(None),
            Visit.description.startswith(MARINA_TODAY_MARKER),
            Visit.scheduled_date != today,
        )
        .all()
    )
    for v in orphans:
        if v.status == VisitStatus.programada:
            db.delete(v)
        elif v.scheduled_date and v.scheduled_date != today:
            # deja historial cerradas sin marcarlas como "hoy"
            pass

    db.flush()

    # Paradas cercanas en Lara (orden lógico de ruta)
    stops: list[tuple[str, int, int, bool, list[tuple[str, int]]]] = [
        ("Abastos El Río", 8, 0, True, [("COLA1", 2), ("AGUA600", 3)]),
        ("Bodega 24 Horas Centro", 9, 15, True, [("LECHEABC", 2)]),
        ("Mini Market Los Próceres", 10, 30, True, [("HARINA1K", 5), ("GALLETAS", 2)]),
        ("Autoservicio El Parque", 12, 0, False, []),
        ("Supermercado La Cascada", 14, 0, False, []),
        ("Distribuciones Lara Sur", 16, 0, False, []),
    ]

    for i, (cname, hour, minute, done, items) in enumerate(stops, start=1):
        c = _client_by_name(db, cname)
        if not c:
            print(f"  aviso: falta cliente {cname}")
            continue
        _assign(db, marina, c)
        desc = f"{MARINA_TODAY_MARKER}{i}/6 · {cname}"

        if done:
            visited = _dt(0, hour, minute)
            visit = Visit(
                seller_id=marina.id,
                client_id=c.id,
                status=VisitStatus.completada,
                result=SaleResult.venta_cerrada if items else SaleResult.sin_venta,
                description=desc,
                scheduled_date=today,
                scheduled_time=time(hour, minute),
                visited_at=visited,
                closed_at=visited + timedelta(minutes=18),
                latitude=c.latitude,
                longitude=c.longitude,
                gps_accuracy_m=Decimal("12.0"),
                gps_captured_at=visited,
                end_latitude=c.latitude,
                end_longitude=c.longitude,
                end_gps_accuracy_m=Decimal("10.0"),
                end_gps_captured_at=visited + timedelta(minutes=18),
                created_at=visited - timedelta(hours=1),
            )
            db.add(visit)
            db.flush()

            if c.latitude is not None and c.longitude is not None:
                lat0, lng0 = float(c.latitude), float(c.longitude)
                db.add_all(
                    [
                        VisitGpsPoint(
                            visit_id=visit.id,
                            latitude=Decimal(str(lat0)),
                            longitude=Decimal(str(lng0)),
                            accuracy_m=Decimal("14.0"),
                            captured_at=visited - timedelta(minutes=25),
                            source=GpsPointSource.start,
                        ),
                        VisitGpsPoint(
                            visit_id=visit.id,
                            latitude=Decimal(str(round(lat0 + 0.0003, 7))),
                            longitude=Decimal(str(round(lng0 - 0.0002, 7))),
                            accuracy_m=Decimal("18.0"),
                            captured_at=visited - timedelta(minutes=8),
                            source=GpsPointSource.watch,
                        ),
                        VisitGpsPoint(
                            visit_id=visit.id,
                            latitude=Decimal(str(lat0)),
                            longitude=Decimal(str(lng0)),
                            accuracy_m=Decimal("10.0"),
                            captured_at=visited,
                            source=GpsPointSource.end,
                        ),
                    ]
                )

            if items:
                product_lines = [(by_sku[sku], qty) for sku, qty in items if sku in by_sku]
                if product_lines:
                    _sale_with_items(
                        db,
                        seller=marina,
                        client=c,
                        products=product_lines,
                        origin=SaleOrigin.visita,
                        payment=PaymentMethod.cash_usd,
                        is_credit=False,
                        notes=f"Venta ruta hoy · {cname}",
                        visit=visit,
                        created_at=visited,
                    )
        else:
            db.add(
                Visit(
                    seller_id=marina.id,
                    client_id=c.id,
                    status=VisitStatus.programada,
                    description=desc,
                    scheduled_date=today,
                    scheduled_time=time(hour, minute),
                )
            )

    old_overdue = (
        db.query(Visit)
        .filter(
            Visit.seller_id == marina.id,
            Visit.description.isnot(None),
            Visit.description.startswith(MARINA_OVERDUE_MARKER),
        )
        .all()
    )
    for v in old_overdue:
        db.delete(v)
    db.flush()

    overdue_stops: list[tuple[str, date, time]] = [
        ("Mercado San Rafael", yesterday, time(11, 0)),
        ("Abasto Familia Pérez", yesterday - timedelta(days=2), time(9, 30)),
    ]
    for cname, d, t in overdue_stops:
        c = _client_by_name(db, cname)
        if not c:
            print(f"  aviso: falta cliente {cname}")
            continue
        _assign(db, marina, c)
        db.add(
            Visit(
                seller_id=marina.id,
                client_id=c.id,
                status=VisitStatus.programada,
                description=f"{MARINA_OVERDUE_MARKER}{cname}",
                scheduled_date=d,
                scheduled_time=t,
            )
        )

    print("Marina hoy: 6 visitas (3 cerradas + 3 pendientes) + 2 sin asistir")


def _coming_saturday(today: date) -> date:
    """Sábado de esta semana (si hoy es sábado, el mismo día)."""
    if today.weekday() == 5:
        return today
    return today + timedelta(days=(5 - today.weekday()) % 7)


def sync_ali_today_route(db, users: dict[str, User]) -> None:
    """Ali Rodríguez: paradas reales Valencia (hoy) y Puerto Cabello (sábado).

    Idempotente: recrea las programadas con marcador; no toca las ya cerradas.
    """
    ali = users.get("arodriguez")
    if not ali:
        print("  aviso: falta usuario arodriguez")
        return

    today = _today()
    saturday = _coming_saturday(today)

    # name, rif, address, phone, lat, lng, day, hour, minute
    stops: list[tuple[str, str, str, str, float, float, date, int, int]] = [
        (
            "Bodegas Contigo",
            "J-29504620-0",
            "Av. Lisandro Alvarado, Valencia",
            "+58-241-5553201",
            10.16092,
            -68.02793,
            today,
            9,
            0,
        ),
        (
            "Bodega Plaza Los Almendrones",
            "J-44120011-1",
            "Plaza Los Almendrones, Candelaria, Valencia",
            "+58-241-5553202",
            10.16963,
            -68.01266,
            today,
            11,
            0,
        ),
        (
            "Licorería Playa Sonrisa",
            "J-44120022-2",
            "Frente a Playa Sonrisa, Calle 10 Mercado, Puerto Cabello",
            "+58-242-5553203",
            10.47475,
            -68.01188,
            saturday,
            10,
            0,
        ),
        (
            "Hotel Ensenada Suites",
            "J-44120033-3",
            "Av. La Paz, CC Paseo Caribe, Cumboto Sur, Puerto Cabello",
            "+58-242-3641824",
            10.47158,
            -68.02718,
            saturday,
            12,
            0,
        ),
    ]

    planned: list[tuple[Client, date, int, int, str]] = []
    for name, rif, address, phone, lat, lng, day, hour, minute in stops:
        c = _client_by_name(db, name)
        if not c:
            c = Client(
                name=name,
                rif=rif,
                state="Carabobo",
                address=address,
                phone=phone,
                latitude=Decimal(str(lat)),
                longitude=Decimal(str(lng)),
                notes="Ruta prueba Ali Rodríguez · Valencia / Puerto Cabello",
            )
            db.add(c)
            db.flush()
        else:
            c.latitude = Decimal(str(lat))
            c.longitude = Decimal(str(lng))
            c.address = address
            c.phone = c.phone or phone
        _assign(db, ali, c)
        planned.append((c, day, hour, minute, name))

    stale = (
        db.query(Visit)
        .filter(
            Visit.seller_id == ali.id,
            Visit.description.isnot(None),
            Visit.description.startswith(ALI_TODAY_MARKER),
            Visit.status == VisitStatus.programada,
        )
        .all()
    )
    for v in stale:
        db.delete(v)
    db.flush()

    kept = {
        v.client_id
        for v in db.query(Visit)
        .filter(
            Visit.seller_id == ali.id,
            Visit.description.isnot(None),
            Visit.description.startswith(ALI_TODAY_MARKER),
            Visit.status != VisitStatus.programada,
        )
        .all()
    }

    created = 0
    total = len(planned)
    for i, (c, day, hour, minute, name) in enumerate(planned, start=1):
        if c.id in kept:
            continue
        when = "hoy" if day == today else "sábado"
        db.add(
            Visit(
                seller_id=ali.id,
                client_id=c.id,
                status=VisitStatus.programada,
                description=f"{ALI_TODAY_MARKER}{i}/{total} · {when} · {name}",
                scheduled_date=day,
                scheduled_time=time(hour, minute),
            )
        )
        created += 1

    print(
        f"Ali: 2 Valencia hoy + 2 Puerto Cabello sábado ({saturday.isoformat()}) "
        f"· {created} visitas programadas nuevas"
    )


def _ensure_bank_accounts(db) -> dict[str, BankAccount]:
    specs = [
        ("Caja USD", "Efectivo", BankAccountType.cash, CurrencyCode.USD, "Caja física oficina", 10),
        ("Caja Bs", "Efectivo", BankAccountType.cash, CurrencyCode.VES, "Caja bolívares", 20),
        ("Banesco empresa", "Banesco", BankAccountType.bank, CurrencyCode.VES, "Cuenta ****4521", 30),
        ("Zelle EnRutas", "Zelle", BankAccountType.zelle, CurrencyCode.USD, "cobros@enrutas.ve", 40),
        ("Pago Móvil", "Banesco", BankAccountType.pago_movil, CurrencyCode.VES, "0412-5557788 · V-12345678", 50),
    ]
    out: dict[str, BankAccount] = {}
    for name, bank, atype, currency, hint, order in specs:
        acc = db.query(BankAccount).filter(BankAccount.name == name).first()
        if not acc:
            acc = BankAccount(
                name=name,
                bank_name=bank,
                account_type=atype,
                currency=currency,
                pay_hint=hint,
                is_active=True,
                sort_order=order,
            )
            db.add(acc)
            db.flush()
        out[name] = acc
    return out


def _ensure_payables_demo(db) -> None:
    if db.query(PayableInvoice).count() > 0:
        return
    today = _today()
    rows = [
        ("Distribuidora Andes", "Pedido semanal snacks", Decimal("420.00"), PayableStatus.open, today + timedelta(days=7)),
        ("Bebidas del Centro", "Agua y refrescos", Decimal("180.00"), PayableStatus.partial, today + timedelta(days=3)),
        ("Empaque Lara", "Bolsas y precintos", Decimal("65.00"), PayableStatus.paid, today - timedelta(days=2)),
    ]
    for name, desc, amount, status, due in rows:
        db.add(
            PayableInvoice(
                supplier_name=name,
                description=desc,
                amount=amount,
                currency=CurrencyCode.USD,
                status=status,
                due_date=due,
            )
        )


def run() -> None:
    ensure_schema(engine)
    db = SessionLocal()
    try:
        users = _ensure_users(db)
        suppliers = _ensure_suppliers(db)
        products = _ensure_products(db)
        _ensure_fx(db, users["supervisor"])
        banks = _ensure_bank_accounts(db)
        _ensure_payables_demo(db)
        db.flush()

        seed_rich_demo(db, users, products, suppliers)
        sync_marina_today_route(db, users, products)
        sync_ali_today_route(db, users)

        # Movimientos demo si la caja está vacía
        if db.query(BankMovement).count() == 0 and banks.get("Caja USD"):
            caja = banks["Caja USD"]
            db.add(
                BankMovement(
                    bank_account_id=caja.id,
                    kind=BankMovementKind.income,
                    amount=Decimal("250.00"),
                    currency=CurrencyCode.USD,
                    payment_method=PaymentMethod.cash_usd,
                    notes="Saldo inicial demo",
                    created_by_id=users["supervisor"].id,
                )
            )
            zelle = banks.get("Zelle EnRutas")
            if zelle:
                db.add(
                    BankMovement(
                        bank_account_id=zelle.id,
                        kind=BankMovementKind.income,
                        amount=Decimal("120.00"),
                        currency=CurrencyCode.USD,
                        payment_method=PaymentMethod.zelle,
                        reference="ZL-88921",
                        notes="Cobro demo Zelle",
                        created_by_id=users["supervisor"].id,
                    )
                )

        db.commit()

        n_clients = db.query(Client).count()
        n_visits = db.query(Visit).count()
        n_sales = db.query(Sale).count()
        n_credit = db.query(Sale).filter(Sale.is_credit.is_(True)).count()
        n_pay = db.query(SalePayment).count()
        n_alerts = db.query(VisitAlert).filter(VisitAlert.acknowledged_at.is_(None)).count()
        n_stock = db.query(StockMovement).count()
        n_banks = db.query(BankAccount).count()

        print("Seed OK — dataset demo listo")
        print(
            f"Clientes: {n_clients} · Visitas: {n_visits} · Ventas: {n_sales} "
            f"· Crédito: {n_credit} · Abonos: {n_pay}"
        )
        print(
            f"Alertas abiertas: {n_alerts} · Mov. stock: {n_stock} · Productos: {db.query(Product).count()} "
            f"· Cuentas banco: {n_banks}"
        )
        print("Usuarios: marina / carlos / laura / arodriguez / supervisor / admin @bitacora.local")
        print("Password: demo1234")
    finally:
        db.close()


if __name__ == "__main__":
    run()
