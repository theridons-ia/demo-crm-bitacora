import {
  Banknote,
  CircleDollarSign,
  Copy,
  Landmark,
  MessageCircle,
  Send,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BankAccount, CurrencyCode, PaymentMethod } from "../lib/types";
import { payMarkSlugs } from "../lib/payMarks";
import { copyText, payAccountShareText, whatsappShareUrl } from "../lib/sharePay";
import { PayMark } from "./PayMark";
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

const METHOD_OPTIONS: {
  id: PaymentMethod;
  label: string;
  cash?: boolean;
  icon: LucideIcon;
  currencies: CurrencyCode[];
}[] = [
  { id: "cash_usd", label: "Efectivo USD", cash: true, icon: Banknote, currencies: ["USD"] },
  { id: "zelle", label: "Zelle", icon: Send, currencies: ["USD"] },
  { id: "transfer_usd", label: "Banco US", icon: Landmark, currencies: ["USD"] },
  { id: "usdt", label: "USDT", icon: CircleDollarSign, currencies: ["USD"] },
  { id: "cash_ves", label: "Efectivo Bs", cash: true, icon: Banknote, currencies: ["VES"] },
  { id: "pago_movil", label: "Pago móvil", icon: Smartphone, currencies: ["VES"] },
  { id: "transfer_ves", label: "Transferencia", icon: Landmark, currencies: ["VES"] },
];

function methodsForCurrency(currency: CurrencyCode) {
  const key: CurrencyCode = currency === "VES" ? "VES" : "USD";
  return METHOD_OPTIONS.filter((m) => m.currencies.includes(key));
}

function methodMatchesAccount(method: PaymentMethod, account: BankAccount): boolean {
  if (method === "cash_usd" || method === "cash_ves" || method === "cash_eur") {
    return account.account_type === "cash";
  }
  if (method === "zelle") return account.account_type === "zelle";
  if (method === "usdt") return account.account_type === "usdt" || account.account_type === "other";
  if (method === "pago_movil") return account.account_type === "pago_movil";
  if (method === "transfer_ves") return account.account_type === "bank";
  if (method === "transfer_usd") return account.account_type === "bank";
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
  const visibleMethods = useMemo(() => methodsForCurrency(currency), [currency]);
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
    const allowed = visibleMethods.some((m) => m.id === value.payment_method);
    if (!allowed) {
      const fallback = currency === "VES" ? "cash_ves" : "cash_usd";
      onChange({ ...value, payment_method: fallback, bank_account_id: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, value.payment_method, visibleMethods]);

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
  const accountHint = distinctPayHint(selected);
  const shareText = selected && isShareableAccount(selected) ? payAccountShareText(selected) : null;
  const [copied, setCopied] = useState(false);
  const emptyAccountHint =
    needsAccount && !filteredAccounts.length
      ? "No hay cuenta activa para este método. El supervisor la carga en Bancos, o elige otro medio."
      : null;

  return (
    <div className="payment-capture">
      <div className="field">
        <span className="field-label">Forma de pago</span>
        <div className="pay-methods" role="group" aria-label="Forma de pago">
          {visibleMethods.map((opt) => {
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

      {needsAccount && filteredAccounts.length ? (
        <SelectField
          id="pay-account"
          label="Cuenta destino"
          disabled={disabled}
          value={value.bank_account_id ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              bank_account_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          hint={accountHint}
        >
          {filteredAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      {needsAccount && emptyAccountHint ? (
        <p className="muted small pay-hint" role="status">
          {emptyAccountHint}
        </p>
      ) : null}
      {shareText ? (
        <div className="pay-share-inline">
          <div className="pay-share-head">
            {selected ? (
              <PayMark
                slugs={payMarkSlugs(selected)}
                label={selected.bank_name || selected.name}
                size="md"
              />
            ) : null}
            <div className="pay-share-copy">
              {selected?.holder_name || selected?.account_type === "zelle" ? (
                <p className="pay-share-holder">
                  Nombre: {selected.holder_name?.trim() || selected.name}
                </p>
              ) : null}
              <p className="pay-share-hint">{selected?.pay_hint}</p>
            </div>
          </div>
          <div className="pay-share-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={disabled}
              onClick={() => {
                void copyText(shareText).then((ok) => {
                  setCopied(ok);
                  if (ok) window.setTimeout(() => setCopied(false), 1800);
                });
              }}
            >
              <Copy size={16} />
              {copied ? "Copiado" : "Copiar datos"}
            </button>
            <a
              className="btn btn-secondary"
              href={whatsappShareUrl(shareText)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          </div>
        </div>
      ) : null}
      {!needsAccount ? (
        <p className="muted small pay-hint">El efectivo se registra en caja {currency}.</p>
      ) : null}

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

function isShareableAccount(account: BankAccount): boolean {
  return account.account_type !== "cash" && Boolean(account.pay_hint || account.holder_name);
}

function distinctPayHint(account: BankAccount | undefined): string | undefined {
  const hint = account?.pay_hint?.trim();
  if (!hint) return undefined;
  const name = account?.name.trim() ?? "";
  if (foldText(hint) === foldText(name)) return undefined;
  if (foldText(name).includes(foldText(hint))) return undefined;
  return hint;
}

function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
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
