import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchHealth } from "../lib/api";

export type SignalKind = "online" | "degraded" | "offline";

type NetworkState = {
  kind: SignalKind;
  checkedAt: number | null;
  probe: () => void;
};

const NetworkContext = createContext<NetworkState | null>(null);

const PROBE_MS = 20_000;
const PROBE_OFFLINE_MS = 8_000;
const SLOW_MS = 2500;

function bootKind(): SignalKind {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
}

/** Señal real: sin red del navegador, o el sondeo a `/api/health` no llega. */
export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SignalKind>(bootKind);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const probe = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setKind("offline");
      setCheckedAt(Date.now());
      return;
    }
    const result = await fetchHealth();
    setCheckedAt(Date.now());
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setKind("offline");
      return;
    }
    if (!result.reachable) {
      setKind("offline");
      return;
    }
    if (!result.ok || result.ms > SLOW_MS) {
      setKind("degraded");
      return;
    }
    setKind("online");
  }, []);

  useEffect(() => {
    void probe();
    const onOnline = () => void probe();
    const onOffline = () => {
      setKind("offline");
      setCheckedAt(Date.now());
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void probe();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [probe]);

  useEffect(() => {
    const ms = kind === "online" ? PROBE_MS : PROBE_OFFLINE_MS;
    const timer = window.setInterval(() => void probe(), ms);
    return () => window.clearInterval(timer);
  }, [kind, probe]);

  const value = useMemo(
    () => ({ kind, checkedAt, probe: () => void probe() }),
    [kind, checkedAt, probe],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkState {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error("useNetworkStatus debe usarse dentro de <NetworkStatusProvider>");
  }
  return ctx;
}
