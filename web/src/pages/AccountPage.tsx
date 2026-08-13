import { WorkspacePage } from "../layout/WorkspacePage";

type Props = {
  title: string;
  blurb: string;
};

/** Pantallas de cuenta (perfil / ajustes / preferencias) — contenido básico por ahora. */
export function AccountPage({ title, blurb }: Props) {
  return (
    <WorkspacePage eyebrow="Cuenta" title={title} blurb={blurb}>
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1 className="display-title">{title}.</h1>
          <p className="muted">{blurb}</p>
        </div>
      </header>
      <section className="card">
        <p className="muted" style={{ margin: 0 }}>
          Esta sección se irá completando (datos personales, notificaciones, idioma, etc.).
        </p>
      </section>
    </WorkspacePage>
  );
}
