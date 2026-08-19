/** Redimensiona/comprime una imagen para evidencia PDV (SF-1.6). */

export const MAX_PAYMENT_EVIDENCE_PHOTOS = 3;

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;
const MAX_DATA_URL_CHARS = 450_000;

async function bitmapFromFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) {
    throw new Error("La evidencia debe ser una imagen");
  }
  return createImageBitmap(file);
}

function canvasToCompressedDataUrl(canvas: HTMLCanvasElement): string {
  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error("La foto sigue siendo muy pesada; intenta otra más cercana/oscura o con menos resolución");
  }
  return dataUrl;
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await bitmapFromFile(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvasToCompressedDataUrl(canvas);
}

/** Lee 1 data URL legado o un JSON de hasta 3 fotos. */
export function parsePaymentEvidence(raw: string | null | undefined): string[] {
  const value = raw?.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string" && item.startsWith("data:"))
          .slice(0, MAX_PAYMENT_EVIDENCE_PHOTOS);
      }
    } catch {
      /* snapshot viejo o corrupto */
    }
  }
  if (value.startsWith("data:")) return [value];
  return [];
}

/** 1 foto: data URL. Varias: JSON para poder pasarlas en el visor. */
export function serializePaymentEvidence(photos: string[]): string | null {
  const items = photos
    .filter((item) => item.startsWith("data:"))
    .slice(0, MAX_PAYMENT_EVIDENCE_PHOTOS);
  if (!items.length) return null;
  if (items.length === 1) return items[0];
  return JSON.stringify(items);
}
