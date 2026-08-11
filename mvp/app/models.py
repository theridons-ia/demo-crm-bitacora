import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    supervisor = "supervisor"
    vendedor = "vendedor"


class VisitStatus(str, enum.Enum):
    programada = "programada"
    en_curso = "en_curso"
    completada = "completada"
    cancelada = "cancelada"


class SaleResult(str, enum.Enum):
    sin_venta = "sin_venta"
    venta_parcial = "venta_parcial"
    venta_cerrada = "venta_cerrada"


class CurrencyCode(str, enum.Enum):
    USD = "USD"
    VES = "VES"
    EUR = "EUR"


class PaymentMethod(str, enum.Enum):
    cash_usd = "cash_usd"
    zelle = "zelle"
    usdt = "usdt"
    cash_ves = "cash_ves"
    transfer_ves = "transfer_ves"
    cash_eur = "cash_eur"
    credit = "credit"


class SaleOrigin(str, enum.Enum):
    """De dónde nace la venta: visita de campo, mostrador u online."""

    visita = "visita"
    mostrador = "mostrador"
    online = "online"


class GpsPointSource(str, enum.Enum):
    start = "start"
    watch = "watch"
    end = "end"


class AlertType(str, enum.Enum):
    no_gps = "no_gps"
    gps_far = "gps_far"
    photo_only = "photo_only"
    gps_skipped = "gps_skipped"


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.vendedor)
    initials: Mapped[str] = mapped_column(String(4), default="")
    route_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    visits: Mapped[list["Visit"]] = relationship(back_populates="seller")
    sales: Mapped[list["Sale"]] = relationship(back_populates="seller")


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    visits: Mapped[list["Visit"]] = relationship(back_populates="client")
    sales: Mapped[list["Sale"]] = relationship(back_populates="client")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(180), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    unit: Mapped[str] = mapped_column(String(40), default="unidad")
    price_usd: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sale_items: Mapped[list["SaleItem"]] = relationship(back_populates="product")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    status: Mapped[VisitStatus] = mapped_column(Enum(VisitStatus), default=VisitStatus.en_curso)
    result: Mapped[SaleResult | None] = mapped_column(Enum(SaleResult), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    visited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    gps_accuracy_m: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    gps_captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    gps_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    client_synced: Mapped[bool] = mapped_column(Boolean, default=True)
    local_uuid: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    seller: Mapped[User] = relationship(back_populates="visits")
    client: Mapped[Client] = relationship(back_populates="visits")
    sale: Mapped["Sale | None"] = relationship(back_populates="visit", uselist=False)
    gps_points: Mapped[list["VisitGpsPoint"]] = relationship(
        back_populates="visit", cascade="all, delete-orphan"
    )
    alerts: Mapped[list["VisitAlert"]] = relationship(
        back_populates="visit", cascade="all, delete-orphan"
    )


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int | None] = mapped_column(ForeignKey("visits.id"), nullable=True, unique=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), index=True)
    origin: Mapped[SaleOrigin] = mapped_column(
        Enum(SaleOrigin, name="saleorigin", native_enum=False, length=20),
        default=SaleOrigin.visita,
    )
    currency: Mapped[CurrencyCode] = mapped_column(Enum(CurrencyCode), default=CurrencyCode.USD)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), default=PaymentMethod.cash_usd
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    is_credit: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_uuid: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    created_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    visit: Mapped[Visit | None] = relationship(back_populates="sale")
    seller: Mapped[User] = relationship(back_populates="sales")
    client: Mapped[Client] = relationship(back_populates="sales")
    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"
    __table_args__ = (UniqueConstraint("sale_id", "product_id", name="uq_sale_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    sale: Mapped[Sale] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="sale_items")


class VisitGpsPoint(Base):
    """Muestra GPS durante una visita en_curso (trail ligero)."""

    __tablename__ = "visit_gps_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    accuracy_m: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[GpsPointSource] = mapped_column(
        Enum(GpsPointSource, name="gpspointsource", native_enum=False, length=20),
        default=GpsPointSource.watch,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    visit: Mapped[Visit] = relationship(back_populates="gps_points")


class VisitAlert(Base):
    """Alerta visible para vendedor y supervisor (GPS lejos, sin GPS, solo foto…)."""

    __tablename__ = "visit_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    alert_type: Mapped[AlertType] = mapped_column(
        Enum(AlertType, name="alerttype", native_enum=False, length=32)
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, name="alertseverity", native_enum=False, length=20),
        default=AlertSeverity.warning,
    )
    message: Mapped[str] = mapped_column(String(255))
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    visit: Mapped[Visit] = relationship(back_populates="alerts")
    seller: Mapped[User] = relationship()
