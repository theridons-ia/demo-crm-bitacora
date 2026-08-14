import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchSellers, fetchVisits } from "../lib/api";
import { todayISO } from "../lib/caracasTime";
import { clientPdvIconFor, teamVisitIcon } from "../lib/mapMarkers";
import { isOnDayAgenda, sortVisitsRoute } from "../lib/visitOrder";
import type { User, Visit, VisitStatus } from "../lib/types";

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const DEFAULT_CENTER: L.LatLngExpression = [10.07, -69.32]; // Barquisimeto

function clientCoords(visit: Visit): L.LatLngExpression | null {
  const lat = visit.client?.latitude != null ? Number(visit.client.latitude) : NaN;
  const lng = visit.client?.longitude != null ? Number(visit.client.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

function visitCoords(visit: Visit): L.LatLngExpression | null {
  const lat = visit.latitude != null ? Number(visit.latitude) : NaN;
  const lng = visit.longitude != null ? Number(visit.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return null;
}

/** SF-2.5 — visitas del día en un mapa para el supervisor. */
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

  const counts = useMemo(() => {
    const c = { programada: 0, en_curso: 0, completada: 0, sin_mapa: 0 };
    for (const v of visits) {
      if (v.status === "programada") c.programada += 1;
      else if (v.status === "en_curso") c.en_curso += 1;
      else if (v.status === "completada") c.completada += 1;
      if (!clientCoords(v) && !visitCoords(v)) c.sin_mapa += 1;
    }
    return c;
  }, [visits]);

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

    const bounds: L.LatLngExpression[] = [];

    if (sellerId !== "") {
      const pinned: { pt: L.LatLngExpression; status: Visit["status"] }[] = [];
      for (const v of sortVisitsRoute(visits)) {
        const pt = clientCoords(v) ?? visitCoords(v);
        if (pt) pinned.push({ pt, status: v.status });
      }
      for (let i = 0; i < pinned.length - 1; i++) {
        const doneSeg = pinned[i].status === "completada" && pinned[i + 1].status === "completada";
        L.polyline([pinned[i].pt, pinned[i + 1].pt], {
          color: doneSeg ? "#18312f" : "#f16b5f",
          weight: doneSeg ? 5 : 3.5,
          dashArray: doneSeg ? undefined : "10 12",
          opacity: 0.85,
        }).addTo(layer);
      }
    }

    for (const visit of visits) {
      const pdv = clientCoords(visit);
      const sellerPoint = visitCoords(visit);
      const initials = visit.seller?.initials ?? "?";
      const sellerName = visit.seller?.full_name ?? `Vendedor #${visit.seller_id}`;
      const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;

      if (pdv) {
        bounds.push(pdv);
        L.marker(pdv, { icon: clientPdvIconFor(clientName) })
          .addTo(layer)
          .bindPopup(
            `<strong>${clientName}</strong><br/><small>${STATUS_LABEL[visit.status]} · ${sellerName}</small>`,
          );
      }

      // Punto del vendedor (GPS de la visita) si difiere del PDV o no hay pin
      if (sellerPoint) {
        bounds.push(sellerPoint);
        L.marker(sellerPoint, { icon: teamVisitIcon(visit.status, initials) })
          .addTo(layer)
          .bindPopup(
            `<strong>${sellerName}</strong><br/><small>${STATUS_LABEL[visit.status]} · ${clientName}</small>`,
          );
      } else if (pdv && visit.status !== "programada") {
        // Sin GPS propio: marca estado sobre el PDV
        L.marker(pdv, { icon: teamVisitIcon(visit.status, initials) }).addTo(layer);
      }
    }

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13 });
    } else {
      map.setView(DEFAULT_CENTER, 8);
    }

    // Leaflet necesita invalidar tamaño al montar en layout con sidebar
    setTimeout(() => map.invalidateSize(), 80);
  }, [visits, sellerId]);

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
    <WorkspacePage
      eyebrow="Operación"
      title="Mapa"
      blurb="Ubica PDVs y el estado del equipo en el mapa."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisor</p>
          <h1>Mapa del equipo</h1>
          <p className="muted">
            PDV (pin fucsia) y posición/estado del vendedor (iniciales) para el día
            seleccionado.
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

      <section className="card route-filters">
        <TextField
          id="team-day"
          label="Fecha"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <label className="field" htmlFor="team-seller">
          <span className="field-label">Vendedor</span>
          <select
            id="team-seller"
            className="input"
            value={sellerId === "" ? "" : String(sellerId)}
            onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="team-map-stats muted small">
        {loading
          ? "Cargando…"
          : `${visits.length} visitas · ${counts.programada} prog. · ${counts.en_curso} en curso · ${counts.completada} hechas${
              counts.sin_mapa ? ` · ${counts.sin_mapa} sin coords` : ""
            }`}
      </div>

      <div className="map-stage is-bleed">
        <div ref={mapEl} className="map-stage-canvas" role="img" aria-label="Mapa de visitas del equipo" />
        <div className="map-stage-legend">
          <span>
            <span className="map-marker-store-legend" aria-hidden /> PDV
          </span>
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

      {!loading && visits.length === 0 ? (
        <p className="muted">No hay visitas para ese filtro. Asigna ruta o cierra visitas del día.</p>
      ) : null}

      <ul className="team-visit-list">
        {visits.map((v) => (
          <li key={v.id} className="card team-visit-row">
            <div>
              <p className="route-visit-name">{v.client?.name ?? `Cliente #${v.client_id}`}</p>
              <p className="muted small">
                {v.seller?.full_name ?? `Vendedor #${v.seller_id}`} · {STATUS_LABEL[v.status]}
                {!clientCoords(v) && !visitCoords(v) ? " · sin mapa" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </WorkspacePage>
  );
}
