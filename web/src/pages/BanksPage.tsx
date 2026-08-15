import { Landmark, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { PayMark } from "../components/PayMark";
import { SearchPickField } from "../components/SearchPickField";
import { SideSheet } from "../components/SideSheet";
import { FieldShell, TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  createBankAccount,
  fetchBankAccounts,
  fetchBankMovements,
} from "../lib/api";
import { payMarkSlugs } from "../lib/payMarks";
import type { BankAccount, BankAccountType, BankMovement, CurrencyCode } from "../lib/types";
import { US_BANKS, usBankByPickId } from "../lib/usBanks";
import { VE_BANKS, veBankByPickId, veBankPickId } from "../lib/veBanks";

const TYPE_LABEL: Record<BankAccountType, string> = {
  cash: "Caja",
  bank: "Banco",
  zelle: "Zelle",
  usdt: "USDT",
  pago_movil: "Pago móvil",
  other: "Otro",
};

type PayRail = "VES" | "USD" | "USDT";

const RAILS: { id: PayRail; label: string; slugs: string[] }[] = [
  { id: "VES", label: "Bs", slugs: ["bdv", "banesco"] },
  { id: "USD", label: "USD", slugs: ["zelle"] },
  { id: "USDT", label: "USDT", slugs: ["usdt", "binance"] },
];

function emptyForm() {
  return {
    name: "",
    holderName: "",
    payHint: "",
    rail: null as PayRail | null,
    accountType: "bank" as BankAccountType,
    veBankId: null as number | null,
    usBankId: null as number | null,
  };
}

/** Cuentas de cobro de la empresa + movimientos. */
export function BanksPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const veOptions = useMemo(
    () =>
      VE_BANKS.map((bank) => ({
        id: veBankPickId(bank),
        title: bank.name,
        subtitle: bank.code,
        markSlug: bank.slug,
      })),
    [],
  );
  const usOptions = useMemo(
    () =>
      US_BANKS.map((bank) => ({
        id: bank.id,
        title: bank.name,
        subtitle: "Estados Unidos",
        markSlug: bank.slug,
      })),
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([
        fetchBankAccounts(),
        fetchBankMovements({ limit: 30 }),
      ]);
      setAccounts(a);
      setMovements(m);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar bancos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalUsd = accounts
    .filter((a) => a.currency === "USD")
    .reduce((s, a) => s + Number(a.balance || 0), 0);
  const totalVes = accounts
    .filter((a) => a.currency === "VES")
    .reduce((s, a) => s + Number(a.balance || 0), 0);

  function patchForm(next: Partial<typeof form>) {
    setForm((cur) => ({ ...cur, ...next }));
  }

  function setRail(rail: PayRail) {
    setForm((cur) => ({
      ...cur,
      rail,
      accountType: rail === "USDT" ? "usdt" : rail === "USD" ? "zelle" : "bank",
      veBankId: null,
      usBankId: null,
    }));
  }

  async function onCreate() {
    const { name, holderName, payHint, rail, accountType, veBankId, usBankId } = form;
    if (!rail) {
      setError("Elige la moneda");
      return;
    }
    if (!name.trim()) {
      setError("Nombre / alias requerido");
      return;
    }
    if (accountType === "zelle" && !holderName.trim()) {
      setError("En Zelle el nombre asociado es obligatorio");
      return;
    }
    if (rail === "VES" && veBankId == null) {
      setError("Elige el banco venezolano");
      return;
    }
    if (rail === "USD" && accountType === "bank" && usBankId == null) {
      setError("Elige el banco de Estados Unidos");
      return;
    }
    if (rail === "USDT" && !payHint.trim()) {
      setError("Indica wallet, ID Binance o correo");
      return;
    }

    const ve = veBankByPickId(veBankId);
    const us = usBankByPickId(usBankId);
    const currency: CurrencyCode = rail === "VES" ? "VES" : "USD";
    const bankName =
      rail === "VES"
        ? (ve?.name ?? null)
        : rail === "USDT"
          ? "Binance"
          : accountType === "zelle"
            ? "Zelle"
            : (us?.name ?? null);

    setBusy(true);
    setError(null);
    try {
      await createBankAccount({
        name: name.trim(),
        bank_name: bankName,
        pay_hint: payHint.trim() || null,
        holder_name: holderName.trim() || null,
        account_type: accountType,
        currency,
      });
      setCreating(false);
      setForm(emptyForm());
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  }

  const hintLabel =
    form.accountType === "zelle"
      ? "Correo o teléfono Zelle"
      : form.rail === "USDT"
        ? "Wallet / ID Binance / correo"
        : form.rail === "USD"
          ? "Cuenta, routing o datos de wire"
          : form.accountType === "pago_movil"
            ? "Teléfono y CI / RIF"
            : "Número de cuenta y RIF";

  return (
    <>
      <WorkspacePage
        eyebrow="Finanzas"
        title="Bancos"
        blurb="Cuentas de cobro visibles al vendedor al registrar pagos."
      >
        <header className="page-header page-header-with-action">
          <div>
            <p className="eyebrow">Finanzas · bancos</p>
            <h1 className="display-title">Bancos y cajas</h1>
            <p className="muted">{accounts.length} cuentas</p>
          </div>
          <Button
            type="button"
            variant="accent"
            onClick={() => {
              setForm(emptyForm());
              setError(null);
              setCreating(true);
            }}
          >
            <Plus size={18} />
            Nueva
          </Button>
        </header>

        {error && !creating ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="muted">Cargando…</p> : null}

        <MetricGrid aria-label="Saldos">
          <MetricTile
            label="Saldo USD"
            value={`$${totalUsd.toFixed(0)}`}
            icon={Landmark}
            tone="solid"
          />
          <MetricTile label="Saldo Bs" value={totalVes.toLocaleString("es-VE")} tone="accent" />
        </MetricGrid>

        <ul className="ficha-stack">
          {accounts.map((a) => (
            <li key={a.id}>
              <article className="ficha">
                <PayMark slugs={payMarkSlugs(a)} label={a.bank_name || a.name} size="md" />
                <div className="ficha-body">
                  <div className="ficha-row">
                    <h3 className="ficha-title">{a.name}</h3>
                    <span className="badge badge-success">{TYPE_LABEL[a.account_type]}</span>
                  </div>
                  <p className="ficha-meta">
                    {a.bank_name ?? "—"} · {a.account_type === "usdt" ? "USDT" : a.currency === "VES" ? "Bs" : a.currency}
                    {!a.is_active ? " · inactiva" : ""}
                  </p>
                  {a.holder_name ? <p className="pay-share-holder">Nombre: {a.holder_name}</p> : null}
                  {a.pay_hint ? <p className="ficha-note">{a.pay_hint}</p> : null}
                  <div className="ficha-row">
                    <p className="ficha-stats">Saldo estimado</p>
                    <strong className="ficha-amount">
                      {a.currency === "USD" ? "$" : ""}
                      {Number(a.balance).toFixed(0)}
                      {a.currency === "VES" ? " Bs" : ""}
                    </strong>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>

        <section className="card chart-card" style={{ marginTop: "1rem" }}>
          <h2>Últimos movimientos</h2>
          {!movements.length ? (
            <p className="muted">Aún no hay movimientos. Se crean al cobrar ventas.</p>
          ) : (
            <ul className="ficha-stack">
              {movements.map((m) => (
                <li key={m.id}>
                  <article className="ficha">
                    <div className="ficha-body">
                      <div className="ficha-row">
                        <h3 className="ficha-title">{m.account_name ?? `Cuenta #${m.bank_account_id}`}</h3>
                        <strong className="ficha-amount">
                          +{Number(m.amount).toFixed(0)} {m.currency}
                        </strong>
                      </div>
                      <p className="ficha-meta">
                        {m.payment_method ?? "—"}
                        {m.reference ? ` · ref ${m.reference}` : ""}
                        {m.sale_id ? ` · OV-${m.sale_id}` : ""}
                      </p>
                      {m.notes ? <p className="ficha-note">{m.notes}</p> : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      </WorkspacePage>

      <SideSheet
        open={creating}
        onClose={() => {
          setCreating(false);
          setForm(emptyForm());
        }}
        eyebrow="Bancos"
        title="Nueva cuenta"
        blurb="Primero la moneda. Después el medio y el banco."
        footer={
          <div className="side-sheet-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setCreating(false);
                setForm(emptyForm());
              }}
            >
              Cancelar
            </Button>
            <Button type="button" variant="accent" disabled={busy} onClick={() => void onCreate()}>
              {busy ? "Guardando…" : "Crear"}
            </Button>
          </div>
        }
      >
        <div className="sheet-form-stack">
          <div className="field">
            <span className="field-label">Moneda</span>
            <div className="pay-methods" role="group" aria-label="Moneda">
              {RAILS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={form.rail === opt.id ? "pay-method is-active" : "pay-method"}
                  onClick={() => setRail(opt.id)}
                >
                  <PayMark slugs={opt.slugs} label={opt.label} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.rail === "VES" ? (
            <>
              <div className="field">
                <span className="field-label">Medio</span>
                <div className="choice-group" role="group">
                  <button
                    type="button"
                    className={form.accountType === "bank" ? "chip active" : "chip"}
                    onClick={() => patchForm({ accountType: "bank" })}
                  >
                    Transferencia
                  </button>
                  <button
                    type="button"
                    className={form.accountType === "pago_movil" ? "chip active" : "chip"}
                    onClick={() => patchForm({ accountType: "pago_movil" })}
                  >
                    Pago móvil
                  </button>
                </div>
              </div>
              <FieldShell id="bank-ve" label="Banco venezolano">
                <SearchPickField
                  id="bank-ve"
                  placeholder="Buscar banco…"
                  valueId={form.veBankId}
                  options={veOptions}
                  onChange={(id) => {
                    const picked = veBankByPickId(id);
                    patchForm({
                      veBankId: id,
                      name: form.name.trim() ? form.name : picked ? `${picked.shortName} empresa` : form.name,
                    });
                  }}
                  emptyLabel="Sin coincidencias en la lista SUDEBAN"
                />
              </FieldShell>
            </>
          ) : null}

          {form.rail === "USD" ? (
            <>
              <div className="field">
                <span className="field-label">Medio</span>
                <div className="pay-methods" role="group" aria-label="Medio USD">
                  <button
                    type="button"
                    className={form.accountType === "zelle" ? "pay-method is-active" : "pay-method"}
                    onClick={() => patchForm({ accountType: "zelle", usBankId: null })}
                  >
                    <PayMark slugs={["zelle"]} label="Zelle" />
                    Zelle
                  </button>
                  <button
                    type="button"
                    className={form.accountType === "bank" ? "pay-method is-active" : "pay-method"}
                    onClick={() => patchForm({ accountType: "bank" })}
                  >
                    <PayMark slugs={["bofa", "chase"]} label="Banco US" />
                    Banco US
                  </button>
                </div>
              </div>
              {form.accountType === "bank" ? (
                <FieldShell id="bank-us" label="Banco de Estados Unidos">
                  <SearchPickField
                    id="bank-us"
                    placeholder="Bank of America, Chase…"
                    valueId={form.usBankId}
                    options={usOptions}
                    onChange={(id) => {
                      const picked = usBankByPickId(id);
                      patchForm({
                        usBankId: id,
                        name: form.name.trim() ? form.name : picked ? `${picked.shortName} empresa` : form.name,
                      });
                    }}
                    emptyLabel="Elige uno de los 5 bancos US"
                  />
                </FieldShell>
              ) : null}
            </>
          ) : null}

          {form.rail === "USDT" ? (
            <p className="muted small">Red Binance. El vendedor comparte wallet o correo.</p>
          ) : null}

          {form.rail ? (
            <>
              <TextField
                id="bank-name"
                label="Nombre / alias"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
              />
              {form.accountType !== "cash" ? (
                <TextField
                  id="bank-holder"
                  label={form.accountType === "zelle" ? "Nombre asociado (Zelle)" : "Titular"}
                  value={form.holderName}
                  onChange={(e) => patchForm({ holderName: e.target.value })}
                  hint={
                    form.accountType === "zelle"
                      ? "El nombre que el cliente ve en Zelle, no el alias interno."
                      : undefined
                  }
                />
              ) : null}
              <TextField
                id="bank-hint"
                label={hintLabel}
                value={form.payHint}
                onChange={(e) => patchForm({ payHint: e.target.value })}
              />
            </>
          ) : (
            <p className="muted small">Elige Bs, USD o USDT para ver las opciones.</p>
          )}

          {error && creating ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </SideSheet>
    </>
  );
}
