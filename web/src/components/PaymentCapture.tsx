import {
  Banknote,
  CircleDollarSign,
  Copy,
  Eye,
  EyeOff,
  Landmark,
  MessageCircle,
  Send,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BankAccount, CurrencyCode, PaymentMethod } from "../lib/types";
import { MAX_PAYMENT_EVIDENCE_PHOTOS, parsePaymentEvidence, serializePaymentEvidence } from "../lib/imageEvidence";
import { payMarkSlugs } from "../lib/payMarks";
import { copyText, payAccountShareText, whatsappShareUrl } from "../lib/sharePay";
import { Button } from "./Button";
import { PhotoDrop } from "./PhotoDrop";
import { SearchPickField } from "./SearchPickField";
import { TextField } from "./TextField";

export type PaymentCaptureValue = {
  payment_method: PaymentMethod;
  bank_account_id: number | null;
  payment_reference: string;
  payment_evidence: string | null;
  payment_evidence_photos?: string[];
};

type Props = {
  value: PaymentCaptureValue;
  onChange: (next: PaymentCaptureValue) => void;
  accounts: BankAccount[];
  currency: CurrencyCode;
  disabled?: boolean;
  onProcessingChange?: (busy: boolean) => void;
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
  onProcessingChange,
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
  const isCash = !needsAccount;

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

  useEffect(() => {
    if (isCash && value.payment_reference) {
      onChange({ ...value, payment_reference: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- referencia no aplica para efectivo
  }, [isCash, value.payment_method]);

  const selected = filteredAccounts.find((a) => a.id === value.bank_account_id);
  const shareText = selected && isShareableAccount(selected) ? payAccountShareText(selected) : null;
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const evidencePhotos = useMemo(() => {
    if (value.payment_evidence_photos?.length) return value.payment_evidence_photos;
    return parsePaymentEvidence(value.payment_evidence);
  }, [value.payment_evidence, value.payment_evidence_photos]);
  const emptyAccountHint =
    needsAccount && !filteredAccounts.length
      ? "No hay cuenta activa para este método. El supervisor la carga en Bancos, o elige otro medio."
      : null;

  useEffect(() => {
    setDetailsOpen(false);
  }, [value.payment_method, value.bank_account_id]);

  useEffect(() => {
    onProcessingChange?.(photoBusy);
  }, [onProcessingChange, photoBusy]);

  const accountOptions = filteredAccounts.map((account) => ({
    id: account.id,
    title: account.bank_name?.trim() || account.name,
    subtitle:
      account.holder_name?.trim() ||
      account.pay_hint?.trim() ||
      account.name.trim(),
    markSlug: payMarkSlugs(account)[0],
  }));

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
        {needsAccount ? (
          <>
            <p className="sale-cart-heading" id="pay-account-label">
              Cuenta destino
            </p>
            <SearchPickField
              id="pay-account"
              labelledBy="pay-account-label"
              placeholder="Selecciona una cuenta…"
              valueId={value.bank_account_id}
              disabled={disabled}
              options={accountOptions}
              emptyLabel="Sin cuentas disponibles"
              onChange={(id) => onChange({ ...value, bank_account_id: id })}
              auxAction={
                selected
                  ? {
                      label: detailsOpen ? "Ocultar datos de cuenta" : "Ver datos de cuenta",
                      icon: detailsOpen ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />,
                      onClick: () => setDetailsOpen((prev) => !prev),
                      pressed: detailsOpen,
                    }
                  : null
              }
            />
          </>
        ) : null}

        {emptyAccountHint ? (
          <p className="muted small pay-hint" role="status">
            {emptyAccountHint}
          </p>
        ) : null}

        {selected && needsAccount ? (
          <div className="pay-account-meta">
            {detailsOpen ? (
              <div className="pay-share-inline">
                {selected.holder_name ? (
                  <p className="muted small">{selected.holder_name}</p>
                ) : null}
                {selected.pay_hint ? <p className="pay-share-hint">{selected.pay_hint}</p> : null}
                {shareText ? (
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
                ) : null}
              </div>
            ) : null}
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
        {isCash ? null : (
          <TextField
            id="pay-ref"
            label="REFERENCIA / CÓDIGO"
            value={value.payment_reference}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, payment_reference: e.target.value })}
            placeholder="Opcional · ej. 00123456"
          />
        )}
        <PhotoDrop
          id="pay-photo"
          label={isCash ? "Billetes" : "Comprobante"}
          hint="Opcional · hasta 3 fotos JPG o PNG"
          readyHint="Se adjuntan al pedido"
          value={evidencePhotos}
          disabled={disabled}
          onBusyChange={setPhotoBusy}
          multiple
          maxFiles={MAX_PAYMENT_EVIDENCE_PHOTOS}
          onChange={(next) => {
            const photos = next.filter(Boolean).slice(0, MAX_PAYMENT_EVIDENCE_PHOTOS);
            onChange({
              ...value,
              payment_evidence_photos: photos,
              payment_evidence: serializePaymentEvidence(photos),
            });
          }}
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
    payment_evidence_photos: [],
  };
}
