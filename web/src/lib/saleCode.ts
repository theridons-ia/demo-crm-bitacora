import { CARACAS_TZ } from "./caracasTime";

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((p) => p.type === type)?.value ?? "00";
}

/** Sello Caracas: día AAMMDD y hora HHMM. */
export function caracasOrderStamp(when = new Date()): { day: string; hm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CARACAS_TZ,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(when);
  return {
    day: `${part(parts, "year")}${part(parts, "month")}${part(parts, "day")}`,
    hm: `${part(parts, "hour")}${part(parts, "minute")}`,
  };
}

/** Borrador de cotización, único por apertura del wizard. */
export function draftQuoteCode(when = new Date()): string {
  const { day, hm } = caracasOrderStamp(when);
  const seq = String(when.getSeconds() * 100 + Math.floor(when.getMilliseconds() / 10)).padStart(
    4,
    "0",
  );
  return `COT-${day}-${hm}-${seq}`;
}
