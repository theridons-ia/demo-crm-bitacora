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

export function formatWeekdayShort(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00-04:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(CARACAS_LOCALE, {
    timeZone: CARACAS_TZ,
    weekday: "short",
  });
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
