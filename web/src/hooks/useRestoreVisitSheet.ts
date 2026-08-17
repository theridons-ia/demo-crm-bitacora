import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchVisit } from "../lib/api";
import { peekVisitSaleDraft } from "../lib/saleWizardDraft";
import { clearVisitWork, loadVisitWork } from "../lib/visitWorkSession";
import type { Visit } from "../lib/types";

/** Reabre la visita/OV si el teléfono recargó, se navegó, o se tocó el LED del header. */
export function useRestoreVisitSheet(
  setVisit: (visit: Visit) => void,
  visits: Visit[],
  loading: boolean,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const continuar = searchParams.get("continuar") === "1";
  const done = useRef(false);

  useEffect(() => {
    if (continuar) done.current = false;
    if (done.current || loading) return;
    const work = loadVisitWork();
    const draft = peekVisitSaleDraft();
    const id = work?.visitId ?? draft?.visitId ?? null;
    if (id == null) return;

    function opened() {
      done.current = true;
      if (!continuar) return;
      const next = new URLSearchParams(searchParams);
      next.delete("continuar");
      setSearchParams(next, { replace: true });
    }

    const local = visits.find((v) => v.id === id);
    if (local) {
      if (local.status === "completada" || local.status === "cancelada") {
        clearVisitWork();
        return;
      }
      opened();
      setVisit(local);
      return;
    }

    if (id <= 0) return;

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
        opened();
        setVisit(visit);
      })
      .catch(() => {
        if (!cancelled) done.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [loading, visits, setVisit, continuar, searchParams, setSearchParams]);
}
