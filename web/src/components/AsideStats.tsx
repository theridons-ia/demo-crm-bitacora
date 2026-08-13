type StatItem = {
  label: string;
  value: string | number;
};

type Props = {
  /** Título corto del panel (ej. «Ventas»). */
  title: string;
  items: StatItem[];
  /** Eyebrow opcional; default «Resumen». */
  eyebrow?: string;
};

/**
 * Panel derecho estándar: métricas label/valor.
 * Usar en `asideExtra` de WorkspacePage — no `chart-card` vacío con bar-list sin barras.
 */
export function AsideStats({ title, items, eyebrow = "Resumen" }: Props) {
  return (
    <section className="card aside-stats" aria-label={`${eyebrow}: ${title}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="aside-stats-title">{title}</h2>
      <dl className="aside-stats-list">
        {items.map((item) => (
          <div key={item.label} className="aside-stats-row">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
