import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LiveLed } from "./LiveLed";
import { peekVisitSaleDraft } from "../lib/saleWizardDraft";
import { loadVisitWork, subscribeVisitWork } from "../lib/visitWorkSession";

function activeWork() {
  const work = loadVisitWork();
  if (work) return work;
  const draft = peekVisitSaleDraft();
  if (!draft) return null;
  return { visitId: draft.visitId, selling: true, clientName: "" };
}

/** LED de visita/pedido en curso en el header. Tocar reabre la ficha. */
export function LiveVisitChip() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [work, setWork] = useState(activeWork);

  useEffect(() => subscribeVisitWork(() => setWork(activeWork())), []);

  if (!work || work.visitId === 0) return null;

  const selling = work.selling || Boolean(peekVisitSaleDraft());
  const label = selling ? "Pedido en curso" : "En curso";
  const hint = work.clientName ? `${label} · ${work.clientName}` : label;

  function resume() {
    const stay =
      pathname === "/app/inicio" || pathname === "/app/visitas" || pathname === "/app/ruta";
    const target = stay ? pathname : "/app/visitas";
    navigate(`${target}?continuar=1`);
  }

  return (
    <button
      type="button"
      className="live-visit-chip"
      title={hint}
      aria-label={hint}
      onClick={resume}
    >
      <LiveLed showLabel={false} label={label} />
      <span className="live-visit-chip-copy">
        <span className="live-visit-chip-label">{label}</span>
        {work.clientName ? (
          <span className="live-visit-chip-name">{work.clientName}</span>
        ) : null}
      </span>
    </button>
  );
}
