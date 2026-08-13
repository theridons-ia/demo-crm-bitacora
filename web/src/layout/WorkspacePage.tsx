import type { ReactNode } from "react";
import { PageWorkspace } from "./PageWorkspace";

type Props = {
  eyebrow: string;
  title: string;
  blurb: string;
  children: ReactNode;
  /** Widgets útiles del panel derecho (métricas, filtros). Sin placeholders. */
  asideExtra?: ReactNode;
};

/**
 * Página estándar: main + aside opcional.
 * El aside solo aparece en desktop y solo si hay `asideExtra`.
 */
export function WorkspacePage({ children, asideExtra }: Props) {
  return <PageWorkspace aside={asideExtra ?? undefined}>{children}</PageWorkspace>;
}
