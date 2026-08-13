import { Calendar, Clock, MapPin, Play, ShoppingCart, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./Button";
import { CloseVisitSheet } from "./CloseVisitSheet";
import { LiveLed } from "./LiveLed";
import { Modal } from "./Modal";
import { SaleDetailSheet } from "./SaleDetailSheet";
import { VisitMapSheet } from "./VisitMapSheet";
import { VisitSaleWizard } from "./VisitSaleWizard";
import { ApiError, startVisit } from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
import type { Visit, VisitStatus } from "../lib/types";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onUpdated: (visit: Visit) => void;
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Cerrada",
  cancelada: "Cancelada",
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Ficha de visita: hero + OV destacada + cierre sin re-vender. */
export function VisitDetailSheet({ visit, open, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [viewSaleDoc, setViewSaleDoc] = useState(false);
  const [current, setCurrent] = useState(visit);
  const [saleJustConfirmed, setSaleJustConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent(visit);
    setError(null);
    setClosing(false);
    setSelling(false);
    setShowMap(false);
    setViewSaleDoc(false);
    setSaleJustConfirmed(false);
  }, [open, visit]);

  const clientName = current.client?.name ?? `Cliente #${current.client_id}`;
  const timeLabel =
    current.scheduled_time != null ? String(current.scheduled_time).slice(0, 5) : null;
  const live = current.status === "en_curso";
  const sale = current.sale ?? null;
  const itemCount = sale?.items?.length ?? 0;
  const heroClass =
    current.status === "en_curso"
      ? ""
      : current.status === "completada"
        ? "is-done"
        : "is-planned";

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      const geo = await getCurrentPosition();
      const updated = await startVisit(current.id, {
        latitude: geo.ok ? geo.fix.latitude : null,
        longitude: geo.ok ? geo.fix.longitude : null,
        gps_accuracy_m: geo.ok ? (geo.fix.accuracy_m ?? null) : null,
        gps_offline: !geo.ok,
      });
      setCurrent(updated);
      onUpdated(updated);
      if (!geo.ok) setError(`Iniciada sin GPS: ${geo.reason}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la visita");
    } finally {
      setBusy(false);
    }
  }

  const overlayOpen = closing || selling || showMap || viewSaleDoc;

  return (
    <>
      <Modal
        open={open && !overlayOpen}
        onClose={onClose}
        eyebrow="Visita"
        title={clientName}
        blurb={live ? undefined : STATUS_LABEL[current.status]}
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar ficha
            </Button>
            {current.status === "programada" ? (
              <Button type="button" variant="accent" disabled={busy} onClick={() => void onStart()}>
                <Play size={16} />
                {busy ? "Iniciando…" : "Iniciar"}
              </Button>
            ) : null}
            {current.status === "en_curso" && !sale ? (
              <Button type="button" variant="accent" onClick={() => setSelling(true)}>
                <ShoppingCart size={16} />
                Registrar venta
              </Button>
            ) : null}
            {current.status === "en_curso" ? (
              <Button
                type="button"
                variant={sale ? "accent" : "secondary"}
                onClick={() => setClosing(true)}
              >
                <Square size={16} />
                Cerrar visita
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="visit-detail">
          <div className={`visit-detail-hero ${heroClass}`.trim()}>
            <div className="visit-detail-hero-copy">
              <p className="eyebrow">Estado</p>
              {live ? (
                <LiveLed size="md" />
              ) : (
                <strong>{STATUS_LABEL[current.status]}</strong>
              )}
              {current.result ? (
                <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                  {current.result === "sin_venta" ? "Cerrada sin venta" : "Cerrada con venta"}
                </p>
              ) : null}
            </div>
            <span className={`badge badge-${current.status}`}>{STATUS_LABEL[current.status]}</span>
          </div>

          {sale ? (
            <div
              className={`visit-sale-confirmed ${saleJustConfirmed ? "is-flash" : ""}`.trim()}
              role="status"
            >
              <div className="visit-sale-confirmed-copy">
                <p className="eyebrow">Orden de venta</p>
                <strong>OV-{sale.id}</strong>
                <div className="visit-sale-metrics">
                  <div>
                    <span className="muted small">Total</span>
                    <b>
                      ${Number(sale.total_amount).toFixed(2)} {sale.currency}
                    </b>
                  </div>
                  <div>
                    <span className="muted small">Ítems</span>
                    <b>{itemCount}</b>
                  </div>
                  <div>
                    <span className="muted small">Pago</span>
                    <b>{sale.is_credit ? "Crédito" : "Contado"}</b>
                  </div>
                </div>
                {saleJustConfirmed ? (
                  <p className="gps-ok-note" style={{ marginTop: "0.55rem" }}>
                    Venta registrada. Ya puedes cerrar la visita.
                  </p>
                ) : null}
                <div style={{ marginTop: "0.65rem" }}>
                  <Button type="button" variant="secondary" onClick={() => setViewSaleDoc(true)}>
                    Ver cotización / OV
                  </Button>
                </div>
              </div>
              {live ? <LiveLed size="sm" label="En curso" /> : null}
            </div>
          ) : live ? (
            <p className="muted small" style={{ margin: 0 }}>
              Registra la venta aquí. El cierre solo pide evidencia GPS/foto.
            </p>
          ) : null}

          <dl className="visit-detail-grid">
            {current.client?.rif || current.client?.ci ? (
              <div className="visit-detail-row">
                <dt>ID</dt>
                <dd>{current.client.rif ?? `CI ${current.client.ci}`}</dd>
              </div>
            ) : null}

            {current.client?.address || current.client?.state ? (
              <div className="visit-detail-row">
                <dt>Dirección</dt>
                <dd>
                  {current.client.address ?? "—"}
                  {current.client.state ? ` · ${current.client.state}` : ""}
                </dd>
              </div>
            ) : null}

            {current.scheduled_date ? (
              <div className="visit-detail-row">
                <dt>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={12} /> Agenda
                  </span>
                </dt>
                <dd>
                  {current.scheduled_date}
                  {timeLabel ? ` · ${timeLabel}` : ""}
                </dd>
              </div>
            ) : null}

            {current.visited_at ? (
              <div className="visit-detail-row">
                <dt>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Clock size={12} /> Inicio
                  </span>
                </dt>
                <dd>{formatWhen(current.visited_at)}</dd>
              </div>
            ) : null}

            {current.description ? (
              <div className="visit-detail-row">
                <dt>Nota</dt>
                <dd>{current.description}</dd>
              </div>
            ) : null}

            {current.latitude != null && current.longitude != null ? (
              <div className="visit-detail-row">
                <dt>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} /> GPS
                  </span>
                </dt>
                <dd className="muted" style={{ fontWeight: 600 }}>
                  {Number(current.latitude).toFixed(5)}, {Number(current.longitude).toFixed(5)}
                  {current.gps_offline ? " · offline" : ""}
                </dd>
              </div>
            ) : (
              <div className="visit-detail-row">
                <dt>GPS</dt>
                <dd className="muted" style={{ fontWeight: 600 }}>
                  Sin coordenada aún
                </dd>
              </div>
            )}
          </dl>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          {current.id > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setShowMap(true)}>
              <MapPin size={16} />
              Ver mapa / trail
            </Button>
          ) : null}
        </div>
      </Modal>

      {selling ? (
        <VisitSaleWizard
          visit={current}
          open
          onClose={() => setSelling(false)}
          onSold={(saleOut) => {
            const updated: Visit = { ...current, sale: saleOut };
            setCurrent(updated);
            setSaleJustConfirmed(true);
            setSelling(false);
            onUpdated(updated);
          }}
        />
      ) : null}

      {closing ? (
        <CloseVisitSheet
          visit={current}
          open
          onClose={() => setClosing(false)}
          onGoRegisterSale={() => {
            setClosing(false);
            setSelling(true);
          }}
          onClosed={(updated) => {
            setCurrent(updated);
            setClosing(false);
            onUpdated(updated);
            onClose();
          }}
        />
      ) : null}

      {viewSaleDoc && sale ? (
        <SaleDetailSheet
          sale={sale}
          open
          initialTab="documento"
          sellerName={user?.full_name ?? current.seller?.full_name ?? null}
          onClose={() => setViewSaleDoc(false)}
        />
      ) : null}

      {showMap ? (
        <VisitMapSheet visit={current} open onClose={() => setShowMap(false)} />
      ) : null}
    </>
  );
}
