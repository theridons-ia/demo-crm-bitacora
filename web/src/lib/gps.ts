/**
 * Geolocalización del navegador (SF-1.4).
 *
 * En móviles, GPS exige HTTPS o localhost. Para pruebas sin HTTPS:
 * - localhost en el PC, o
 * - modo "GPS de prueba" (coordenadas simuladas), o
 * - `npm run dev:https` (certificado autofirmado).
 */

const MOCK_KEY = "bitacora.dev_mock_gps";
const MOCK_EVENT = "bitacora-mock-gps";

/** Punto demo cerca de Barquisimeto (Lara) — zona del seed. */
export const DEMO_GPS_FIX = {
  latitude: 10.0678,
  longitude: -69.3474,
  accuracy_m: 12,
};

export type GeoNear = { latitude: number; longitude: number };

export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: string;
  mocked?: boolean;
};

export type GeoResult =
  | { ok: true; fix: GeoFix }
  | { ok: false; skipped: true; reason: string };

export function isGeolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function isSecureGeoContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

/** Solo en desarrollo (`import.meta.env.DEV`). */
export function canUseMockGps(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function isMockGpsEnabled(): boolean {
  if (!canUseMockGps() || typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(MOCK_KEY) === "1";
}

export function setMockGpsEnabled(enabled: boolean): void {
  if (!canUseMockGps() || typeof sessionStorage === "undefined") return;
  if (enabled) sessionStorage.setItem(MOCK_KEY, "1");
  else sessionStorage.removeItem(MOCK_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MOCK_EVENT));
  }
}

/** Reacciona al toggle «GPS simular» del header. */
export function subscribeMockGps(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(MOCK_EVENT, listener);
  return () => window.removeEventListener(MOCK_EVENT, listener);
}

export function coordsFromClient(client?: {
  latitude?: string | number | null;
  longitude?: string | number | null;
} | null): GeoNear | null {
  if (client?.latitude == null || client?.longitude == null) return null;
  const latitude = Number(client.latitude);
  const longitude = Number(client.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function mockCurrentPosition(near?: GeoNear | null): GeoResult {
  const latitude = near?.latitude ?? DEMO_GPS_FIX.latitude;
  const longitude = near?.longitude ?? DEMO_GPS_FIX.longitude;
  // ~15–20 m alrededor del PDV (no un recorrido)
  const jitter = (Math.random() - 0.5) * 0.00018;
  return {
    ok: true,
    fix: {
      latitude: latitude + jitter,
      longitude: longitude + jitter,
      accuracy_m: DEMO_GPS_FIX.accuracy_m,
      captured_at: new Date().toISOString(),
      mocked: true,
    },
  };
}

export function getCurrentPosition(
  timeoutMs = 15000,
  near?: GeoNear | null,
  opts?: { maximumAge?: number },
): Promise<GeoResult> {
  if (isMockGpsEnabled()) {
    return Promise.resolve(mockCurrentPosition(near));
  }

  if (!isGeolocationAvailable()) {
    return Promise.resolve({
      ok: false,
      skipped: true,
      reason: "Este navegador no soporta geolocalización",
    });
  }
  if (!isSecureGeoContext()) {
    return Promise.resolve({
      ok: false,
      skipped: true,
      reason:
        "GPS real requiere HTTPS o localhost. Activa «GPS de prueba» abajo, o usa npm run dev:https.",
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          fix: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy ?? null,
            captured_at: new Date(pos.timestamp).toISOString(),
          },
        });
      },
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado"
            : err.code === err.TIMEOUT
              ? "Tiempo de espera del GPS agotado"
              : "No se pudo obtener ubicación";
        resolve({ ok: false, skipped: true, reason });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: opts?.maximumAge ?? 10_000 },
    );
  });
}

export const GPS_ACCURACY_WARN_M = 100;

/** Distancia en metros (Haversine). */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function mapsUrl(lat: string | number, lng: string | number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/** Google Maps — navegación en el teléfono. */
export function mapsNavigateUrl(lat: string | number, lng: string | number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export type WatchHandle = { stop: () => void };

/**
 * Trail ligero mientras la visita está en curso (GPS real).
 * El modo «GPS simular» NO genera puntos en movimiento: solo fija
 * una coordenada cerca del PDV al iniciar / guardar GPS / cerrar.
 */
export function watchPositionTrail(
  onFix: (fix: GeoFix) => void,
  options?: { minIntervalMs?: number },
): WatchHandle {
  if (isMockGpsEnabled()) {
    return { stop: () => undefined };
  }

  const minIntervalMs = options?.minIntervalMs ?? 45_000;
  let lastSentAt = 0;
  let stopped = false;

  const emit = (result: GeoResult) => {
    if (stopped || !result.ok) return;
    const now = Date.now();
    if (now - lastSentAt < minIntervalMs) return;
    lastSentAt = now;
    onFix(result.fix);
  };

  if (!isGeolocationAvailable() || !isSecureGeoContext()) {
    return { stop: () => undefined };
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      emit({
        ok: true,
        fix: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
          captured_at: new Date(pos.timestamp).toISOString(),
        },
      });
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );

  return {
    stop: () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
    },
  };
}
