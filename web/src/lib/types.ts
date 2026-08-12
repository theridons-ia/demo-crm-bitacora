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
  visited_at: string | null;
  latitude: string | null;
  longitude: string | null;
  gps_accuracy_m: string | null;
  gps_captured_at: string | null;
  gps_offline: boolean;
  local_uuid: string | null;
  created_at: string;
  client: Client | null;
};

export type GpsPointSource = "start" | "watch" | "end";

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
