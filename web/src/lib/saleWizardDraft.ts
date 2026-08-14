import type { CurrencyCode } from "./types";
import type { PaymentCaptureValue } from "../components/PaymentCapture";
import type { QuoteLine } from "../components/SaleQuoter";

const VISIT_KEY = "enrutas.visit-sale-draft";
const STANDALONE_KEY = "enrutas.standalone-sale-draft";

export type VisitSaleDraft = {
  visitId: number;
  step: number;
  lines: QuoteLine[];
  currency: CurrencyCode;
  isCredit: boolean;
  applyIva: boolean;
  payment: PaymentCaptureValue;
  notes: string;
  issuedAt: string;
};

export type StandaloneSaleDraft = {
  clientId: number | "";
  origin: "mostrador" | "online";
  wizardStep: number;
  lines: QuoteLine[];
  currency: CurrencyCode;
  isCredit: boolean;
  applyIva: boolean;
  payment: PaymentCaptureValue;
  notes: string;
  issuedAt: string;
  draftCode: string;
};

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* cuota llena (foto pesada): se intenta sin evidencia */
    try {
      const copy = JSON.parse(JSON.stringify(value)) as { payment?: PaymentCaptureValue };
      if (copy.payment) copy.payment.payment_evidence = null;
      sessionStorage.setItem(key, JSON.stringify(copy));
    } catch {
      /* ignore */
    }
  }
}

export function saveVisitSaleDraft(draft: VisitSaleDraft) {
  write(VISIT_KEY, draft);
}

export function loadVisitSaleDraft(visitId: number): VisitSaleDraft | null {
  const draft = read<VisitSaleDraft>(VISIT_KEY);
  if (!draft || draft.visitId !== visitId) return null;
  return draft;
}

export function hasVisitSaleDraft(visitId: number): boolean {
  return loadVisitSaleDraft(visitId) != null;
}

export function clearVisitSaleDraft() {
  try {
    sessionStorage.removeItem(VISIT_KEY);
  } catch {
    /* ignore */
  }
}

export function saveStandaloneSaleDraft(draft: StandaloneSaleDraft) {
  write(STANDALONE_KEY, draft);
}

export function loadStandaloneSaleDraft(): StandaloneSaleDraft | null {
  return read<StandaloneSaleDraft>(STANDALONE_KEY);
}

export function clearStandaloneSaleDraft() {
  try {
    sessionStorage.removeItem(STANDALONE_KEY);
  } catch {
    /* ignore */
  }
}
