import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { ApiError, fetchVisitGpsPoints } from "../lib/api";
import type { GeoFix } from "../lib/gps";
import { clientPdvIconFor, sellerNowIcon, trailIconForSource } from "../lib/mapMarkers";
import type { Visit, VisitGpsPoint } from "../lib/types";

const SOURCE_LABEL: Record<string, string> = {
  start: "Inicio (vendedor)",
  watch: "Trail (vendedor)",
  end: "Cierre (vendedor)",
};

const FALLBACK: L.LatLngExpression = [10.0647, -69.334];

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  blurb?: string;
  notice?: ReactNode;
  footer?: ReactNode;
  /** Posición viva del vendedor (pregunta «¿Estás aquí?»). */
  hereFix?: GeoFix | null;
  hereFixLoading?: boolean;
};

function visitFallbackPoints(visit: Visit): VisitGpsPoint[] {
  const points: VisitGpsPoint[] = [];
  if (visit.latitude != null && visit.longitude != null) {
    points.push({
      id: 0,
      visit_id: visit.id,
      latitude: String(visit.latitude),
      longitude: String(visit.longitude),
      accuracy_m: visit.gps_accuracy_m,
      captured_at: visit.gps_captured_at ?? visit.visited_at ?? visit.created_at,
      source: "start",
    });
  }
  if (visit.end_latitude != null && visit.end_longitude != null) {
    points.push({
      id: -1,
      visit_id: visit.id,
      latitude: String(visit.end_latitude),
      longitude: String(visit.end_longitude),
      accuracy_m: visit.end_gps_accuracy_m ?? null,
      captured_at: visit.end_gps_captured_at ?? visit.closed_at ?? visit.created_at,
      source: "end",
    });
  }
  return points;
}

function pdvLatLng(visit: Visit): L.LatLngExpression | null {
  const client = visit.client;
  if (client?.latitude == null || client?.longitude == null) return null;
  const clat = Number(client.latitude);
  const clng = Number(client.longitude);
  if (!Number.isFinite(clat) || !Number.isFinite(clng)) return null;
  return [clat, clng];
}

function visitNowLatLng(visit: Visit): L.LatLngExpression | null {
  const lat = visit.latitude != null ? Number(visit.latitude) : NaN;
  const lng = visit.longitude != null ? Number(visit.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (visit.status !== "en_curso" && visit.status !== "programada") return null;
  return [lat, lng];
}

function samePoint(aLat: number, aLng: number, b: L.LatLngExpression): boolean {
  const pair = Array.isArray(b) ? b : [b.lat, b.lng];
  return Math.abs(aLat - Number(pair[0])) < 1e-5 && Math.abs(aLng - Number(pair[1])) < 1e-5;
}

/** Mapa Leaflet: PDV (fucsia + nombre) + trail del vendedor + posición actual. */
export function VisitMapSheet({
  visit,
  open,
  onClose,
  eyebrow,
  blurb,
  notice,
  footer,
  hereFix = null,
  hereFixLoading = false,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const hereLayerRef = useRef<L.LayerGroup | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<VisitGpsPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      if (visit.id < 0) {
        if (!cancelled) {
          setPoints(visitFallbackPoints(visit));
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchVisitGpsPoints(visit.id);
        if (cancelled) return;
        setPoints(data.length ? data : visitFallbackPoints(visit));
      } catch (err) {
        if (cancelled) return;
        setPoints(visitFallbackPoints(visit));
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los puntos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, visit]);

  useEffect(() => {
    if (!open || !canvasEl) return;

    const map = L.map(canvasEl, { zoomControl: true, attributionControl: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);
    overlaysRef.current = L.layerGroup().addTo(map);
    hereLayerRef.current = L.layerGroup().addTo(map);
    map.setView(FALLBACK, 12);

    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 360);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      mapRef.current = null;
      overlaysRef.current = null;
      hereLayerRef.current = null;
    };
  }, [open, canvasEl]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    if (!open || !map || !overlays) return;

    overlays.clearLayers();
    const pdv = pdvLatLng(visit);
    if (pdv) {
      L.marker(pdv, { icon: clientPdvIconFor(visit.client?.name) })
        .addTo(overlays)
        .bindPopup(
          `<strong>${visit.client?.name ?? "PDV"}</strong>${
            visit.client?.address ? `<br/><small>${visit.client.address}</small>` : ""
          }`,
        );
    }

    const here = hereFix
      ? ([hereFix.latitude, hereFix.longitude] as L.LatLngExpression)
      : visitNowLatLng(visit);

    const latLngs: L.LatLngExpression[] = [];
    for (const p of points) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ll: L.LatLngExpression = [lat, lng];
      latLngs.push(ll);
      if (here && p.source !== "start" && p.source !== "end" && samePoint(lat, lng, here)) {
        continue;
      }
      const label = SOURCE_LABEL[p.source] ?? p.source;
      const acc = p.accuracy_m ? ` · ±${Number(p.accuracy_m).toFixed(0)} m` : "";
      L.marker(ll, { icon: trailIconForSource(p.source) })
        .addTo(overlays)
        .bindPopup(`<strong>${label}</strong>${acc}<br/><small>${p.captured_at}</small>`);
    }

    if (latLngs.length >= 2) {
      L.polyline(latLngs, { color: "#f16b5f", weight: 3, opacity: 0.9 }).addTo(overlays);
    }
  }, [open, canvasEl, points, visit, hereFix]);

  useEffect(() => {
    const map = mapRef.current;
    const hereLayer = hereLayerRef.current;
    if (!open || !map || !hereLayer) return;

    hereLayer.clearLayers();
    const here = hereFix
      ? ({
          lat: hereFix.latitude,
          lng: hereFix.longitude,
          acc: hereFix.accuracy_m,
        } as const)
      : (() => {
          const ll = visitNowLatLng(visit);
          if (!ll) return null;
          const pair = ll as [number, number];
          return {
            lat: pair[0],
            lng: pair[1],
            acc: visit.gps_accuracy_m != null ? Number(visit.gps_accuracy_m) : null,
          };
        })();

    if (here) {
      const ll: L.LatLngExpression = [here.lat, here.lng];
      if (here.acc != null && Number.isFinite(here.acc) && here.acc > 0) {
        L.circle(ll, {
          radius: Math.min(here.acc, 250),
          color: "#0f766e",
          weight: 1,
          fillColor: "#0f766e",
          fillOpacity: 0.12,
        }).addTo(hereLayer);
      }
      const acc = here.acc != null && Number.isFinite(here.acc) ? ` · ±${Math.round(here.acc)} m` : "";
      L.marker(ll, { icon: sellerNowIcon, zIndexOffset: 1400 })
        .addTo(hereLayer)
        .bindPopup(`<strong>Tu posición</strong>${acc}`);
    }

    const bounds: L.LatLngExpression[] = [];
    const pdv = pdvLatLng(visit);
    if (pdv) bounds.push(pdv);
    if (here) bounds.push([here.lat, here.lng]);
    for (const p of points) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) bounds.push([lat, lng]);
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 17 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.setView(FALLBACK, 12);
    }
    window.setTimeout(() => map.invalidateSize(), 60);
  }, [open, canvasEl, hereFix, visit, points]);

  if (!open) return null;

  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const hasPdv = pdvLatLng(visit) != null;
  const hasHere = Boolean(hereFix) || visitNowLatLng(visit) != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow={eyebrow ?? "Evidencia GPS"}
      title={clientName}
      blurb={
        blurb ??
        (loading
          ? "Cargando puntos…"
          : points.length
            ? `${points.length} punto(s) vendedor${hasPdv ? " · PDV en mapa" : ""}`
            : hasPdv
              ? "Solo pin del PDV (sin trail aún)"
              : "Sin coordenadas")
      }
      footer={footer}
    >
      {notice}
      {hereFixLoading && !hasHere ? (
        <p className="muted small" role="status">
          Buscando tu posición…
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="map-legend" aria-hidden>
        <span>
          <i className="map-marker-store map-marker-store-legend" /> Cliente (PDV)
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-start" /> Inicio
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-seller" /> Trail
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-now" /> Tú
        </span>
        <span>
          <i className="map-marker-dot map-marker-dot-end" /> Cierre
        </span>
      </div>

      <div className="map-stage">
        <div ref={setCanvasEl} className="map-stage-canvas is-sheet" />
      </div>
    </Modal>
  );
}
