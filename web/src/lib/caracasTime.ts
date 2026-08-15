/** Hora de negocio EnRutas: Caracas, UTC−4 todo el año (sin horario de verano). */
export const CARACAS_TZ = "America/Caracas";
export const CARACAS_LOCALE = "es-VE";

function asDate(iso: string | Date): Date | null {
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD del instante en Caracas. */
export function dateISOInCaracas(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: CARACAS_TZ });
}

export function todayISO(): string {
  return dateISOInCaracas(new Date());
}

/** Hora 0–23 en Caracas (saludos, no la TZ del teléfono). */
export function caracasHour(d = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: CARACAS_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .find((p) => p.type === "hour")?.value;
  const n = Number.parseInt(hour ?? "", 10);
  return Number.isFinite(n) ? n : d.getHours();
}

export function monthPrefixISO(d = new Date()): string {
  return dateISOInCaracas(d).slice(0, 7);
}

export function isSameCaracasDay(
  iso: string | null | undefined,
  day: string = todayISO(),
): boolean {
  if (!iso) return false;
  const d = asDate(iso);
  if (!d) return iso.slice(0, 10) === day;
  return dateISOInCaracas(d) === day;
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = asDate(iso);
  if (!d) return String(iso);
  return d.toLocaleString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Inicio/Fin en pastilla: fecha corta + hora. */
export function formatPillParts(
  iso: string | Date | null | undefined,
): { date: string; time: string } | null {
  if (iso == null || iso === "") return null;
  const d = asDate(iso);
  if (!d) return null;
  const date = d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  return { date, time };
}

/** Inicio/Fin en una línea: «jue, 13 ago. · 11:48 p. m.» */
export function formatPillWhen(iso: string | Date | null | undefined): string {
  const parts = formatPillParts(iso);
  if (!parts) return "—";
  return `${parts.date} · ${parts.time}`;
}

/** Código OV-YYMMDD-HHMM-0001 a partir de un instante Caracas. */
export function formatSaleStamp(iso: string | Date, seq: number): string {
  const d = asDate(iso);
  if (!d) return `OV-${String(seq).padStart(4, "0")}`;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CARACAS_TZ,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `OV-${get("year")}${get("month")}${get("day")}-${get("hour")}${get("minute")}-${String(seq).padStart(4, "0")}`;
}

export function formatDateTimeLong(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = asDate(iso);
  if (!d) return String(iso);
  return d.toLocaleString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = asDate(iso);
  if (!d) return "—";
  return d.toLocaleTimeString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLongDate(d = new Date()): string {
  return d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** `isoDate` es un día civil YYYY-MM-DD (agenda), interpretado en Caracas. */
export function formatAgendaDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00-04:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Lun–Dom, orden ISO (lunes = 0). Carrusel de ruta, no locale suelto. */
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export function formatWeekdayShort(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00-04:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "short",
  });
}

export function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00-04:00`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lunes de la semana civil (Caracas) para un YYYY-MM-DD. */
export function weekStartISO(isoDate: string = todayISO()): string {
  const d = new Date(`${isoDate}T12:00:00-04:00`);
  const utcDay = d.getUTCDay();
  const offset = utcDay === 0 ? 6 : utcDay - 1;
  return addDaysISO(isoDate, -offset);
}

export function weekDayISOs(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

export function planWeekOptions(from: string = todayISO()): {
  start: string;
  label: string;
  span: string;
}[] {
  const current = weekStartISO(from);
  return [0, 1, 2].map((offset) => {
    const start = addDaysISO(current, offset * 7);
    const label = offset === 0 ? "Esta" : offset === 1 ? "Próxima" : "+2 sem";
    return { start, label, span: formatWeekSpan(start) };
  });
}

export function clampPlanWeek(weekStart: string, from: string = todayISO()): string {
  const options = planWeekOptions(from);
  if (weekStart < options[0].start) return options[0].start;
  if (weekStart > options[2].start) return options[2].start;
  return weekStart;
}

/** Primer día asignable: hoy o el próximo de esa semana. */
export function firstAssignableDay(
  weekStart: string,
  preferred?: string | "sin-dia",
): string | "sin-dia" {
  const today = todayISO();
  const days = weekDayISOs(weekStart);
  if (preferred === "sin-dia") return "sin-dia";
  if (preferred && days.includes(preferred) && preferred >= today) return preferred;
  if (days.includes(today)) return today;
  return days.find((day) => day >= today) ?? "sin-dia";
}

export function formatWeekSpan(weekStart: string): string {
  const end = addDaysISO(weekStart, 6);
  const a = new Date(`${weekStart}T12:00:00-04:00`);
  const b = new Date(`${end}T12:00:00-04:00`);
  const dayA = a.getUTCDate();
  const dayB = b.getUTCDate();
  const monA = a
    .toLocaleDateString(CARACAS_LOCALE, { month: "short", timeZone: CARACAS_TZ })
    .replace(".", "");
  const monB = b
    .toLocaleDateString(CARACAS_LOCALE, { month: "short", timeZone: CARACAS_TZ })
    .replace(".", "");
  if (monA === monB) return `${dayA}–${dayB} ${monA}`;
  return `${dayA} ${monA}–${dayB} ${monB}`;
}

export function formatDateShort(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = asDate(iso);
  if (!d) return String(iso);
  return d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
