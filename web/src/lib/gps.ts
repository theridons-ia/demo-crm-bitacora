/**
 * Geolocalización del navegador (SF-1.4).
 *
 * En móviles, GPS exige HTTPS o localhost. Para pruebas sin HTTPS:
 * - localhost en el PC, o
 * - modo "GPS de prueba" (coordenadas simuladas), o
 * - `npm run dev:https` (certificado autofirmado).
 */

const MOCK_KEY = "bitacora.dev_mock_gps";

/** Punto demo cerca de Barquisimeto (Lara) — zona del seed. */
export const DEMO_GPS_FIX = {
  latitude: 10.0678,
  longitude: -69.3474,
  accuracy_m: 12,
};

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
}

export function mockCurrentPosition(
  override?: Partial<typeof DEMO_GPS_FIX>,
): GeoResult {
  const latitude = override?.latitude ?? DEMO_GPS_FIX.latitude;
  const longitude = override?.longitude ?? DEMO_GPS_FIX.longitude;
  const accuracy_m = override?.accuracy_m ?? DEMO_GPS_FIX.accuracy_m;
  // Pequeña variación para que inicio/cierre no sean idénticos
  const jitter = (Math.random() - 0.5) * 0.0003;
  return {
    ok: true,
    fix: {
      latitude: latitude + jitter,
      longitude: longitude + jitter,
      accuracy_m,
      captured_at: new Date().toISOString(),
      mocked: true,
    },
  };
}

export function getCurrentPosition(timeoutMs = 15000): Promise<GeoResult> {
  if (isMockGpsEnabled()) {
    return Promise.resolve(mockCurrentPosition());
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
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 },
    );
  });
}

export const GPS_ACCURACY_WARN_M = 100;

export function mapsUrl(lat: string | number, lng: string | number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export type WatchHandle = { stop: () => void };

/**
 * Trail ligero mientras la visita está en curso.
 * - Real: watchPosition del navegador (filtramos por tiempo mínimo).
 * - Mock: intervalo con jitter (útil sin HTTPS).
 */
export function watchPositionTrail(
  onFix: (fix: GeoFix) => void,
  options?: { minIntervalMs?: number },
): WatchHandle {
  const minIntervalMs = options?.minIntervalMs ?? (isMockGpsEnabled() ? 12_000 : 45_000);
  let lastSentAt = 0;
  let stopped = false;

  const emit = (result: GeoResult) => {
    if (stopped || !result.ok) return;
    const now = Date.now();
    if (now - lastSentAt < minIntervalMs) return;
    lastSentAt = now;
    onFix(result.fix);
  };

  if (isMockGpsEnabled()) {
    // Primera muestra pronto para ver el trail en demos
    emit(mockCurrentPosition());
    const id = window.setInterval(() => {
      emit(mockCurrentPosition());
    }, Math.max(5_000, minIntervalMs));
    return {
      stop: () => {
        stopped = true;
        window.clearInterval(id);
      },
    };
  }

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
