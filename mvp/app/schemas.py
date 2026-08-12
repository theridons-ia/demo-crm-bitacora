from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import (
    AlertSeverity,
    AlertType,
    CurrencyCode,
    GpsPointSource,
    PaymentMethod,
    SaleOrigin,
    SaleResult,
    UserRole,
    VisitStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    initials: str
    route_name: str | None = None
    is_active: bool


class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    rif: str | None = Field(default=None, max_length=20)
    ci: str | None = Field(default=None, max_length=20)
    state: str | None = None
    address: str | None = None
    phone: str | None = None
    notes: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    @model_validator(mode="after")
    def require_exactly_one_id(self):
        rif = (self.rif or "").strip() or None
        ci = (self.ci or "").strip() or None
        self.rif = rif
        self.ci = ci
        if rif and ci:
            raise ValueError("Usa RIF o CI, no ambos (un solo identificador)")
        if not rif and not ci:
            raise ValueError("Debes indicar RIF o CI")
        return self


class ClientOut(ORMModel):
    id: int
    name: str
    rif: str | None = None
    ci: str | None = None
    state: str | None = None
    address: str | None = None
    phone: str | None = None
    notes: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    is_active: bool


class ClientUpdate(BaseModel):
    """Actualización de cliente (SF-1.12). Mismos campos que el alta."""

    name: str = Field(min_length=2, max_length=180)
    rif: str | None = Field(default=None, max_length=20)
    ci: str | None = Field(default=None, max_length=20)
    state: str | None = None
    address: str | None = None
    phone: str | None = None
    notes: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None

    @model_validator(mode="after")
    def require_exactly_one_id(self):
        rif = (self.rif or "").strip() or None
        ci = (self.ci or "").strip() or None
        self.rif = rif
        self.ci = ci
        if rif and ci:
            raise ValueError("Usa RIF o CI, no ambos (un solo identificador)")
        if not rif and not ci:
            raise ValueError("Debes indicar RIF o CI")
        return self


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    rif: str | None = Field(default=None, max_length=20)
    ci: str | None = Field(default=None, max_length=20)
    phone: str | None = None
    email: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def require_exactly_one_id(self):
        rif = (self.rif or "").strip() or None
        ci = (self.ci or "").strip() or None
        self.rif = rif
        self.ci = ci
        if rif and ci:
            raise ValueError("Usa RIF o CI, no ambos (un solo identificador)")
        if not rif and not ci:
            raise ValueError("Debes indicar RIF o CI")
        return self


class SupplierOut(ORMModel):
    id: int
    name: str
    rif: str | None = None
    ci: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_active: bool


class ProductCreate(BaseModel):
    sku: str
    name: str
    unit: str = "unidad"
    price_usd: Decimal = Decimal("0")
    stock: int = 0


class ProductOut(ORMModel):
    id: int
    sku: str
    name: str
    unit: str
    price_usd: Decimal
    stock: int
    is_active: bool


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class SaleIn(BaseModel):
    origin: SaleOrigin = SaleOrigin.visita
    currency: CurrencyCode = CurrencyCode.USD
    payment_method: PaymentMethod = PaymentMethod.cash_usd
    is_credit: bool = False
    notes: str | None = None
    items: list[SaleItemIn] = Field(default_factory=list)
    local_uuid: str | None = None
    created_offline: bool = False


class SaleCreate(SaleIn):
    """Venta de primer nivel sin visita (SF-1.8)."""

    client_id: int
    origin: SaleOrigin = SaleOrigin.mostrador

    @model_validator(mode="after")
    def origin_must_be_standalone(self):
        if self.origin == SaleOrigin.visita:
            raise ValueError("Para origen visita cierra la visita; aquí usa mostrador u online")
        return self


class SaleItemOut(ORMModel):
    product_id: int
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class SaleOut(ORMModel):
    id: int
    visit_id: int | None
    seller_id: int
    client_id: int
    origin: SaleOrigin
    currency: CurrencyCode
    payment_method: PaymentMethod
    total_amount: Decimal
    is_credit: bool
    notes: str | None
    created_offline: bool
    created_at: datetime
    items: list[SaleItemOut] = []
    client: ClientOut | None = None


class VisitCreate(BaseModel):
    client_id: int
    status: VisitStatus = VisitStatus.en_curso
    description: str | None = None
    scheduled_date: date | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_accuracy_m: Decimal | None = None
    gps_offline: bool = False
    local_uuid: str | None = None


class VisitStart(BaseModel):
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_accuracy_m: Decimal | None = None
    gps_offline: bool = False


class VisitClose(BaseModel):
    result: SaleResult
    description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_accuracy_m: Decimal | None = None
    gps_offline: bool = False
    gps_captured_at: datetime | None = None
    gps_skipped: bool = False
    gps_skip_reason: str | None = None
    photo_evidence: str | None = Field(default=None, max_length=600_000)
    sale: SaleIn | None = None
    local_uuid: str | None = None


class VisitOut(ORMModel):
    id: int
    seller_id: int
    client_id: int
    status: VisitStatus
    result: SaleResult | None
    description: str | None
    scheduled_date: date | None
    visited_at: datetime | None
    latitude: Decimal | None
    longitude: Decimal | None
    gps_accuracy_m: Decimal | None
    gps_captured_at: datetime | None
    gps_offline: bool
    gps_skipped: bool = False
    gps_skip_reason: str | None = None
    photo_evidence: str | None = None
    local_uuid: str | None
    created_at: datetime
    client: ClientOut | None = None
    sale: SaleOut | None = None


class OfflineVisitSync(BaseModel):
    local_uuid: str
    client_id: int
    description: str | None = None
    result: SaleResult
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_accuracy_m: Decimal | None = None
    gps_captured_at: datetime | None = None
    visited_at: datetime | None = None
    gps_skipped: bool = False
    gps_skip_reason: str | None = None
    photo_evidence: str | None = Field(default=None, max_length=600_000)
    sale: SaleIn | None = None


class SyncRequest(BaseModel):
    visits: list[OfflineVisitSync] = Field(default_factory=list)


class SyncResponse(BaseModel):
    accepted: int
    visit_ids: list[int]
    message: str


class VisitGpsPointCreate(BaseModel):
    latitude: Decimal
    longitude: Decimal
    accuracy_m: Decimal | None = None
    captured_at: datetime | None = None
    source: GpsPointSource = GpsPointSource.watch


class VisitGpsPointOut(ORMModel):
    id: int
    visit_id: int
    latitude: Decimal
    longitude: Decimal
    accuracy_m: Decimal | None
    captured_at: datetime
    source: GpsPointSource


class VisitAlertOut(ORMModel):
    id: int
    visit_id: int
    seller_id: int
    alert_type: AlertType
    severity: AlertSeverity
    message: str
    meta_json: str | None
    acknowledged_at: datetime | None
    created_at: datetime
