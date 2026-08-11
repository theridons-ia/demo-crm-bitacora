"""Seed inicial del MVP."""

from decimal import Decimal

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Client, Product, Supplier, User, UserRole


def run() -> None:
    Base.metadata.create_all(bind=engine)
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
                        full_name="Ana Supervisor",
                        hashed_password=hash_password("demo1234"),
                        role=UserRole.supervisor,
                        initials="AS",
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

        if db.query(Client).count() == 0:
            db.add_all(
                [
                    Client(name="Mercado San Rafael", state="Yaracuy", address="San Felipe"),
                    Client(name="Bodega La Esquina", state="Carabobo", address="Valencia"),
                    Client(name="Abastos El Río", state="Lara", address="Barquisimeto"),
                ]
            )

        if db.query(Supplier).count() == 0:
            db.add(Supplier(name="Distribuidora Central", phone="+58-000-0000"))

        if db.query(Product).count() == 0:
            db.add_all(
                [
                    Product(sku="COLA1", name="Cola #1", unit="caja", price_usd=Decimal("12"), stock=200),
                    Product(sku="COLA2", name="Cola #2", unit="caja", price_usd=Decimal("15"), stock=180),
                    Product(sku="LECHEABC", name="Leche ABC", unit="pack", price_usd=Decimal("8"), stock=250),
                ]
            )

        db.commit()
        print("Seed OK")
        print("Usuarios: marina@bitacora.local / supervisor@bitacora.local / admin@bitacora.local")
        print("Password: demo1234")
    finally:
        db.close()


if __name__ == "__main__":
    run()
