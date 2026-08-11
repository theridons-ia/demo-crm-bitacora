type Props = {
  title: string;
  nextSf: string;
  blurb: string;
};

/** Pantalla vacía con mensaje claro de qué SF la llenará. */
export function PlaceholderPage({ title, nextSf, blurb }: Props) {
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>{title}</h1>
          <p className="muted">{blurb}</p>
        </div>
      </header>
      <section className="card">
        <p className="muted" style={{ margin: 0 }}>
          Contenido pendiente — <strong>{nextSf}</strong>
        </p>
      </section>
    </>
  );
}
