from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .models import (
    AlertSeverity,
    AlertType,
    BankAccountType,
    BankMovementKind,
    CurrencyCode,
    GpsPointSource,
    PayableStatus,
    PaymentMethod,
    SaleOrigin,
    SaleResult,
    StockMovementKind,
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


class ClientAssignmentsOut(BaseModel):
    seller_id: int
    client_ids: list[int]


class ClientAssignmentsUpdate(BaseModel):
    client_ids: list[int] = Field(default_factory=list)

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


class CatalogVisibilityOut(BaseModel):
    seller_id: int
    unrestricted: bool
    product_ids: list[int]


class CatalogVisibilityUpdate(BaseModel):
    """Si unrestricted=True, el vendedor ve todo el catálogo (se borran filas)."""

    unrestricted: bool = False
    product_ids: list[int] = Field(default_factory=list)


class StockMovementCreate(BaseModel):
    product_id: int
    kind: StockMovementKind = StockMovementKind.purchase
    quantity: int
    supplier_id: int | None = None
    unit_cost_usd: Decimal | None = None
    notes: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def quantity_rules(self):
        if self.kind == StockMovementKind.purchase and self.quantity <= 0:
            raise ValueError("La compra requiere cantidad positiva")
        if self.kind == StockMovementKind.adjustment and self.quantity == 0:
            raise ValueError("El ajuste no puede ser 0")
        return self


class StockMovementOut(ORMModel):
    id: int
    product_id: int
    supplier_id: int | None
    kind: StockMovementKind
    quantity: int
    unit_cost_usd: Decimal | None
    notes: str | None
    created_by_id: int
    created_at: datetime
    product_name: str | None = None
    supplier_name: str | None = None
    created_by_name: str | None = None
    stock_after: int | None = None


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class SaleIn(BaseModel):
    origin: SaleOrigin = SaleOrigin.visita
    currency: CurrencyCode = CurrencyCode.USD
    payment_method: PaymentMethod = PaymentMethod.cash_usd
    is_credit: bool = False
    bank_account_id: int | None = None
    payment_reference: str | None = Field(default=None, max_length=64)
    payment_evidence: str | None = Field(default=None, max_length=600_000)
    notes: str | None = None
    apply_iva: bool = False
    quote_snapshot: str | None = Field(default=None, max_length=200_000)
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
    bank_account_id: int | None = None
    payment_reference: str | None = None
    total_amount: Decimal
    is_credit: bool
    apply_iva: bool = False
    fx_rate_usd_ves: Decimal | None = None
    notes: str | None
    quote_snapshot: str | None = None
    created_offline: bool
    created_at: datetime
    items: list[SaleItemOut] = []
    client: ClientOut | None = None


class SalePaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    currency: CurrencyCode = CurrencyCode.USD
    payment_method: PaymentMethod = PaymentMethod.cash_usd
    bank_account_id: int | None = None
    payment_reference: str | None = Field(default=None, max_length=64)
    payment_evidence: str | None = Field(default=None, max_length=600_000)
    notes: str | None = Field(default=None, max_length=255)


class SalePaymentOut(ORMModel):
    id: int
    sale_id: int
    amount: Decimal
    currency: CurrencyCode
    payment_method: PaymentMethod
    bank_account_id: int | None = None
    payment_reference: str | None = None
    notes: str | None
    received_by_id: int
    created_at: datetime
    received_by_name: str | None = None


class ReceivableOut(BaseModel):
    sale_id: int
    client_id: int
    client_name: str | None = None
    seller_id: int
    seller_name: str | None = None
    currency: CurrencyCode
    total_amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    created_at: datetime
    notes: str | None = None
    payments: list[SalePaymentOut] = []


class BankAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    bank_name: str | None = Field(default=None, max_length=80)
    account_type: BankAccountType = BankAccountType.bank
    currency: CurrencyCode = CurrencyCode.USD
    pay_hint: str | None = Field(default=None, max_length=160)
    is_active: bool = True
    sort_order: int = 0


class BankAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    bank_name: str | None = Field(default=None, max_length=80)
    account_type: BankAccountType | None = None
    currency: CurrencyCode | None = None
    pay_hint: str | None = Field(default=None, max_length=160)
    is_active: bool | None = None
    sort_order: int | None = None


class BankAccountOut(ORMModel):
    id: int
    name: str
    bank_name: str | None
    account_type: BankAccountType
    currency: CurrencyCode
    pay_hint: str | None
    is_active: bool
    sort_order: int
    balance: Decimal = Decimal("0")
    created_at: datetime


class BankMovementOut(ORMModel):
    id: int
    bank_account_id: int
    kind: BankMovementKind
    amount: Decimal
    currency: CurrencyCode
    payment_method: PaymentMethod | None = None
    reference: str | None = None
    notes: str | None = None
    sale_id: int | None = None
    sale_payment_id: int | None = None
    created_at: datetime
    account_name: str | None = None


class PayableOut(ORMModel):
    id: int
    supplier_name: str
    description: str | None
    amount: Decimal
    currency: CurrencyCode
    status: PayableStatus
    due_date: date | None
    created_at: datetime


class VisitCreate(BaseModel):
    client_id: int
    status: VisitStatus = VisitStatus.en_curso
    description: str | None = None
    scheduled_date: date | None = None
    scheduled_time: time | None = None
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


class VisitCancel(BaseModel):
    description: str | None = None


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


class VisitAssign(BaseModel):
    """Supervisor asigna visita planificada a un vendedor (SF-2.2)."""

    seller_id: int
    client_id: int
    scheduled_date: date
    scheduled_time: time | None = None
    description: str | None = None


class VisitOut(ORMModel):
    id: int
    seller_id: int
    client_id: int
    status: VisitStatus
    result: SaleResult | None
    description: str | None
    scheduled_date: date | None
    scheduled_time: time | None = None
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
    seller: UserOut | None = None
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
    seller_name: str | None = None
    client_name: str | None = None
    client_id: int | None = None


class FxRateOut(ORMModel):
    id: int
    rate_date: date
    usd_to_ves: Decimal
    notes: str | None
    created_by_id: int | None
    created_at: datetime
    updated_at: datetime
    created_by_name: str | None = None


class FxRateUpsert(BaseModel):
    rate_date: date
    usd_to_ves: Decimal = Field(gt=0)
    notes: str | None = Field(default=None, max_length=255)
