import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { SupervisorMoreSheet } from "../components/SupervisorMoreSheet";
import { isSupervisorMorePath, SUPERVISOR_PRIMARY_TABS } from "./supervisorNav";

/** Bottom nav supervisor: 4 tabs + Más. */
export function SupervisorBottomNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isSupervisorMorePath(pathname);

  return (
    <>
      <nav className="tabbar tabbar-supervisor" aria-label="Navegación supervisor">
        {SUPERVISOR_PRIMARY_TABS.map((tab) => {
          if (tab.more) {
            return (
              <button
                key="more"
                type="button"
                className={moreActive || moreOpen ? "tab active" : "tab"}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                onClick={() => setMoreOpen(true)}
              >
                <tab.icon size={20} strokeWidth={2} aria-hidden />
                {tab.label}
              </button>
            );
          }
          return (
            <NavLink
              key={tab.to}
              to={tab.to!}
              className={({ isActive }) => (isActive ? "tab active" : "tab")}
            >
              <tab.icon size={20} strokeWidth={2} aria-hidden />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <SupervisorMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </>
  );
}
