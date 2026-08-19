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
import { Button } from "./Button";
import { PayMark } from "./PayMark";
import { PhotoDrop } from "./PhotoDrop";
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
  const shareText = selected && isShareableAccount(selected) ? payAccountShareText(selected) : null;
  const [copied, setCopied] = useState(false);
  const emptyAccountHint =
    needsAccount && !filteredAccounts.length
      ? "No hay cuenta activa para este método. El supervisor la carga en Bancos, o elige otro medio."
      : null;

  return (
    <div className="payment-capture">
      <div className="pay-block">
        <p className="sale-cart-heading">Forma de pago</p>
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
                <Icon size={22} aria-hidden />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pay-block">
        {needsAccount && filteredAccounts.length > 1 ? (
          <>
            <p className="sale-cart-heading">Cuenta destino</p>
            <div className="pay-accounts" role="listbox" aria-label="Cuenta destino">
              {filteredAccounts.map((account) => {
                const active = account.id === value.bank_account_id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "pay-account is-active" : "pay-account"}
                    disabled={disabled}
                    onClick={() => onChange({ ...value, bank_account_id: account.id })}
                  >
                    <PayMark
                      slugs={payMarkSlugs(account)}
                      label={account.bank_name || account.name}
                      size="md"
                    />
                    <span className="sale-cart-copy">
                      <strong>{account.name}</strong>
                      {account.holder_name ? (
                        <span className="muted small">{account.holder_name}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {emptyAccountHint ? (
          <p className="muted small pay-hint" role="status">
            {emptyAccountHint}
          </p>
        ) : null}

        {shareText && selected ? (
          <div className="pay-share-inline">
            <div className="pay-share-head">
              <PayMark
                slugs={payMarkSlugs(selected)}
                label={selected.bank_name || selected.name}
                size="md"
              />
              <div className="pay-share-copy">
                <p className="pay-share-holder">{selected.name}</p>
                {selected.holder_name ? (
                  <p className="muted small">{selected.holder_name}</p>
                ) : null}
                {selected.pay_hint ? <p className="pay-share-hint">{selected.pay_hint}</p> : null}
              </div>
            </div>
            <div className="pay-share-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  void copyText(shareText).then((ok) => {
                    setCopied(ok);
                    if (ok) window.setTimeout(() => setCopied(false), 1800);
                  });
                }}
              >
                <Copy size={16} />
                {copied ? "Copiado" : "Copiar"}
              </Button>
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

        {needsAccount && filteredAccounts.length === 1 && selected && !shareText ? (
          <div className="pay-account is-static">
            <PayMark
              slugs={payMarkSlugs(selected)}
              label={selected.bank_name || selected.name}
              size="md"
            />
            <span className="sale-cart-copy">
              <strong>{selected.name}</strong>
              {selected.holder_name ? (
                <span className="muted small">{selected.holder_name}</span>
              ) : null}
            </span>
          </div>
        ) : null}

        {!needsAccount ? (
          <div className="pay-cash-note">
            <Banknote size={22} aria-hidden />
            <div>
              <strong>Efectivo {currency}</strong>
              <span className="muted small">Se registra en caja. No hace falta cuenta.</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pay-details">
        <TextField
          id="pay-ref"
          label="Referencia / código"
          value={value.payment_reference}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, payment_reference: e.target.value })}
          placeholder="Opcional · ej. 00123456"
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
    </div>
  );
}

function isShareableAccount(account: BankAccount): boolean {
  return account.account_type !== "cash" && Boolean(account.pay_hint || account.holder_name);
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
