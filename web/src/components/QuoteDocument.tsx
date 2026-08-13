import { Download, Image as ImageIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "./Button";
import type { Client, CurrencyCode, Product } from "../lib/types";
import type { QuoteLine } from "./SaleQuoter";

export type QuoteDocLine = {
  sku: string;
  name: string;
  quantity: number;
  unitUsd: number;
  lineUsd: number;
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
};

export type QuoteDocumentHandle = {
  downloadPng: () => Promise<void>;
  downloadPdf: () => Promise<void>;
};

type Props = {
  data: QuoteDocumentData;
  /** Mostrar botones de descarga encima del documento. */
  showActions?: boolean;
  className?: string;
};

function moneyUsd(n: number): string {
  return `$ ${n.toFixed(2)}`;
}

function moneyBs(n: number): string {
  return `Bs ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

/**
 * Documento de cotización imprimible / exportable (estilo OV limpio).
 * Colores EnRutas (teal), no la paleta del ejemplo de referencia.
 */
export const QuoteDocument = forwardRef<QuoteDocumentHandle, Props>(
  function QuoteDocument({ data, showActions = true, className = "" }, ref) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState<"png" | "pdf" | null>(null);

    const subtotalUsd = data.lines.reduce((s, l) => s + l.lineUsd, 0);
    const fx = data.fxRate != null && data.fxRate > 0 ? data.fxRate : null;
    const subtotalBs = fx != null ? subtotalUsd * fx : null;
    const clientId =
      data.client?.rif ?? (data.client?.ci ? `CI ${data.client.ci}` : "—");
    const address = [data.client?.address, data.client?.state].filter(Boolean).join(" · ") || "—";
    const issued = data.issuedAt.toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const validUntil = new Date(data.issuedAt);
    validUntil.setDate(validUntil.getDate() + 1);
    const validLabel = validUntil.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    async function downloadPng() {
      if (!sheetRef.current) return;
      setBusy("png");
      try {
        const canvas = await canvasFromNode(sheetRef.current);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `${data.code}.png`;
        a.click();
      } finally {
        setBusy(null);
      }
    }

    async function downloadPdf() {
      if (!sheetRef.current) return;
      setBusy("pdf");
      try {
        const canvas = await canvasFromNode(sheetRef.current);
        const { jsPDF } = await import("jspdf");
        const img = canvas.toDataURL("image/jpeg", 0.92);
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const usableW = pageW - margin * 2;
        const ratio = canvas.height / canvas.width;
        let drawW = usableW;
        let drawH = drawW * ratio;
        if (drawH > pageH - margin * 2) {
          drawH = pageH - margin * 2;
          drawW = drawH / ratio;
        }
        const x = (pageW - drawW) / 2;
        pdf.addImage(img, "JPEG", x, margin, drawW, drawH);
        pdf.save(`${data.code}.pdf`);
      } finally {
        setBusy(null);
      }
    }

    useImperativeHandle(ref, () => ({ downloadPng, downloadPdf }));

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

        <div ref={sheetRef} className="quote-doc">
          <header className="quote-doc-head">
            <div className="quote-doc-brand">
              <img src="/brand/enrutas-logo.svg" alt="" width={40} height={40} />
              <div>
                <strong>EnRutas</strong>
                <p>Bitácora Campo · Venezuela</p>
              </div>
            </div>
            <div className="quote-doc-meta">
              <span className="quote-doc-title">
                {data.code.startsWith("OV-") ? "ORDEN DE VENTA" : "COTIZACIÓN"}
              </span>
              <p>
                <strong>{data.code}</strong>
              </p>
              <p>Emisión: {issued}</p>
              <p>Atendido por: {data.sellerName}</p>
            </div>
          </header>

          <section className="quote-doc-parties">
            <div>
              <p>
                <span>Cliente</span>
                <strong>{data.client?.name ?? data.clientFallback}</strong>
              </p>
              <p>
                <span>RIF / CI</span>
                <strong>{clientId}</strong>
              </p>
              <p>
                <span>Dirección</span>
                <strong>{address}</strong>
              </p>
            </div>
            <div>
              <p>
                <span>Válido hasta</span>
                <strong>{validLabel}</strong>
              </p>
              <p>
                <span>Moneda</span>
                <strong>{data.currency}</strong>
              </p>
              <p>
                <span>Tasa USD</span>
                <strong>{fx != null ? `${fx.toFixed(2)} Bs/$` : "—"}</strong>
              </p>
              {data.isCredit ? (
                <p>
                  <span>Condición</span>
                  <strong>Crédito</strong>
                </p>
              ) : null}
            </div>
          </section>

          <table className="quote-doc-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>P. unit. $</th>
                <th>Subtotal $</th>
                {fx != null ? <th>Ref. Bs</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={`${line.sku}-${line.name}`}>
                  <td>{line.sku}</td>
                  <td>{line.name}</td>
                  <td>{line.quantity}</td>
                  <td>{moneyUsd(line.unitUsd)}</td>
                  <td>{moneyUsd(line.lineUsd)}</td>
                  {fx != null ? <td>{moneyBs(line.lineUsd * fx)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="quote-doc-totals">
            <div className="quote-doc-totals-box">
              <div>
                <span>Subtotal</span>
                <strong>{moneyUsd(subtotalUsd)}</strong>
                {subtotalBs != null ? <em>{moneyBs(subtotalBs)}</em> : null}
              </div>
              <div className="is-total">
                <span>Total</span>
                <strong>{moneyUsd(subtotalUsd)}</strong>
                {subtotalBs != null ? <em>{moneyBs(subtotalBs)}</em> : null}
              </div>
            </div>
          </div>

          {data.notes ? (
            <p className="quote-doc-notes">
              <span>Notas:</span> {data.notes}
            </p>
          ) : null}

          <footer className="quote-doc-foot">
            <div>
              <strong>Condiciones</strong>
              <ul>
                <li>Documento informativo. Precios sujetos a tasa del día.</li>
                <li>
                  {data.code.startsWith("OV-")
                    ? "Documento asociado a la orden de venta confirmada."
                    : "Al confirmar se genera la orden de venta (OV)."}
                </li>
              </ul>
            </div>
            <div>
              <strong>Firma</strong>
              <div className="quote-doc-sign" />
            </div>
          </footer>
        </div>
      </div>
    );
  },
);
