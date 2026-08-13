import { useEffect, useState } from "react";
import { fetchVisitGpsPoints, postVisitGpsPoint } from "../lib/api";
import { isMockGpsEnabled, subscribeMockGps, watchPositionTrail } from "../lib/gps";
import type { VisitGpsPoint } from "../lib/types";

/**
 * Trail GPS real mientras la visita está en_curso.
 * Con «GPS simular» no se muestrean puntos en movimiento.
 */
export function useVisitGpsTrail(visitId: number | null, active: boolean) {
  const [points, setPoints] = useState<VisitGpsPoint[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [mockGps, setMockGps] = useState(() => isMockGpsEnabled());

  useEffect(() => subscribeMockGps(() => setMockGps(isMockGpsEnabled())), []);

  useEffect(() => {
    if (!visitId || visitId < 0 || !active) {
      setTracking(false);
      return;
    }

    let cancelled = false;
    setLastError(null);

    fetchVisitGpsPoints(visitId)
      .then((data) => {
        if (!cancelled) setPoints(data);
      })
      .catch(() => undefined);

    if (mockGps) {
      setTracking(false);
      return () => {
        cancelled = true;
      };
    }

    setTracking(true);
    const handle = watchPositionTrail(async (fix) => {
      try {
        const saved = await postVisitGpsPoint(visitId, {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy_m: fix.accuracy_m,
          captured_at: fix.captured_at,
          source: "watch",
        });
        if (!cancelled) {
          setPoints((prev) => [...prev, saved]);
          setLastError(null);
        }
      } catch {
        if (!cancelled) setLastError("No se pudo guardar un punto del trail");
      }
    });

    return () => {
      cancelled = true;
      handle.stop();
      setTracking(false);
    };
  }, [visitId, active, mockGps]);

  return { points, tracking, lastError, mockGps };
}
