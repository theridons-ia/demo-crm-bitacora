import { useEffect, useState } from "react";
import { fetchVisitGpsPoints, postVisitGpsPoint } from "../lib/api";
import { watchPositionTrail } from "../lib/gps";
import type { VisitGpsPoint } from "../lib/types";

/**
 * Mientras la visita está en_curso, muestrea GPS y lo envía al API.
 * Al desmontar (o al cerrar la visita) detiene el watch.
 */
export function useVisitGpsTrail(visitId: number | null, active: boolean) {
  const [points, setPoints] = useState<VisitGpsPoint[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    if (!visitId || !active) {
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
  }, [visitId, active]);

  return { points, tracking, lastError };
}
