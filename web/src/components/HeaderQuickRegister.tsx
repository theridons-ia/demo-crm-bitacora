import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, Plus, ShoppingCart, Store } from "lucide-react";

const ACTIONS = [
  {
    path: "/app/visitas?nueva=1",
    label: "Nueva visita",
    blurb: "Abrir o programar en ruta",
    icon: ClipboardList,
  },
  {
    path: "/app/ventas",
    label: "Nuevo pedido",
    blurb: "Pedido / cobro al cliente",
    icon: ShoppingCart,
  },
  {
    path: "/app/inicio?nuevo=cliente",
    label: "Cliente nuevo",
    blurb: "Alta en cartera",
    icon: Store,
  },
] as const;

/** Menú «Registrar» del header — solo desktop vendedor (CSS). */
export function HeaderQuickRegister() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className={`header-quick-register${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="header-quick-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={18} strokeWidth={2.4} aria-hidden />
        <span>Registrar</span>
        <ChevronDown size={16} aria-hidden />
      </button>

      {open ? (
        <div className="header-quick-menu" role="menu" aria-label="Registrar actividad">
          {ACTIONS.map(({ path, label, blurb, icon: Icon }) => (
            <button
              key={path}
              type="button"
              className="header-quick-item"
              role="menuitem"
              onClick={() => go(path)}
            >
              <span className="header-quick-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span>
                <strong>{label}</strong>
                <em>{blurb}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
