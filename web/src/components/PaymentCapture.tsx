import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { BankAccount, CurrencyCode, PaymentMethod } from "../lib/types";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";
import { TextField } from "./TextField";

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

const METHOD_OPTIONS: { id: PaymentMethod; label: string; cash?: boolean }[] = [
  { id: "cash_usd", label: "Efectivo USD", cash: true },
  { id: "cash_ves", label: "Efectivo Bs", cash: true },
  { id: "pago_movil", label: "Pago móvil" },
  { id: "transfer_ves", label: "Transferencia" },
  { id: "zelle", label: "Zelle" },
  { id: "usdt", label: "USDT" },
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      onChange({ ...value, payment_evidence: null });
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      onChange({ ...value, payment_evidence: dataUrl });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "No se pudo leer la foto");
      onChange({ ...value, payment_evidence: null });
    } finally {
      setPhotoBusy(false);
    }
  }

  const selected = filteredAccounts.find((a) => a.id === value.bank_account_id);

  return (
    <div className="payment-capture">
      <div className="field">
        <span className="field-label">Forma de pago</span>
        <div className="choice-group" role="group" aria-label="Forma de pago">
          {METHOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={value.payment_method === opt.id ? "chip active" : "chip"}
              disabled={disabled}
              onClick={() => onChange({ ...value, payment_method: opt.id })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {needsAccount ? (
        <div className="field">
          <label htmlFor="pay-account">Cuenta destino</label>
          <select
            id="pay-account"
            className="input"
            disabled={disabled || !filteredAccounts.length}
            value={value.bank_account_id ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                bank_account_id: e.target.value ? Number(e.target.value) : null,
              })
            }
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
          </select>
          {selected?.pay_hint ? (
            <p className="muted small" style={{ marginTop: "0.35rem" }}>
              {selected.pay_hint}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted small">El efectivo se registra en caja {currency}.</p>
      )}

      <TextField
        id="pay-ref"
        label="Referencia / código (opcional)"
        value={value.payment_reference}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, payment_reference: e.target.value })}
        placeholder="Ej. 00123456"
      />

      <div className="field">
        <label htmlFor="pay-photo">Comprobante (foto opcional)</label>
        <input
          id="pay-photo"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled || photoBusy}
          onChange={(e) => void onPhoto(e)}
        />
        {photoBusy ? <p className="muted small">Procesando foto…</p> : null}
        {value.payment_evidence ? (
          <p className="muted small" style={{ marginTop: "0.35rem" }}>
            Comprobante listo
          </p>
        ) : null}
        {photoError ? (
          <p className="form-error" role="alert">
            {photoError}
          </p>
        ) : null}
      </div>
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
