import { todayISO, weekDayISOs, WEEKDAY_SHORT } from "../lib/caracasTime";

export type WeekDayValue = string | "sin-dia";

type Props = {
  weekStart: string;
  value: WeekDayValue;
  onChange: (day: WeekDayValue) => void;
  occupiedDays?: Iterable<string>;
  unscheduled?: number;
  showSinDia?: boolean;
  disablePast?: boolean;
  label?: string;
};

/** Carrusel L–D de la ruta semanal. Punto coral = hay paradas. */
export function WeekDayStrip({
  weekStart,
  value,
  onChange,
  occupiedDays,
  unscheduled = 0,
  showSinDia = true,
  disablePast = false,
  label = "Día de la semana",
}: Props) {
  const days = weekDayISOs(weekStart);
  const today = todayISO();
  const occupied = occupiedDays instanceof Set ? occupiedDays : new Set(occupiedDays ?? []);

  return (
    <div className="filter-chips week-day-chips" role="tablist" aria-label={label}>
      {days.map((iso, i) => {
        const past = iso < today;
        const hasStops = occupied.has(iso);
        const dayNum = Number(iso.slice(8));
        return (
          <button
            key={iso}
            type="button"
            role="tab"
            aria-selected={value === iso}
            aria-label={`${WEEKDAY_SHORT[i]} ${dayNum}${hasStops ? ", con paradas" : ""}`}
            className={[
              value === iso ? "chip active" : "chip",
              past ? "is-past" : "",
              hasStops ? "has-stops" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disablePast && past}
            onClick={() => onChange(iso)}
          >
            {WEEKDAY_SHORT[i]}
            <em>{dayNum}</em>
          </button>
        );
      })}
      {showSinDia ? (
        <button
          type="button"
          role="tab"
          aria-selected={value === "sin-dia"}
          aria-label={unscheduled ? `Sin día, ${unscheduled} paradas` : "Sin día"}
          className={[
            value === "sin-dia" ? "chip active" : "chip",
            unscheduled ? "has-stops" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange("sin-dia")}
        >
          Sin día
        </button>
      ) : null}
    </div>
  );
}
