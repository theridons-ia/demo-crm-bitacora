/** Tipos que coinciden con el API FastAPI (schemas.py). */

export type UserRole = "admin" | "supervisor" | "vendedor";

export type User = {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  initials: string;
  route_name: string | null;
  is_active: boolean;
};

export type Client = {
  id: number;
  name: string;
  rif: string | null;
  ci: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
};

export type VisitStatus = "programada" | "en_curso" | "completada" | "cancelada";
export type SaleResult = "sin_venta" | "venta_parcial" | "venta_cerrada";

export type Visit = {
  id: number;
  seller_id: number;
  client_id: number;
  status: VisitStatus;
  result: SaleResult | null;
  description: string | null;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  visited_at: string | null;
  closed_at?: string | null;
  latitude: string | null;
  longitude: string | null;
  gps_accuracy_m: string | null;
  gps_captured_at: string | null;
  gps_offline: boolean;
  gps_skipped?: boolean;
  gps_skip_reason?: string | null;
  photo_evidence?: string | null;
  end_latitude?: string | null;
  end_longitude?: string | null;
  end_gps_accuracy_m?: string | null;
  end_gps_captured_at?: string | null;
  local_uuid: string | null;
  created_at: string;
  client: Client | null;
  seller?: User | null;
  sale?: Sale | null;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  price_usd: string;
  stock: number;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  presentation?: string | null;
  barcode?: string | null;
  cost_usd?: string | null;
  pack_units?: number | null;
  min_stock?: number;
  lot?: string | null;
  expires_on?: string | null;
  notes?: string | null;
  is_active: boolean;
};

export type CurrencyCode = "USD" | "VES" | "EUR";
export type PaymentMethod =
  | "cash_usd"
  | "zelle"
  | "usdt"
  | "cash_ves"
  | "transfer_ves"
  | "cash_eur"
  | "credit"
  | "pago_movil";

export type BankAccountType = "cash" | "bank" | "zelle" | "pago_movil" | "other";
export type BankMovementKind = "income" | "expense";
export type PayableStatus = "open" | "paid" | "partial";

export type BankAccount = {
  id: number;
  name: string;
  bank_name: string | null;
  account_type: BankAccountType;
  currency: CurrencyCode;
  pay_hint: string | null;
  is_active: boolean;
  sort_order: number;
  balance: string;
  created_at: string;
};

export type BankMovement = {
  id: number;
  bank_account_id: number;
  kind: BankMovementKind;
  amount: string;
  currency: CurrencyCode;
  payment_method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  sale_id: number | null;
  sale_payment_id: number | null;
  created_at: string;
  account_name: string | null;
};

export type PayableInvoice = {
  id: number;
  supplier_name: string;
  description: string | null;
  amount: string;
  currency: CurrencyCode;
  status: PayableStatus;
  due_date: string | null;
  created_at: string;
};

export type SaleOrigin = "visita" | "mostrador" | "online";

export type SaleItem = {
  product_id: number;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type Sale = {
  id: number;
  visit_id: number | null;
  seller_id: number;
  client_id: number;
  origin: SaleOrigin;
  currency: CurrencyCode;
  payment_method: PaymentMethod;
  bank_account_id?: number | null;
  payment_reference?: string | null;
  total_amount: string;
  is_credit: boolean;
  apply_iva?: boolean;
  fx_rate_usd_ves?: string | null;
  notes: string | null;
  quote_snapshot?: string | null;
  created_offline: boolean;
  created_at: string;
  items: SaleItem[];
  client: Client | null;
  seller?: User | null;
};

export type GpsPointSource = "start" | "watch" | "end";

export type AlertType =
  | "no_gps"
  | "gps_far"
  | "photo_only"
  | "gps_skipped"
  | "gps_low_accuracy";

export type AlertSeverity = "info" | "warning" | "critical";

export type VisitAlert = {
  id: number;
  visit_id: number;
  seller_id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  meta_json: string | null;
  acknowledged_at: string | null;
  created_at: string;
  seller_name: string | null;
  client_name: string | null;
  client_id: number | null;
};

export type VisitGpsPoint = {
  id: number;
  visit_id: number;
  latitude: string;
  longitude: string;
  accuracy_m: string | null;
  captured_at: string;
  source: GpsPointSource;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};
