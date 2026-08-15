import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { SelectField, TextField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchSellers, fetchVisits } from "../lib/api";
import { formatAgendaDay, todayISO } from "../lib/caracasTime";
import { teamVisitIcon } from "../lib/mapMarkers";
import { isOnDayAgenda, sortVisitsRoute } from "../lib/visitOrder";
import type { User, Visit, VisitStatus } from "../lib/types";

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Culminada",
  cancelada: "Cancelada",
};

const DEFAULT_CENTER: L.LatLngExpression = [10.07, -69.32];

function stopCoords(visit: Visit): L.LatLngExpression | null {
  const clat = visit.client?.latitude != null ? Number(visit.client.latitude) : NaN;
  const clng = visit.client?.longitude != null ? Number(visit.client.longitude) : NaN;
  if (Number.isFinite(clat) && Number.isFinite(clng)) return [clat, clng];
  const lat = visit.latitude != null ? Number(visit.latitude) : NaN;
  const lng = visit.longitude != null ? Number(visit.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

/** Mapa del día del equipo: trazo = agenda, sin lista duplicada ni nombres PDV fijos. */
export function TeamMapPage() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [sellers, setSellers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [day, setDay] = useState(todayISO);
  const [sellerId, setSellerId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Visit | null>(null);

  const loadSellers = useCallback(async () => {
    const list = await fetchSellers();
    setSellers(list);
  }, []);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchVisits({
        scheduled_date: day,
        seller_id: sellerId === "" ? undefined : sellerId,
      });
      setVisits(list.filter((v) => isOnDayAgenda(v, day)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el mapa");
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [day, sellerId]);

  useEffect(() => {
    void loadSellers().catch(() => undefined);
  }, [loadSellers]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  const ordered = useMemo(() => sortVisitsRoute(visits), [visits]);
  const oneSeller = sellerId !== "";
  const doneCount = ordered.filter((v) => v.status === "completada").length;

  useEffect(() => {
    if (!mapEl.current) return;

    if (!mapRef.current) {
      const map = L.map(mapEl.current, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);
      map.setView(DEFAULT_CENTER, 8);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapRef.current;
    const layer = layerRef.current!;
    layer.clearLayers();

    const pinned: { v: Visit; n: number; pt: L.LatLngExpression }[] = [];
    ordered.forEach((v, idx) => {
      const pt = stopCoords(v);
      if (!pt) return;
      pinned.push({ v, n: idx + 1, pt });
    });

    if (oneSeller) {
      for (let i = 0; i < pinned.length - 1; i++) {
        const doneSeg =
          pinned[i].v.status === "completada" && pinned[i + 1].v.status === "completada";
        L.polyline([pinned[i].pt, pinned[i + 1].pt], {
          color: doneSeg ? "#18312f" : "#f16b5f",
          weight: doneSeg ? 5 : 3.5,
          dashArray: doneSeg ? undefined : "10 12",
          opacity: 0.85,
        }).addTo(layer);
      }
    }

    for (const { v, n, pt } of pinned) {
      const initials = v.seller?.initials ?? "?";
      const sellerName = v.seller?.full_name ?? `Vendedor #${v.seller_id}`;
      const clientName = v.client?.name ?? `Cliente #${v.client_id}`;
      const marker = L.marker(pt, {
        icon: teamVisitIcon(v.status, oneSeller ? String(n) : initials),
      });
      marker.bindPopup(
        `<strong>${oneSeller ? `${n}. ` : ""}${clientName}</strong><br/><small>${STATUS_LABEL[v.status]} · ${sellerName}</small>`,
      );
      marker.on("click", () => setSelected(v));
      marker.addTo(layer);
    }

    if (pinned.length) {
      map.fitBounds(L.latLngBounds(pinned.map((p) => p.pt)), { padding: [40, 40], maxZoom: 13 });
    } else {
      map.setView(DEFAULT_CENTER, 8);
    }

    setTimeout(() => map.invalidateSize(), 80);
  }, [ordered, oneSeller]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  return (
    <WorkspacePage eyebrow="Operación" title="Mapa" blurb="Visitas del día en mapa.">
      <header className="page-header">
        <div>
          <p className="eyebrow">{formatAgendaDay(day)}</p>
          <h1 className="display-title">Mapa</h1>
          <p className="muted">
            {loading
              ? "Cargando…"
              : ordered.length
                ? `${doneCount} culminadas · ${ordered.length - doneCount} pendientes`
                : "Nada agendado este día"}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadVisits()} disabled={loading}>
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="list-tools-row team-map-tools">
        <TextField
          id="team-day"
          label="Fecha"
          type="date"
          lang="es-VE"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <SelectField
          id="team-seller"
          label="Vendedor"
          value={sellerId === "" ? "" : String(sellerId)}
          onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Todos</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="map-stage is-bleed">
        <div ref={mapEl} className="map-stage-canvas" role="img" aria-label="Mapa de visitas del equipo" />
        <div className="map-stage-legend">
          <span>
            <span className="team-legend-dot" style={{ background: "#71807b" }} /> Programada
          </span>
          <span>
            <span className="team-legend-dot" style={{ background: "#f16b5f" }} /> En curso
          </span>
          <span>
            <span className="team-legend-dot" style={{ background: "#18312f" }} /> Culminada
          </span>
        </div>
      </div>

      {selected ? (
        <VisitDetailSheet
          visit={selected}
          open
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setSelected(updated);
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
