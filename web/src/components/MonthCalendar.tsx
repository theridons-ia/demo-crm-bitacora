import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

/** Mini calendario mensual para programar visitas. */
export function MonthCalendar({ value, onChange, min = todayISO() }: Props) {
  const selected = value || todayISO();
  const [cursor, setCursor] = useState(() => parseISO(selected));

  const monthLabel = cursor.toLocaleDateString("es-VE", { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ iso: string; day: number; inMonth: boolean } | null> = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISO(new Date(year, month, day));
      out.push({ iso, day, inMonth: true });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  return (
    <div className="month-cal">
      <div className="month-cal-head">
        <button
          type="button"
          className="month-cal-nav"
          aria-label="Mes anterior"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <strong className="month-cal-label">{monthLabel}</strong>
        <button
          type="button"
          className="month-cal-nav"
          aria-label="Mes siguiente"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="month-cal-weekdays" aria-hidden>
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-cal-grid">
        {cells.map((cell, idx) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              className={`month-cal-day${cell.iso === selected ? " is-selected" : ""}${
                cell.iso === todayISO() ? " is-today" : ""
              }`}
              disabled={cell.iso < min}
              onClick={() => onChange(cell.iso)}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`pad-${idx}`} className="month-cal-pad" />
          ),
        )}
      </div>
    </div>
  );
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function formatAgendaDay(iso: string): string {
  return parseISO(iso).toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export { todayISO as calendarTodayISO };
