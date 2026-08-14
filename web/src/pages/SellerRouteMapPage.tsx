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
import type { LatLng } from "../lib/routeOrder";
import { isOnDayAgenda, sortVisitsRoute } from "../lib/visitOrder";
import type { Visit, VisitStatus } from "../lib/types";

const DEFAULT_CENTER: LatLng = { lat: 10.07, lng: -69.32 };
const LINE_DONE = "#18312f";
const LINE_TODO = "#f16b5f";

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
  programada: "Programada",
  en_curso: "En curso",
  completada: "Culminada",
  cancelada: "Cancelada",
};

/** Mapa del día = agenda (`scheduled_time`), no vecino más cercano. */
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
      const list = await fetchVisits({ scheduled_date: day });
      setVisits(list.filter((v) => isOnDayAgenda(v, day)));
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

  const ordered = useMemo(() => sortVisitsRoute(visits), [visits]);
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

    const pinned: { v: Visit; n: number; c: LatLng }[] = [];
    ordered.forEach((v, idx) => {
      const c = stopCoords(v);
      if (!c) return;
      pinned.push({ v, n: idx + 1, c });
    });

    for (let i = 0; i < pinned.length - 1; i++) {
      const a = pinned[i];
      const b = pinned[i + 1];
      const doneSeg = a.v.status === "completada" && b.v.status === "completada";
      L.polyline(
        [
          [a.c.lat, a.c.lng],
          [b.c.lat, b.c.lng],
        ],
        {
          color: doneSeg ? LINE_DONE : LINE_TODO,
          weight: doneSeg ? 5 : 3.5,
          dashArray: doneSeg ? undefined : "10 12",
          opacity: doneSeg ? 0.95 : 0.85,
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(layer);
    }

    pinned.forEach(({ v, n, c }) => {
      const marker = L.marker([c.lat, c.lng], {
        icon: teamVisitIcon(v.status, String(n)),
      });
      marker.bindPopup(
        `<strong>${n}. ${v.client?.name ?? `Cliente #${v.client_id}`}</strong><br/>${STATUS_LABEL[v.status]}`,
      );
      marker.on("click", () => setSelected(v));
      marker.addTo(layer);
    });

    const map = mapRef.current;
    if (pinned.length) {
      map.fitBounds(
        L.latLngBounds(pinned.map((p) => [p.c.lat, p.c.lng] as L.LatLngExpression)),
        { padding: [36, 36], maxZoom: 15 },
      );
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [ordered]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  function applyVisitUpdate(updated: Visit) {
    setVisits((prev) =>
      prev
        .map((v) => (v.id === updated.id ? updated : v))
        .filter((v) => isOnDayAgenda(v, day)),
    );
    setSelected((cur) => (cur && cur.id === updated.id ? updated : cur));
  }

  return (
    <WorkspacePage
      eyebrow="Ruta"
      title="Hoy"
      blurb="El trazo sigue el horario agendado."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Hoy · {day}</p>
          <h1 className="display-title">Recorrido</h1>
          <p className="muted">
            {loading
              ? "Cargando…"
              : ordered.length
                ? `${doneCount} culminadas · ${pendingCount} pendientes · ${progressPct}%`
                : "Nada agendado hoy"}
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

      <div className="map-stage is-bleed">
        <div ref={mapEl} className="map-stage-canvas" role="img" aria-label="Mapa de ruta del día" />
        <div className="map-stage-legend" aria-hidden>
          <span className="route-map-legend-item">
            <i className="route-map-swatch is-done" /> Hecho
          </span>
          <span className="route-map-legend-item">
            <i className="route-map-swatch is-todo" /> Pendiente
          </span>
        </div>
      </div>

      <section className="card route-day-list">
        <h2 className="section-heading">Orden del día</h2>
        {loading ? <p className="muted list-loading">Cargando…</p> : null}
        {!loading && ordered.length === 0 ? (
          <p className="muted">No hay visitas agendadas hoy.</p>
        ) : (
          <ul className="visit-row-list">
            {ordered.map((v, i) => (
              <VisitRow
                key={v.id}
                visit={v}
                index={i + 1}
                clock="agenda"
                pinMissing={!stopCoords(v)}
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
