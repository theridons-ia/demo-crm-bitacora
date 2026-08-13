import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchVisits } from "../lib/api";
import { todayISO } from "../lib/caracasTime";
import { teamVisitIcon } from "../lib/mapMarkers";
import { orderDayRoute, type LatLng } from "../lib/routeOrder";
import { sortVisitsAgenda } from "../lib/visitOrder";
import type { Visit, VisitStatus } from "../lib/types";

const DEFAULT_CENTER: LatLng = { lat: 10.07, lng: -69.32 };

function stopCoords(v: Visit): LatLng | null {
  const lat = v.client?.latitude != null ? Number(v.client.latitude) : NaN;
  const lng = v.client?.longitude != null ? Number(v.client.longitude) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const vlat = v.latitude != null ? Number(v.latitude) : NaN;
  const vlng = v.longitude != null ? Number(v.longitude) : NaN;
  if (Number.isFinite(vlat) && Number.isFinite(vlng)) return { lat: vlat, lng: vlng };
  return null;
}

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Pendiente",
  en_curso: "En curso",
  completada: "Cerrada",
  cancelada: "Cancelada",
};

/**
 * Mapa de recorrido del vendedor.
 * Cerradas primero (línea sólida) → pendientes como ruta sugerida (punteada).
 */
export function SellerRouteMapPage() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Visit | null>(null);
  const day = todayISO();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchVisits({ day });
      setVisits(list.filter((v) => v.status !== "cancelada"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la ruta");
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Al volver a la pestaña / foco: refrescar (p. ej. tras cerrar en Visitas)
  useEffect(() => {
    const onFocus = () => {
      void reload();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reload]);

  const ordered = useMemo(() => {
    const withCoords = visits.filter((v) => stopCoords(v));
    return orderDayRoute(
      withCoords,
      stopCoords,
      (v) => v.status === "completada",
      DEFAULT_CENTER,
    );
  }, [visits]);

  const listStops = useMemo(() => sortVisitsAgenda(visits), [visits]);
  const doneCount = ordered.filter((v) => v.status === "completada").length;
  const pendingCount = ordered.length - doneCount;
  const progressPct = ordered.length ? Math.round((doneCount / ordered.length) * 100) : 0;

  useEffect(() => {
    if (!mapEl.current) return;
    if (!mapRef.current) {
      const map = L.map(mapEl.current, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 12);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }

    const layer = layerRef.current!;
    layer.clearLayers();

    const points: L.LatLngExpression[] = [];
    ordered.forEach((v, idx) => {
      const c = stopCoords(v);
      if (!c) return;
      points.push([c.lat, c.lng]);
      const marker = L.marker([c.lat, c.lng], {
        icon: teamVisitIcon(v.status, String(idx + 1)),
      });
      marker.bindPopup(
        `<strong>${idx + 1}. ${v.client?.name ?? `Cliente #${v.client_id}`}</strong><br/>${STATUS_LABEL[v.status]}`,
      );
      marker.on("click", () => setSelected(v));
      marker.addTo(layer);
    });

    for (let i = 0; i < points.length - 1; i++) {
      const srcDone = ordered[i]?.status === "completada";
      const destDone = ordered[i + 1]?.status === "completada";
      const completedSeg = srcDone && destDone;
      L.polyline([points[i], points[i + 1]], {
        color: completedSeg ? "#18312f" : "#E6007A",
        weight: completedSeg ? 5 : 3.5,
        dashArray: completedSeg ? undefined : "10 12",
        opacity: completedSeg ? 0.95 : 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layer);
    }

    if (points.length) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [ordered]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  function applyVisitUpdate(updated: Visit) {
    setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    setSelected((cur) => (cur && cur.id === updated.id ? updated : cur));
  }

  return (
    <WorkspacePage
      eyebrow="Ruta"
      title="Mi recorrido"
      blurb="Cerradas en línea continua; pendientes en punteado (ruta sugerida)."
    >
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Hoy · {day}</p>
          <h1 className="display-title">Recorrido del día.</h1>
          <p className="muted">
            {doneCount} cerradas · {pendingCount} pendientes · {progressPct}% del trazo
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/app/inicio" className="btn btn-ghost">
            <ArrowLeft size={16} />
            Inicio
          </Link>
          <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={16} />
            Actualizar
          </Button>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="route-map-shell card">
        <div ref={mapEl} className="route-map-canvas" role="img" aria-label="Mapa de ruta del día" />
        <div className="route-map-legend" aria-hidden>
          <span className="route-map-legend-item">
            <i className="route-map-swatch is-done" /> Recorrido hecho
          </span>
          <span className="route-map-legend-item">
            <i className="route-map-swatch is-todo" /> Ruta sugerida
          </span>
        </div>
      </div>

      <section className="card">
        <h2 className="section-heading">Orden del día</h2>
        {loading ? <p className="muted list-loading">Cargando…</p> : null}
        {!loading && listStops.length === 0 ? (
          <p className="muted">No hay visitas para hoy.</p>
        ) : (
          <ul className="visit-row-list">
            {listStops.map((v, i) => (
              <VisitRow
                key={v.id}
                visit={v}
                index={i + 1}
                onClick={() => setSelected(v)}
              />
            ))}
          </ul>
        )}
      </section>

      {selected ? (
        <VisitDetailSheet
          visit={selected}
          open
          onClose={() => {
            setSelected(null);
            void reload();
          }}
          onUpdated={(updated) => {
            applyVisitUpdate(updated);
            void reload();
          }}
        />
      ) : null}
    </WorkspacePage>
  );
}
