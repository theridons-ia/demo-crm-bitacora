from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from .models import CurrencyCode, PaymentMethod, SaleResult, UserRole, VisitStatus


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
    state: str | None = None
    address: str | None = None
    phone: str | None = None
    notes: str | None = None


class ClientOut(ORMModel):
    id: int
    name: str
    state: str | None = None
    address: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    phone: str | None = None
    email: str | None = None
    notes: str | None = None


class SupplierOut(ORMModel):
    id: int
    name: str
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
    currency: CurrencyCode = CurrencyCode.USD
    payment_method: PaymentMethod = PaymentMethod.cash_usd
    is_credit: bool = False
    notes: str | None = None
    items: list[SaleItemIn] = Field(default_factory=list)
    local_uuid: str | None = None
    created_offline: bool = False


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
    currency: CurrencyCode
    payment_method: PaymentMethod
    total_amount: Decimal
    is_credit: bool
    notes: str | None
    created_offline: bool
    created_at: datetime
    items: list[SaleItemOut] = []


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


class VisitClose(BaseModel):
    result: SaleResult
    description: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_accuracy_m: Decimal | None = None
    gps_offline: bool = False
    gps_captured_at: datetime | None = None
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
    sale: SaleIn | None = None


class SyncRequest(BaseModel):
    visits: list[OfflineVisitSync] = Field(default_factory=list)


class SyncResponse(BaseModel):
    accepted: int
    visit_ids: list[int]
    message: str
