/**
 * Geolocalización del navegador (SF-1.4).
 *
 * Importante: en móviles, GPS suele exigir contexto seguro (HTTPS o localhost).
 * Abrir la app por http://IP-LAN:5173 desde el celular a menudo BLOQUEA el GPS.
 */

export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: string;
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

export function getCurrentPosition(timeoutMs = 15000): Promise<GeoResult> {
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
        "El GPS requiere HTTPS (o localhost). Desde el celular por IP http://… el navegador lo bloquea.",
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

export function mapsUrl(lat: string | number, lng: string | number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
