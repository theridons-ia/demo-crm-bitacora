import {
  Banknote,
  CircleDollarSign,
  Landmark,
  Send,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import type { BankAccount, CurrencyCode, PaymentMethod } from "../lib/types";
import { PhotoDrop } from "./PhotoDrop";
import { SelectField, TextField } from "./TextField";

export type PaymentCaptureValue = {
  payment_method: PaymentMethod;
  bank_account_id: number | null;
  payment_reference: string;
  payment_evidence: string | null;
};

type Props = {
  value: PaymentCaptureValue;
  onChange: (next: PaymentCaptureValue) => void;
  accounts: BankAccount[];
  currency: CurrencyCode;
  disabled?: boolean;
  /** Si true, no muestra métodos de crédito. */
  hideCredit?: boolean;
};

const METHOD_OPTIONS: { id: PaymentMethod; label: string; cash?: boolean; icon: LucideIcon }[] = [
  { id: "cash_usd", label: "Efectivo USD", cash: true, icon: Banknote },
  { id: "cash_ves", label: "Efectivo Bs", cash: true, icon: Banknote },
  { id: "pago_movil", label: "Pago móvil", icon: Smartphone },
  { id: "transfer_ves", label: "Transferencia", icon: Landmark },
  { id: "zelle", label: "Zelle", icon: Send },
  { id: "usdt", label: "USDT", icon: CircleDollarSign },
];

function methodMatchesAccount(method: PaymentMethod, account: BankAccount): boolean {
  if (method === "cash_usd" || method === "cash_ves" || method === "cash_eur") {
    return account.account_type === "cash";
  }
  if (method === "zelle") return account.account_type === "zelle";
  if (method === "pago_movil") return account.account_type === "pago_movil";
  if (method === "transfer_ves") return account.account_type === "bank";
  return true;
}

/** Captura de cobro: método, cuenta destino, referencia y foto opcional. */
export function PaymentCapture({
  value,
  onChange,
  accounts,
  currency,
  disabled,
}: Props) {
  const filteredAccounts = useMemo(() => {
    return accounts.filter(
      (a) =>
        a.is_active &&
        a.currency === currency &&
        methodMatchesAccount(value.payment_method, a),
    );
  }, [accounts, currency, value.payment_method]);

  const needsAccount = !METHOD_OPTIONS.find((m) => m.id === value.payment_method)?.cash;

  useEffect(() => {
    if (!needsAccount) {
      if (value.bank_account_id != null) {
        onChange({ ...value, bank_account_id: null });
      }
      return;
    }
    const stillValid =
      value.bank_account_id != null &&
      filteredAccounts.some((a) => a.id === value.bank_account_id);
    if (stillValid) return;
    const first = filteredAccounts[0];
    if ((first?.id ?? null) === value.bank_account_id) return;
    onChange({ ...value, bank_account_id: first ? first.id : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync cuenta al cambiar método/moneda
  }, [needsAccount, value.payment_method, currency, filteredAccounts.length, value.bank_account_id]);

  const selected = filteredAccounts.find((a) => a.id === value.bank_account_id);

  return (
    <div className="payment-capture">
      <div className="field">
        <span className="field-label">Forma de pago</span>
        <div className="pay-methods" role="group" aria-label="Forma de pago">
          {METHOD_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = value.payment_method === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={active ? "pay-method is-active" : "pay-method"}
                disabled={disabled}
                onClick={() => onChange({ ...value, payment_method: opt.id })}
              >
                <Icon size={16} aria-hidden />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {needsAccount ? (
        <SelectField
          id="pay-account"
          label="Cuenta destino"
          disabled={disabled || !filteredAccounts.length}
          value={value.bank_account_id ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              bank_account_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          hint={selected?.pay_hint || undefined}
        >
          {!filteredAccounts.length ? (
            <option value="">Sin cuentas para este método</option>
          ) : null}
          {filteredAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.pay_hint ? ` · ${a.pay_hint}` : ""}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className="muted small pay-hint">El efectivo se registra en caja {currency}.</p>
      )}

      <TextField
        id="pay-ref"
        label="Referencia / código (opcional)"
        value={value.payment_reference}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, payment_reference: e.target.value })}
        placeholder="Ej. 00123456"
      />

      <PhotoDrop
        id="pay-photo"
        label="Comprobante"
        hint="Opcional · JPG o PNG"
        readyHint="Se adjunta a la OV"
        value={value.payment_evidence}
        disabled={disabled}
        onChange={(next) => onChange({ ...value, payment_evidence: next })}
      />
    </div>
  );
}

export function emptyPaymentCapture(
  method: PaymentMethod = "cash_usd",
): PaymentCaptureValue {
  return {
    payment_method: method,
    bank_account_id: null,
    payment_reference: "",
    payment_evidence: null,
  };
}
