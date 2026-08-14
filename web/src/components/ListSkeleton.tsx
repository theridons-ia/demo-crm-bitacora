type Kind = "row" | "stock";

type Props = {
  kind?: Kind;
  count?: number;
};

/** Placeholder de lista mientras llega el API. Imita la fila real (visita/cliente o stock). */
export function ListSkeleton({ kind = "row", count = 6 }: Props) {
  const n = Math.max(1, count);
  return (
    <ul
      className={`list-skeleton is-${kind}`}
      aria-busy="true"
      aria-label="Cargando"
    >
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="list-skeleton-item" aria-hidden>
          {kind === "stock" ? (
            <>
              <span className="sk-line sk-title" />
              <span className="sk-chip" />
              <span className="sk-chip is-wide" />
            </>
          ) : (
            <>
              <span className="sk-copy">
                <span className="sk-line sk-title" />
                <span className="sk-line sk-meta" />
              </span>
              <span className="sk-chip" />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
