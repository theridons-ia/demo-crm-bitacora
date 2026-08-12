import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import {
  ApiError,
  assignVisit,
  fetchClients,
  fetchSellers,
  fetchVisits,
  unassignVisit,
} from "../lib/api";
import type { Client, User, Visit } from "../lib/types";

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clientLabel(client: Client): string {
  const id = client.rif ? `RIF ${client.rif}` : client.ci ? `CI ${client.ci}` : "";
  return id ? `${client.name} · ${id}` : client.name;
}

/** SF-2.2 — asignar / desasignar visitas programadas del día. */
export function RouteDayPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [date, setDate] = useState(todayISO);
  const [sellerId, setSellerId] = useState<number | "">("");
  const [clientId, setClientId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSeller = useMemo(
    () => sellers.find((s) => s.id === sellerId) ?? null,
    [sellers, sellerId],
  );

  const loadMeta = useCallback(async () => {
    const [sellerList, clientList] = await Promise.all([fetchSellers(), fetchClients()]);
    setSellers(sellerList);
    setClients(clientList);
    setSellerId((prev) => {
      if (prev !== "" && sellerList.some((s) => s.id === prev)) return prev;
      return sellerList[0]?.id ?? "";
    });
  }, []);

  const loadRoute = useCallback(async (day: string, sid: number) => {
    const list = await fetchVisits({
      scheduled_date: day,
      seller_id: sid,
      status: "programada",
    });
    setVisits(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadMeta();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el equipo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMeta]);

  useEffect(() => {
    if (sellerId === "") return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        await loadRoute(date, sellerId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar la ruta");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, sellerId, loadRoute]);

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (sellerId === "" || clientId === "") return;
    setBusy(true);
    setError(null);
    try {
      await assignVisit({
        seller_id: sellerId,
        client_id: clientId,
        scheduled_date: date,
        description: note.trim() || null,
      });
      setClientId("");
      setNote("");
      await loadRoute(date, sellerId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  async function onUnassign(visitId: number) {
    if (!window.confirm("¿Quitar esta visita de la ruta? Solo aplica si sigue programada.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unassignVisit(visitId);
      if (sellerId !== "") await loadRoute(date, sellerId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desasignar");
    } finally {
      setBusy(false);
    }
  }

  const assignedClientIds = useMemo(
    () => new Set(visits.map((v) => v.client_id)),
    [visits],
  );

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor</p>
          <h1>Ruta del día</h1>
          <p className="muted">
            Asigna visitas programadas. Desasignar solo quita planificadas; el historial
            ejecutado no se borra.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card route-filters">
        <TextField
          id="route-date"
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <label className="field" htmlFor="route-seller">
          <span className="field-label">Vendedor</span>
          <select
            id="route-seller"
            className="input"
            value={sellerId === "" ? "" : String(sellerId)}
            onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
            disabled={loading || sellers.length === 0}
          >
            {sellers.length === 0 ? <option value="">Sin vendedores</option> : null}
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.route_name ? ` · ${s.route_name}` : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card route-assign">
        <h2 className="section-title">Asignar visita</h2>
        <form className="route-assign-form" onSubmit={onAssign}>
          <label className="field" htmlFor="route-client">
            <span className="field-label">Cliente</span>
            <select
              id="route-client"
              className="input"
              value={clientId === "" ? "" : String(clientId)}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Elegir cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} disabled={assignedClientIds.has(c.id)}>
                  {clientLabel(c)}
                  {assignedClientIds.has(c.id) ? " (ya en ruta)" : ""}
                </option>
              ))}
            </select>
          </label>
          <TextField
            id="route-note"
            label="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Prioridad, horario…"
          />
          <Button
            type="submit"
            variant="accent"
            block
            disabled={busy || sellerId === "" || clientId === ""}
          >
            <Plus size={18} />
            Agregar a la ruta
          </Button>
        </form>
      </section>

      <section className="route-list" aria-label="Visitas programadas">
        <div className="route-list-head">
          <h2 className="section-title">
            Planificadas
            {selectedSeller ? ` · ${selectedSeller.full_name}` : ""}
          </h2>
          <p className="muted small">
            {date} · {visits.length} visita{visits.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}

        {!loading && visits.length === 0 ? (
          <p className="card muted" style={{ margin: 0 }}>
            Sin visitas programadas para esta fecha y vendedor.
          </p>
        ) : null}

        <ul className="route-visit-list">
          {visits.map((v) => (
            <li key={v.id} className="card route-visit-row">
              <div>
                <p className="route-visit-name">{v.client?.name ?? `Cliente #${v.client_id}`}</p>
                <p className="muted small">
                  {v.client?.state ?? "—"}
                  {v.description ? ` · ${v.description}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => onUnassign(v.id)}
                title="Desasignar"
              >
                <Trash2 size={18} />
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
