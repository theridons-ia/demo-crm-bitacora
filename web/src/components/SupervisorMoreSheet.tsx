import { NavLink } from "react-router-dom";
import { SideSheet } from "../components/SideSheet";
import { isSupervisorMorePath, SUPERVISOR_MORE_ITEMS } from "../layout/supervisorNav";

type Props = {
  open: boolean;
  onClose: () => void;
  pathname: string;
};

/** Menú Más del supervisor (móvil): destinos secundarios. */
export function SupervisorMoreSheet({ open, onClose, pathname }: Props) {
  return (
    <SideSheet
      open={open}
      onClose={onClose}
      eyebrow="Supervisor"
      title="Más"
      blurb="Ventas, finanzas, equipo, stock y mapa."
    >
      <ul className="more-nav-list">
        {SUPERVISOR_MORE_ITEMS.map(({ to, label, icon: Icon, blurb }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to}>
              <NavLink
                to={to}
                className={active ? "more-nav-link active" : "more-nav-link"}
                onClick={onClose}
              >
                <span className="more-nav-icon" aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="more-nav-copy">
                  <strong>{label}</strong>
                  <em>{blurb}</em>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
      {!isSupervisorMorePath(pathname) ? (
        <p className="muted small" style={{ marginTop: "0.75rem" }}>
          Alertas y tasa FX están en el menú del perfil (arriba a la derecha).
        </p>
      ) : null}
    </SideSheet>
  );
}
