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
  state: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};
