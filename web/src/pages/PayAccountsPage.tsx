import { Copy, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { ListSkeleton } from "../components/ListSkeleton";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchBankAccounts } from "../lib/api";
import {
  copyText,
  payAccountShareText,
  payAccountsBundleText,
  whatsappShareUrl,
} from "../lib/sharePay";
import type { BankAccount } from "../lib/types";

const TYPE_LABEL: Record<string, string> = {
  zelle: "Zelle",
  usdt: "USDT",
  bank: "Transferencia",
  pago_movil: "Pago móvil",
};

function isShareable(account: BankAccount): boolean {
  return account.account_type !== "cash" && Boolean(account.pay_hint);
}

/** Datos de cobro para el vendedor: copiar o mandar por WhatsApp. */
export function PayAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchBankAccounts({ active_only: true });
        if (!cancelled) setAccounts(list.filter(isShareable));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudieron cargar las cuentas");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bundle = useMemo(() => payAccountsBundleText(accounts), [accounts]);

  async function onCopy(text: string, key: string) {
    const ok = await copyText(text);
    setCopied(ok ? key : null);
    if (ok) window.setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1800);
  }

  return (
    <WorkspacePage
      eyebrow="Cobro"
      title="Cuentas de cobro"
      blurb="Compártelas con el cliente por WhatsApp o cópialas al pegar."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Cobro</p>
          <h1 className="display-title">Cuentas.</h1>
          <p className="muted">Zelle, USDT, transferencia y pago móvil de EnRutas.</p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <ListSkeleton count={4} /> : null}

      {!loading && accounts.length > 1 ? (
        <div className="pay-share-toolbar">
          <Button type="button" variant="secondary" onClick={() => void onCopy(bundle, "all")}>
            <Copy size={16} />
            {copied === "all" ? "Copiado" : "Copiar todas"}
          </Button>
          <a className="btn btn-accent" href={whatsappShareUrl(bundle)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} />
            WhatsApp
          </a>
        </div>
      ) : null}

      <ul className="ficha-stack">
        {accounts.map((account) => {
          const text = payAccountShareText(account);
          return (
            <li key={account.id}>
              <article className="ficha pay-share-card">
                <div className="ficha-body">
                  <p className="eyebrow">{TYPE_LABEL[account.account_type] ?? account.account_type}</p>
                  <h3 className="ficha-title">{account.name}</h3>
                  <p className="ficha-meta">
                    {account.bank_name ? `${account.bank_name} · ` : ""}
                    {account.currency === "VES" ? "Bs" : account.currency}
                  </p>
                  <p className="pay-share-hint">{account.pay_hint}</p>
                  <div className="pay-share-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void onCopy(text, String(account.id))}
                    >
                      <Copy size={16} />
                      {copied === String(account.id) ? "Copiado" : "Copiar"}
                    </Button>
                    <a className="btn btn-secondary" href={whatsappShareUrl(text)} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {!loading && accounts.length === 0 ? (
        <p className="muted">No hay cuentas de cobro activas para compartir.</p>
      ) : null}
    </WorkspacePage>
  );
}
