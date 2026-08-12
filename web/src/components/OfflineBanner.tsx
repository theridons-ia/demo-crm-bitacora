import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  flushOfflineQueue,
  queueCount,
  refreshCatalogCache,
  subscribeOfflineQueue,
} from "../lib/offlineQueue";
import { Button } from "./Button";

/** Banner de estado offline + botón sincronizar (SF-1.9). */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    queueCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, []);

  useEffect(() => {
    refreshCount();
    return subscribeOfflineQueue(refreshCount);
  }, [refreshCount]);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        await refreshCatalogCache();
      } catch {
        /* sin red real o token */
      }
      if (cancelled) return;
      const count = await queueCount();
      if (count > 0) {
        setBusy(true);
        const result = await flushOfflineQueue();
        if (!cancelled) {
          setPending(result.remaining);
          if (result.error) setNote(result.error);
          else if (result.flushed) setNote(`Sincronizado: ${result.flushed} pendiente(s)`);
        }
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  async function onSync() {
    setBusy(true);
    setNote(null);
    try {
      if (online) await refreshCatalogCache();
      const result = await flushOfflineQueue();
      setPending(result.remaining);
      if (result.error) setNote(result.error);
      else if (result.flushed) setNote(`Sincronizado: ${result.flushed}`);
      else setNote("Cola vacía");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "No se pudo sincronizar");
    } finally {
      setBusy(false);
    }
  }

  if (online && pending === 0 && !note) return null;

  return (
    <div className={`offline-banner ${online ? "is-online" : "is-offline"}`} role="status">
      <div className="offline-banner-main">
        {online ? <Wifi size={16} aria-hidden /> : <CloudOff size={16} aria-hidden />}
        <span>
          {online
            ? pending
              ? `${pending} pendiente(s) por sincronizar`
              : "En línea"
            : `Sin conexión${pending ? ` · ${pending} en cola` : ""}`}
        </span>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={busy || (!online && pending === 0)}
        onClick={onSync}
      >
        <RefreshCw size={16} aria-hidden />
        {busy ? "Sync…" : "Sincronizar"}
      </Button>
      {note ? <p className="offline-banner-note">{note}</p> : null}
    </div>
  );
}
