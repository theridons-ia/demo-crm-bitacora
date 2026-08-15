import { ChevronRight } from "lucide-react";
import type { Client } from "../lib/types";

type Props = {
  client: Client;
  onClick: () => void;
  /** Segunda línea extra (p. ej. vendedor). */
  extra?: string;
  warn?: boolean;
};

function idLabel(client: Client): string {
  if (client.rif) return client.rif;
  if (client.ci) return `CI ${client.ci}`;
  return "—";
}

/**
 * Fila de cliente (SF-4.7): nombre · RIF/zona · chevron.
 * Toda la fila abre la ficha. Sin pin, coords ni botones.
 */
export function ClientRow({ client, onClick, extra, warn }: Props) {
  const meta = [idLabel(client), client.city || client.state, extra].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        className={`client-row${warn ? " is-warn" : ""}`}
        onClick={onClick}
      >
        <span className="client-row-copy">
          <span className="client-row-name">{client.name}</span>
          <span className="client-row-meta">{meta}</span>
        </span>
        <ChevronRight className="client-row-chevron" size={16} aria-hidden />
      </button>
    </li>
  );
}
