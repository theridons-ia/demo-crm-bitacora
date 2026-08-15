import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekSpan } from "../lib/caracasTime";

type Props = {
  weekStart: string;
  onShift: (delta: -1 | 1) => void;
};

/** `< 17–23 ago >` — cambia la semana de ruta. */
export function WeekNav({ weekStart, onShift }: Props) {
  return (
    <div className="week-nav" role="group" aria-label="Semana">
      <button type="button" className="week-nav-btn" onClick={() => onShift(-1)} aria-label="Semana anterior">
        <ChevronLeft size={18} />
      </button>
      <strong>{formatWeekSpan(weekStart)}</strong>
      <button type="button" className="week-nav-btn" onClick={() => onShift(1)} aria-label="Semana siguiente">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
