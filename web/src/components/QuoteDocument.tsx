import { Download, Image as ImageIcon, Printer } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { formatDateTime } from "../lib/caracasTime";
import { formatQuoteAmount, IVA_RATE, quoteMoney } from "../lib/quoteMoney";
import {
  armFilePickerGuard,
  settleFilePickerGuard,
} from "../lib/overlayGuard";
import type { Client, CurrencyCode, Product } from "../lib/types";
import { createPortal } from "react-dom";
import { QUOTE_CAPTURE_CSS } from "../lib/quoteCaptureCss";
import { Button } from "./Button";
import { QuoteDocViewer } from "./QuoteDocViewer";
import type { QuoteLine } from "./SaleQuoter";

export type QuoteDocLine = {
  sku: string;
  name: string;
  quantity: number;
  unitUsd: number;
  lineUsd: number;
};

export type QuoteIssuer = {
  companyName?: string | null;
  rif?: string | null;
  slogan?: string | null;
  address?: string | null;
};

/** Placeholder del dueño de la app (demo Carabobo). Sustituir por razón social real. */
export const DEFAULT_QUOTE_ISSUER: QuoteIssuer = {
  companyName: "Distribuidora Rutas del Centro C.A.",
  rif: "J-40521863-7",
  slogan: "Alimentos y consumo masivo para el canal tradicional",
  address:
    "Av. Bolívar Norte, C.C. Paseo Carabobo, Local 4-12, Valencia, Carabobo — ZP 2001",
};

export type QuoteDocumentData = {
  code: string;
  issuedAt: Date;
  sellerName: string;
  client: Client | null;
  clientFallback: string;
  currency: CurrencyCode;
  fxRate: number | null;
  lines: QuoteDocLine[];
  notes?: string | null;
  isCredit?: boolean;
  applyIva?: boolean;
  /** Emisor (distribuidor). Vacío hasta cargar razón social real. */
  issuer?: QuoteIssuer | null;
};

export type QuoteDocumentHandle = {
  downloadPng: () => Promise<void>;
  downloadPdf: () => Promise<void>;
  printDoc: () => Promise<void>;
};

type Props = {
  data: QuoteDocumentData;
  showActions?: boolean;
  /** Rasteriza el documento y lo muestra como imagen (paso 3 / ficha OV). */
  asImage?: boolean;
  className?: string;
};

export { draftQuoteCode } from "../lib/saleCode";

export function buildQuoteLines(
  lines: QuoteLine[],
  products: Product[],
): QuoteDocLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: QuoteDocLine[] = [];
  for (const line of lines) {
    if (line.productId == null || line.quantity <= 0) continue;
    const p = byId.get(line.productId);
    if (!p) continue;
    const unitUsd = Number(p.price_usd);
    out.push({
      sku: p.sku,
      name: p.name,
      quantity: line.quantity,
      unitUsd,
      lineUsd: unitUsd * line.quantity,
    });
  }
  return out;
}

const LETTER_W = 794;

async function waitPaint() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitImages(root: ParentNode) {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  ).then(() => undefined);
}

function absolutizeImages(root: HTMLElement) {
  const base = window.location.href;
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
    img.src = new URL(src, base).href;
  });
}

async function canvasFromNode(node: HTMLElement) {
  await waitImages(node);
  await waitPaint();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-14000px;top:0;width:794px;height:1123px;border:0;opacity:1;pointer-events:none;z-index:-1";
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  if (!idoc) {
    iframe.remove();
    throw new Error("No se pudo preparar el documento");
  }
  idoc.open();
  idoc.write(
    `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><style>${QUOTE_CAPTURE_CSS}</style></head><body></body></html>`,
  );
  idoc.close();

  const clone = node.cloneNode(true) as HTMLElement;
  clone.classList.add("quote-doc");
  absolutizeImages(clone);
  idoc.body.appendChild(clone);
  await waitImages(clone);
  await waitPaint();

  const { default: html2canvas } = await import("html2canvas");
  const opts = {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 4000,
    useCORS: true,
    allowTaint: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: LETTER_W,
    windowHeight: Math.max(1123, clone.scrollHeight || 1123),
  };
  try {
    try {
      return await html2canvas(clone, opts);
    } catch {
      return await html2canvas(clone, {
        ...opts,
        allowTaint: true,
        ignoreElements: (el) => el.tagName === "IMG",
      });
    }
  } finally {
    iframe.remove();
  }
}

function canvasToPng(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return canvas.toDataURL("image/jpeg", 0.92);
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8_000);
}

async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Documento de cotización / OV.
 * Estructura tipo cotización comercial; colores EnRutas (teal), no paleta de terceros.
 */
export const QuoteDocument = forwardRef<QuoteDocumentHandle, Props>(
  function QuoteDocument(
    { data, showActions = true, asImage = false, className = "" },
    ref,
  ) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState<"png" | "pdf" | "print" | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const applyIva = Boolean(data.applyIva);
    const money = quoteMoney(
      data.lines.reduce((s, l) => s + l.lineUsd, 0),
      applyIva,
    );
    const fx = data.fxRate != null && data.fxRate > 0 ? data.fxRate : null;
    const clientId =
      data.client?.rif ?? (data.client?.ci ? `CI ${data.client.ci}` : "—");
    const address =
      [data.client?.address, data.client?.state].filter(Boolean).join(" · ") || "—";
    const issued = formatDateTime(data.issuedAt);
    const validUntil = new Date(data.issuedAt);
    validUntil.setDate(validUntil.getDate() + 1);
    validUntil.setHours(23, 59, 0, 0);
    const validLabel = formatDateTime(validUntil);
    const isOv = data.code.startsWith("OV-");
    const isVes = data.currency === "VES";
    function amount(usd: number): string {
      return formatQuoteAmount(usd, data.currency, fx);
    }
    const ivaNote = applyIva
      ? `Incluye IVA ${(IVA_RATE * 100).toFixed(0)}%`
      : "Montos mostrados sin IVA";
    const issuer = {
      companyName: data.issuer?.companyName?.trim() || DEFAULT_QUOTE_ISSUER.companyName,
      rif: data.issuer?.rif?.trim() || DEFAULT_QUOTE_ISSUER.rif,
      slogan: data.issuer?.slogan?.trim() || DEFAULT_QUOTE_ISSUER.slogan,
      address: data.issuer?.address?.trim() || DEFAULT_QUOTE_ISSUER.address,
    };

    const captureKey = useMemo(
      () =>
        [
          data.code,
          data.currency,
          data.applyIva ? "1" : "0",
          data.isCredit ? "1" : "0",
          data.notes ?? "",
          String(data.fxRate ?? ""),
          data.sellerName,
          data.lines.map((l) => `${l.sku}:${l.quantity}:${l.lineUsd}`).join("|"),
        ].join("~"),
      [data],
    );

    async function blobFromPreview(): Promise<Blob> {
      if (previewUrl) return blobFromDataUrl(previewUrl);
      if (!sheetRef.current) throw new Error("Sin documento");
      const canvas = await canvasFromNode(sheetRef.current);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!blob) throw new Error("No se pudo generar la imagen");
      try {
        setPreviewUrl(canvasToPng(canvas));
      } catch {
        /* preview opcional si ya hay blob */
      }
      return blob;
    }

    async function runExport(kind: "png" | "pdf" | "print", fn: () => Promise<void>) {
      setBusy(kind);
      setPreviewError(null);
      try {
        await fn();
      } catch (err) {
        setPreviewError(
          err instanceof Error ? err.message : "No se pudo generar el documento",
        );
      } finally {
        setBusy(null);
      }
    }

    async function downloadPng() {
      await runExport("png", async () => {
        armFilePickerGuard();
        try {
          const blob = await blobFromPreview();
          const file = new File([blob], `${data.code}.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: data.code,
                text: data.code,
              });
              return;
            } catch (err) {
              if (err instanceof Error && err.name === "AbortError") return;
            }
          }
          triggerBlobDownload(blob, `${data.code}.png`);
        } finally {
          settleFilePickerGuard(true);
        }
      });
    }

    async function downloadPdf() {
      await runExport("pdf", async () => {
        armFilePickerGuard();
        try {
          const blob = await blobFromPreview();
          const img = URL.createObjectURL(blob);
          const probe = new Image();
          await new Promise<void>((resolve, reject) => {
            probe.onload = () => resolve();
            probe.onerror = () => reject(new Error("preview"));
            probe.src = img;
          });
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const margin = 8;
          const usableW = pageW - margin * 2;
          const ratio = probe.naturalHeight / probe.naturalWidth;
          let drawW = usableW;
          let drawH = drawW * ratio;
          if (drawH > pageH - margin * 2) {
            drawH = pageH - margin * 2;
            drawW = drawH / ratio;
          }
          const x = (pageW - drawW) / 2;
          pdf.addImage(probe, "PNG", x, margin, drawW, drawH);
          const pdfBlob = pdf.output("blob");
          URL.revokeObjectURL(img);
          const file = new File([pdfBlob], `${data.code}.pdf`, { type: "application/pdf" });
          if (navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({ files: [file], title: data.code });
              return;
            } catch (err) {
              if (err instanceof Error && err.name === "AbortError") return;
            }
          }
          triggerBlobDownload(pdfBlob, `${data.code}.pdf`);
        } finally {
          settleFilePickerGuard(true);
        }
      });
    }

    async function printDoc() {
      await runExport("print", async () => {
        const blob = await blobFromPreview();
        const url = URL.createObjectURL(blob);
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        document.body.appendChild(frame);
        const win = frame.contentWindow;
        if (!win) {
          URL.revokeObjectURL(url);
          frame.remove();
          throw new Error("No se pudo abrir la impresión");
        }
        win.document.open();
        win.document.write(
          `<!doctype html><html><head><title>${data.code}</title>
<style>@page{size:A4;margin:10mm}html,body{margin:0}img{width:100%;height:auto;display:block}</style>
</head><body><img src="${url}" alt="${data.code}"></body></html>`,
        );
        win.document.close();
        await new Promise<void>((resolve) => {
          const img = win.document.querySelector("img");
          if (!img || img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        win.focus();
        win.print();
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          frame.remove();
        }, 60_000);
      });
    }

    useImperativeHandle(ref, () => ({ downloadPng, downloadPdf, printDoc }));

    useEffect(() => {
      if (!asImage) {
        setPreviewUrl(null);
        setPreviewError(null);
        return;
      }
      let cancelled = false;
      setPreviewError(null);
      const t = window.setTimeout(() => {
        void (async () => {
          try {
            if (!sheetRef.current) {
              if (!cancelled) setPreviewError("No se pudo preparar el documento");
              return;
            }
            const canvas = await canvasFromNode(sheetRef.current);
            if (!cancelled) setPreviewUrl(canvasToPng(canvas));
          } catch (err) {
            if (!cancelled) {
              setPreviewError(
                err instanceof Error ? err.message : "No se pudo preparar el documento",
              );
            }
          }
        })();
      }, 120);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }, [asImage, captureKey]);

    const renderSheet = (targetRef?: Ref<HTMLDivElement>, letter = false) => (
      <div ref={targetRef} className={letter ? "quote-doc is-letter-page" : "quote-doc"}>
        <header className="quote-doc-head">
          <div className="quote-doc-brand">
            <div className="quote-doc-logo">
              <img src="/brand/enrutas-logo.png" alt="" width={64} height={64} />
            </div>
            <div className="quote-doc-company">
              <h2>{issuer.companyName}</h2>
              <p className="quote-doc-rif">RIF {issuer.rif}</p>
              {issuer.slogan ? <p className="quote-doc-slogan">{issuer.slogan}</p> : null}
              {issuer.address ? <p className="quote-doc-addr">{issuer.address}</p> : null}
            </div>
          </div>
          <div className="quote-doc-meta">
            <span className="quote-doc-title">{isOv ? "ORDEN DE VENTA" : "COTIZACIÓN"}</span>
            <p>
              <strong>{data.code}</strong>
            </p>
            <p>Emisión:{"\u00A0"}{issued}</p>
            <p>Atendido por:{"\u00A0"}{data.sellerName}</p>
          </div>
        </header>

        <section className="quote-doc-parties">
          <div className="quote-doc-party-row">
            <p>
              <span>Cliente:</span>
              {"\u00A0"}
              {data.client?.name ?? data.clientFallback}
            </p>
            <p className="is-end">
              <span>Válido hasta:</span>
              {"\u00A0"}
              {validLabel}
            </p>
          </div>
          <div className="quote-doc-party-row">
            <p>
              <span>RIF / CI:</span>
              {"\u00A0"}
              {clientId}
            </p>
            <p className="is-end">
              {isVes ? (
                <>
                  <span>Tasa USD BCV:</span>
                  {"\u00A0"}
                  {fx != null ? fx.toLocaleString("es-VE", { maximumFractionDigits: 4 }) : "—"}
                </>
              ) : (
                <>
                  <span>Moneda:</span>
                  {"\u00A0"}
                  USD
                </>
              )}
            </p>
          </div>
          <div className="quote-doc-party-row">
            <p>
              <span>Dirección:</span>
              {"\u00A0"}
              {address}
            </p>
            <p className="is-end">
              <span>Condición:</span>
              {"\u00A0"}
              {data.isCredit ? "Crédito" : "Contado"}
            </p>
          </div>
        </section>

        <div className="quote-doc-table-wrap">
          <img
            className="quote-doc-watermark"
            src="/brand/enrutas-logo.png"
            alt=""
            aria-hidden
          />
          <table className="quote-doc-table">
            <colgroup>
              <col className="col-sku" />
              <col className="col-desc" />
              <col className="col-qty" />
              <col className="col-unit" />
              <col className="col-sub" />
            </colgroup>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th className="is-num">Cant.</th>
                <th className="is-num">Precio unit.</th>
                <th className="is-num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={`${line.sku}-${line.name}`}>
                  <td>{line.sku}</td>
                  <td className="quote-doc-desc">{line.name}</td>
                  <td className="is-num">{line.quantity}</td>
                  <td className="is-num">{amount(line.unitUsd)}</td>
                  <td className="is-num">{amount(line.lineUsd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} />
                <td>Subtotal</td>
                <td className="is-num">{amount(money.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} />
                <td>IVA {(IVA_RATE * 100).toFixed(0)}%</td>
                <td className="is-num">{applyIva ? amount(money.iva) : "—"}</td>
              </tr>
              <tr className="is-total">
                <td colSpan={3} />
                <td>Total</td>
                <td className="is-num">{amount(money.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {isVes && fx != null ? (
          <p className="quote-doc-rate">Tasa USD BCV: {fx.toFixed(2)} Bs/$</p>
        ) : null}

        {data.notes ? (
          <p className="quote-doc-notes">
            <span>Notas:</span>
            {"\u00A0"}
            {data.notes}
          </p>
        ) : null}

        <footer className="quote-doc-foot">
          <div>
            <strong>Condiciones y notas</strong>
            <ul>
              <li>{ivaNote}.</li>
              <li>Precios sujetos a tasa del día y existencia.</li>
              <li>
                {isOv
                  ? "Documento asociado a la orden de venta confirmada."
                  : "Al confirmar se genera la orden de venta (OV)."}
              </li>
            </ul>
          </div>
          <div>
            <strong>Documento</strong>
            <p>{issuer.companyName}</p>
            <p>{data.currency === "VES" ? "Liquidación en bolívares" : "Valores en USD"}</p>
          </div>
          <div>
            <strong>Firma</strong>
            <div className="quote-doc-sign" />
          </div>
        </footer>
      </div>
    );

    return (
      <div className={`quote-doc-wrap${asImage ? " is-letter" : ""} ${className}`.trim()}>
        {showActions ? (
          <div className="quote-doc-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void downloadPng()}
            >
              <ImageIcon size={16} />
              {busy === "png" ? "Guardando…" : "Guardar imagen"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void downloadPdf()}
            >
              <Download size={16} />
              {busy === "pdf" ? "Generando…" : "PDF"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void printDoc()}
            >
              <Printer size={16} />
              {busy === "print" ? "Abriendo…" : "Imprimir"}
            </Button>
          </div>
        ) : null}

        {asImage ? (
          <button
            type="button"
            className="quote-doc-thumb"
            onClick={() => setViewerOpen(true)}
          >
            <span className="quote-doc-thumb-frame">
              <span className="quote-doc-thumb-scale">{renderSheet(undefined, true)}</span>
            </span>
            <span>Toca para ampliar · pellizca en la vista previa</span>
          </button>
        ) : null}
        {previewError ? (
          <p className="form-error" role="alert">
            {previewError}
          </p>
        ) : null}

        {asImage && typeof document !== "undefined"
          ? createPortal(
              <div className="quote-doc-capture" aria-hidden style={{ width: LETTER_W }}>
                {renderSheet(sheetRef, true)}
              </div>,
              document.body,
            )
          : asImage
            ? null
            : renderSheet(sheetRef)}

        {asImage ? (
          <QuoteDocViewer
            open={viewerOpen}
            src={previewUrl}
            alt={data.code}
            onClose={() => setViewerOpen(false)}
            fallback={renderSheet(undefined, true)}
          />
        ) : null}
      </div>
    );
  },
);
