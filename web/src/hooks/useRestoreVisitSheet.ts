import { useEffect, useRef } from "react";
import { fetchVisit } from "../lib/api";
import { peekVisitSaleDraft } from "../lib/saleWizardDraft";
import { clearVisitWork, loadVisitWork } from "../lib/visitWorkSession";
import type { Visit } from "../lib/types";

/** Reabre la visita/OV si el teléfono recargó o se navegó a otra pantalla. */
export function useRestoreVisitSheet(
  setVisit: (visit: Visit) => void,
  visits: Visit[],
  loading: boolean,
) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || loading) return;
    const work = loadVisitWork();
    const draft = peekVisitSaleDraft();
    const id = work?.visitId ?? draft?.visitId ?? null;
    if (id == null || id <= 0) return;

    const local = visits.find((v) => v.id === id);
    if (local) {
      if (local.status === "completada" || local.status === "cancelada") {
        clearVisitWork();
        return;
      }
      done.current = true;
      setVisit(local);
      return;
    }

    done.current = true;
    let cancelled = false;
    void fetchVisit(id)
      .then((visit) => {
        if (cancelled) return;
        if (visit.status === "completada" || visit.status === "cancelada") {
          clearVisitWork();
          done.current = false;
          return;
        }
        setVisit(visit);
      })
      .catch(() => {
        if (!cancelled) done.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [loading, visits, setVisit]);
}
