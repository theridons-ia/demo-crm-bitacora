import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

const PROBE_MS = 30_000;
const PROBE_OFFLINE_MS = 15_000;
const SLOW_MS = 2500;
const MIN_GAP_MS = 4_000;

function bootKind(): SignalKind {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
}

/** Señal real: sin red del navegador, o el sondeo a `/api/health` no llega. */
export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<SignalKind>(bootKind);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const lastAt = useRef(0);

  const probe = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlight.current) return;
    if (!force && now - lastAt.current < MIN_GAP_MS) return;
    inFlight.current = true;
    lastAt.current = now;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setKind("offline");
        setCheckedAt(now);
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
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void probe(true);
    const onOnline = () => void probe(true);
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
    () => ({ kind, checkedAt, probe: () => void probe(true) }),
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
