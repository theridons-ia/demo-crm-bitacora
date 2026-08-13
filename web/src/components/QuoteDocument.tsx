import { Download, Image as ImageIcon } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { formatDateTime } from "../lib/caracasTime";
import { formatQuoteAmount, IVA_RATE, quoteMoney } from "../lib/quoteMoney";
import type { Client, CurrencyCode, Product } from "../lib/types";
import { Button } from "./Button";
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
};

type Props = {
  data: QuoteDocumentData;
  showActions?: boolean;
  /** Rasteriza el documento y lo muestra como imagen (paso 3 / ficha OV). */
  asImage?: boolean;
  className?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Código de cotización provisional COT-AAMMDD-#### */
export function draftQuoteCode(visitId: number, when = new Date()): string {
  const yy = String(when.getFullYear()).slice(-2);
  const mm = pad2(when.getMonth() + 1);
  const dd = pad2(when.getDate());
  return `COT-${yy}${mm}${dd}-${String(visitId).padStart(4, "0")}`;
}

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

async function canvasFromNode(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
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
    const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    async function downloadPng() {
      setBusy("png");
      try {
        let href = previewUrl;
        if (!href) {
          if (!sheetRef.current) return;
          const canvas = await canvasFromNode(sheetRef.current);
          href = canvas.toDataURL("image/png");
        }
        const a = document.createElement("a");
        a.href = href;
        a.download = `${data.code}.png`;
        a.click();
      } finally {
        setBusy(null);
      }
    }

    async function downloadPdf() {
      setBusy("pdf");
      try {
        let img = previewUrl;
        let width = 0;
        let height = 0;
        if (img) {
          const probe = new Image();
          await new Promise<void>((resolve, reject) => {
            probe.onload = () => resolve();
            probe.onerror = () => reject(new Error("preview"));
            probe.src = img!;
          });
          width = probe.naturalWidth;
          height = probe.naturalHeight;
        } else {
          if (!sheetRef.current) return;
          const canvas = await canvasFromNode(sheetRef.current);
          img = canvas.toDataURL("image/jpeg", 0.92);
          width = canvas.width;
          height = canvas.height;
        }
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableW = pageW - margin * 2;
        const ratio = height / width;
        let drawW = usableW;
        let drawH = drawW * ratio;
        if (drawH > pageH - margin * 2) {
          drawH = pageH - margin * 2;
          drawW = drawH / ratio;
        }
        const x = (pageW - drawW) / 2;
        pdf.addImage(img, img.startsWith("data:image/png") ? "PNG" : "JPEG", x, margin, drawW, drawH);
        pdf.save(`${data.code}.pdf`);
      } finally {
        setBusy(null);
      }
    }

    useImperativeHandle(ref, () => ({ downloadPng, downloadPdf }));

    useEffect(() => {
      if (!asImage) {
        setPreviewUrl(null);
        return;
      }
      let cancelled = false;
      setPreviewUrl(null);
      const t = window.setTimeout(() => {
        void (async () => {
          if (!sheetRef.current) return;
          try {
            const canvas = await canvasFromNode(sheetRef.current);
            if (!cancelled) setPreviewUrl(canvas.toDataURL("image/png"));
          } catch {
            /* se deja el HTML visible */
          }
        })();
      }, 80);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }, [asImage, data]);

    const sheet = (
      <div ref={sheetRef} className="quote-doc">
        <header className="quote-doc-head">
          <div className="quote-doc-brand">
            <div className="quote-doc-logo">
              <img src="/brand/enrutas-logo.svg" alt="" width={64} height={64} />
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
            <p>Emisión: {issued}</p>
            <p>Atendido por: {data.sellerName}</p>
          </div>
        </header>

        <section className="quote-doc-parties">
          <div className="quote-doc-party-row">
            <p>
              <span>Cliente:</span> {data.client?.name ?? data.clientFallback}
            </p>
            <p className="is-end">
              <span>Válido hasta:</span> {validLabel}
            </p>
          </div>
          <div className="quote-doc-party-row">
            <p>
              <span>RIF / CI:</span> {clientId}
            </p>
            <p className="is-end">
              {isVes ? (
                <>
                  <span>Tasa USD BCV:</span>{" "}
                  {fx != null ? fx.toLocaleString("es-VE", { maximumFractionDigits: 4 }) : "—"}
                </>
              ) : (
                <>
                  <span>Moneda:</span> USD
                </>
              )}
            </p>
          </div>
          <div className="quote-doc-party-row">
            <p>
              <span>Dirección:</span> {address}
            </p>
            <p className="is-end">
              <span>Condición:</span> {data.isCredit ? "Crédito" : "Contado"}
            </p>
          </div>
        </section>

        <div className="quote-doc-table-wrap">
          <img
            className="quote-doc-watermark"
            src="/brand/enrutas-logo.svg"
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
            <span>Notas:</span> {data.notes}
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
      <div className={`quote-doc-wrap ${className}`.trim()}>
        {showActions ? (
          <div className="quote-doc-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void downloadPng()}
            >
              <ImageIcon size={16} />
              {busy === "png" ? "Generando…" : "Descargar imagen"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void downloadPdf()}
            >
              <Download size={16} />
              {busy === "pdf" ? "Generando…" : "Descargar PDF"}
            </Button>
          </div>
        ) : null}

        {asImage && previewUrl ? (
          <img className="quote-doc-image" src={previewUrl} alt={data.code} />
        ) : null}
        <div className={asImage && previewUrl ? "quote-doc-capture" : undefined}>
          {sheet}
        </div>
      </div>
    );
  },
);
