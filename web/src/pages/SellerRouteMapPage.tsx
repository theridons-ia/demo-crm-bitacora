import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { ListSkeleton } from "../components/ListSkeleton";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WeekDayStrip } from "../components/WeekDayStrip";
import { WeekNav } from "../components/WeekNav";
import { WorkspacePage } from "../layout/WorkspacePage";
import { useRestoreVisitSheet } from "../hooks/useRestoreVisitSheet";
import { ApiError, fetchCurrentRoute } from "../lib/api";
import { addDaysISO, formatAgendaDay, todayISO, weekDayISOs, weekStartISO } from "../lib/caracasTime";
import { teamVisitIcon } from "../lib/mapMarkers";
import type { LatLng } from "../lib/routeOrder";
import { sortVisitsRoute } from "../lib/visitOrder";
import type { RouteDetail, Visit, VisitStatus } from "../lib/types";

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

function defaultDayChip(weekStart: string): string | "sin-dia" {
  const today = todayISO();
  const days = weekDayISOs(weekStart);
  return days.includes(today) ? today : weekStart;
}

/** Semana del vendedor (SF-5.2). El mapa es el slice de hoy. */
export function SellerRouteMapPage() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [dayChip, setDayChip] = useState<string | "sin-dia">(() => defaultDayChip(weekStartISO()));
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Visit | null>(null);
  const today = todayISO();
  const showMap = dayChip === today;

  const visits = useMemo(
    () => (route?.visits ?? []).filter((v) => v.status !== "cancelada"),
    [route],
  );

  const dayVisits = useMemo(() => {
    const slice =
      dayChip === "sin-dia"
        ? visits.filter((v) => !v.scheduled_date)
        : visits.filter((v) => v.scheduled_date === dayChip);
    return sortVisitsRoute(slice);
  }, [visits, dayChip]);

  const occupiedDays = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      if (v.scheduled_date) set.add(v.scheduled_date);
    }
    return set;
  }, [visits]);

  useRestoreVisitSheet(setSelected, visits, loading);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCurrentRoute({ week_start: weekStart });
      setRoute(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la ruta");
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!showMap || !mapEl.current) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
      return;
    }
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
    dayVisits.forEach((v, idx) => {
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
  }, [showMap, dayVisits]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  function shiftWeek(delta: -1 | 1) {
    const next = addDaysISO(weekStart, delta * 7);
    setWeekStart(next);
    setDayChip(defaultDayChip(next));
  }

  function applyVisitUpdate(updated: Visit) {
    setRoute((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        visits: prev.visits.map((v) => (v.id === updated.id ? updated : v)),
      };
    });
    setSelected((cur) => (cur && cur.id === updated.id ? updated : cur));
  }

  const weekDone = route?.done ?? 0;
  const weekPlanned = route?.planned ?? 0;
  const dayDone = dayVisits.filter((v) => v.status === "completada").length;

  return (
    <WorkspacePage
      eyebrow="Ruta"
      title={route?.title ?? "Tu semana"}
      blurb="Plan de la semana. El mapa es el recorrido de hoy."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">{route?.code ?? "Semana"}</p>
          <h1 className="display-title">{route?.title ?? "Tu semana"}</h1>
          <p className="muted">
            {loading
              ? "Cargando…"
              : weekPlanned
                ? `${weekDone} de ${weekPlanned} paradas`
                : "Semana vacía"}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
          <RefreshCw size={16} />
          Actualizar
        </Button>
      </header>

      <WeekNav weekStart={weekStart} onShift={shiftWeek} />

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <WeekDayStrip
        weekStart={weekStart}
        value={dayChip}
        onChange={setDayChip}
        occupiedDays={occupiedDays}
        unscheduled={route?.unscheduled ?? 0}
        label="Día de tu ruta"
      />

      {showMap ? (
        <div className="map-stage is-bleed">
          <div ref={mapEl} className="map-stage-canvas" role="img" aria-label="Mapa de ruta de hoy" />
          <div className="map-stage-legend" aria-hidden>
            <span className="route-map-legend-item">
              <i className="route-map-swatch is-done" /> Hecho
            </span>
            <span className="route-map-legend-item">
              <i className="route-map-swatch is-todo" /> Pendiente
            </span>
          </div>
        </div>
      ) : (
        <p className="muted small seller-week-map-hint">
          <MapPin size={14} aria-hidden />
          El mapa aparece al ver el día de hoy.
        </p>
      )}

      <section className="card route-day-list">
        <h2 className="section-heading">
          {dayChip === "sin-dia"
            ? "Sin día"
            : dayChip === today
              ? "Hoy"
              : formatAgendaDay(dayChip)}
        </h2>
        <p className="muted small">
          {loading
            ? "…"
            : dayVisits.length
              ? `${dayDone} de ${dayVisits.length} en este día`
              : "Nada en este día"}
        </p>
        {loading ? <ListSkeleton count={4} /> : null}
        {!loading && dayVisits.length === 0 ? (
          <p className="muted">
            {dayChip === "sin-dia"
              ? "No tienes paradas sueltas. El supervisor puede dejarte PDVs sin fecha."
              : "Sin paradas este día."}
          </p>
        ) : null}
        {!loading && dayVisits.length ? (
          <ul className="visit-row-list">
            {dayVisits.map((v, i) => (
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
        ) : null}
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
