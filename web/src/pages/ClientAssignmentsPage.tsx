import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { ClientRow } from "../components/ClientRow";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { SideSheet } from "../components/SideSheet";
import { SelectField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  fetchClientAssignments,
  fetchClients,
  fetchSellers,
  updateClientAssignments,
} from "../lib/api";
import type { Client, User } from "../lib/types";

function clientIdLabel(client: Client): string {
  if (client.rif) return client.rif;
  if (client.ci) return `CI ${client.ci}`;
  return "Sin RIF/CI";
}

/** Supervisor: lista de clientes + alta/edición + asignar cartera (dropdown). */
export function ClientAssignmentsPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  /** client_id → seller ids */
  const [assignedByClient, setAssignedByClient] = useState<Map<number, number[]>>(new Map());
  const [query, setQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState<number | "all" | "none">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);

  const [assignClient, setAssignClient] = useState<Client | null>(null);
  const [assignSellerId, setAssignSellerId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const sellerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of sellers) map.set(s.id, s.full_name);
    return map;
  }, [sellers]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sellerList, clientList] = await Promise.all([fetchSellers(), fetchClients()]);
      setSellers(sellerList);
      setClients(clientList);

      const rows = await Promise.all(sellerList.map((s) => fetchClientAssignments(s.id)));
      const byClient = new Map<number, number[]>();
      for (const row of rows) {
        for (const cid of row.client_ids) {
          const prev = byClient.get(cid) ?? [];
          prev.push(row.seller_id);
          byClient.set(cid, prev);
        }
      }
      setAssignedByClient(byClient);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const sellersFor = assignedByClient.get(c.id) ?? [];
      if (sellerFilter === "none" && sellersFor.length > 0) return false;
      if (sellerFilter !== "all" && sellerFilter !== "none" && !sellersFor.includes(sellerFilter)) {
        return false;
      }
      if (!q) return true;
      const sellerNames = sellersFor.map((id) => sellerNameById.get(id) ?? "").join(" ");
      return `${c.name} ${c.rif ?? ""} ${c.ci ?? ""} ${c.city ?? ""} ${c.state ?? ""} ${c.address ?? ""} ${sellerNames}`
        .toLowerCase()
        .includes(q);
    });
  }, [clients, query, sellerFilter, assignedByClient, sellerNameById]);

  const unassignedCount = useMemo(
    () => clients.filter((c) => !(assignedByClient.get(c.id)?.length)).length,
    [clients, assignedByClient],
  );

  function openAssign(client: Client) {
    setAssignClient(client);
    const current = assignedByClient.get(client.id) ?? [];
    setAssignSellerId(current[0] ?? "");
    setError(null);
    setSavedNote(null);
  }

  async function saveAssign() {
    if (!assignClient) return;
    setBusy(true);
    setError(null);
    setSavedNote(null);
    try {
      const clientId = assignClient.id;
      await Promise.all(
        sellers.map(async (s) => {
          const allForSeller = new Set<number>();
          for (const [cid, sids] of assignedByClient) {
            if (sids.includes(s.id)) allForSeller.add(cid);
          }
          const next = new Set(allForSeller);
          if (assignSellerId !== "" && s.id === assignSellerId) next.add(clientId);
          else next.delete(clientId);
          if (next.size === allForSeller.size && [...next].every((id) => allForSeller.has(id))) {
            return;
          }
          await updateClientAssignments(s.id, Array.from(next));
        }),
      );
      const name = assignSellerId !== "" ? sellerNameById.get(assignSellerId) : null;
      setSavedNote(name ? `Asignado a ${name}` : "Cliente sin vendedor asignado");
      setAssignClient(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la asignación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Operación"
        title="Clientes"
        blurb="Cartera completa: datos, vendedor asignado, alta y edición."
        asideExtra={
          <section className="card chart-card">
            <h2>Cartera</h2>
            <div className="bar-list">
              <div>
                <div className="bar-item-top">
                  <span>Clientes</span>
                  <strong>{clients.length}</strong>
                </div>
              </div>
              <div>
                <div className="bar-item-top">
                  <span>Sin asignar</span>
                  <strong>{unassignedCount}</strong>
                </div>
                <div className="bar-track" aria-hidden>
                  <div
                    className="bar-fill accent"
                    style={{
                      width: clients.length
                        ? `${Math.round((unassignedCount / clients.length) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        }
      >
        <header className="page-header page-header-with-action">
          <div>
            <h1 className="display-title">Clientes</h1>
          </div>
          <Button
            type="button"
            variant="accent"
            className="header-plus-cta"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} />
            Nuevo
          </Button>
        </header>

        {savedNote ? <p className="offline-banner is-online">{savedNote}</p> : null}
        {error && !assignClient ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="list-page-tools">
          <ListSearch
            id="sup-clients-search"
            value={query}
            onChange={setQuery}
            placeholder="Nombre, RIF, zona o vendedor…"
          />
          <label className="field" htmlFor="sup-clients-seller-filter">
            <span className="field-label">Filtrar por vendedor</span>
            <select
              id="sup-clients-seller-filter"
              className="input"
              value={String(sellerFilter)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all" || v === "none") setSellerFilter(v);
                else setSellerFilter(Number(v));
              }}
            >
              <option value="all">Todos</option>
              <option value="none">Sin asignar</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : (
          <ul className="client-row-list">
            {filtered.map((client) => {
              const sellerIds = assignedByClient.get(client.id) ?? [];
              const sellerLabel =
                sellerIds.length === 0
                  ? "Sin vendedor"
                  : sellerIds.map((id) => sellerNameById.get(id) ?? `#${id}`).join(", ");
              return (
                <ClientRow
                  key={client.id}
                  client={client}
                  extra={sellerLabel}
                  warn={sellerIds.length === 0}
                  onClick={() => setSelected(client)}
                />
              );
            })}
          </ul>
        )}

        {!loading && filtered.length === 0 ? (
          <p className="muted">Sin coincidencias. Crea un cliente o cambia el filtro.</p>
        ) : null}
      </WorkspacePage>

      <ClientForm
        open={formOpen}
        initialClient={editing}
        sellers={sellers}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={(client) => {
          setClients((prev) => {
            const without = prev.filter((c) => c.id !== client.id);
            return [client, ...without];
          });
          setSelected(client);
          void reload();
        }}
      />

      {selected && !formOpen && !assignClient ? (
        <ClientDetailSheet
          client={selected}
          open
          sellerLabel={
            (assignedByClient.get(selected.id) ?? [])
              .map((id) => sellerNameById.get(id) ?? `#${id}`)
              .join(", ") || "Sin vendedor"
          }
          assignLabel={
            (assignedByClient.get(selected.id)?.length ?? 0) > 0 ? "Re-asignar" : "Asignar"
          }
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onAssign={() => openAssign(selected)}
        />
      ) : null}

      <SideSheet
        open={Boolean(assignClient)}
        onClose={() => setAssignClient(null)}
        eyebrow="Cartera"
        title={
          assignClient && (assignedByClient.get(assignClient.id)?.length ?? 0) > 0
            ? "Re-asignar vendedor"
            : "Asignar vendedor"
        }
        blurb={
          assignClient
            ? `${assignClient.name} · ${clientIdLabel(assignClient)}`
            : undefined
        }
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAssignClient(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" disabled={busy} onClick={() => void saveAssign()}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        {assignClient ? (
          <div className="sheet-form-stack">
            <SelectField
              id="assign-seller-select"
              label="Vendedor responsable"
              value={assignSellerId === "" ? "" : String(assignSellerId)}
              onChange={(e) => setAssignSellerId(e.target.value ? Number(e.target.value) : "")}
              hint="Un solo vendedor ve este PDV en su cartera."
            >
              <option value="">Sin asignar</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.route_name ? ` · ${s.route_name}` : ""}
                </option>
              ))}
            </SelectField>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </SideSheet>
    </>
  );
}
