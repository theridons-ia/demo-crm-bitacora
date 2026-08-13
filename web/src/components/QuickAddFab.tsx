import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, ShoppingCart, Store, X } from "lucide-react";

/**
 * FAB coral con menú rápido: visita, venta o cliente nuevo.
 * Solo móvil (&lt;900px); en desktop el mismo menú vive en el header («Registrar»).
 */
export function QuickAddFab() {
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
    <div className={`fab-root${open ? " is-open" : ""}`} ref={rootRef}>
      {open ? (
        <div className="fab-menu" role="menu" aria-label="Registrar actividad">
          <button
            type="button"
            className="fab-menu-item"
            role="menuitem"
            onClick={() => go("/app/visitas?nueva=1")}
          >
            <span className="fab-menu-icon" aria-hidden>
              <ClipboardList size={18} />
            </span>
            <span>
              <strong>Nueva visita</strong>
              <em>Abrir o programar en ruta</em>
            </span>
          </button>
          <button
            type="button"
            className="fab-menu-item"
            role="menuitem"
            onClick={() => go("/app/ventas")}
          >
            <span className="fab-menu-icon" aria-hidden>
              <ShoppingCart size={18} />
            </span>
            <span>
              <strong>Registrar venta</strong>
              <em>Pedido / cobro al cliente</em>
            </span>
          </button>
          <button
            type="button"
            className="fab-menu-item"
            role="menuitem"
            onClick={() => go("/app/inicio?nuevo=cliente")}
          >
            <span className="fab-menu-icon" aria-hidden>
              <Store size={18} />
            </span>
            <span>
              <strong>Cliente nuevo</strong>
              <em>Alta en cartera</em>
            </span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="fab-main"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? "Cerrar menú" : "Registrar actividad"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={28} strokeWidth={2.5} /> : <Plus size={30} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
