import {
  closeVisit,
  createSale,
  fetchClients,
  fetchProducts,
  syncOfflineVisits,
  type SaleCreateInput,
  type VisitCloseInput,
} from "./api";
import {
  enqueueItem,
  listQueue,
  loadCatalogCache,
  loadMeta,
  newLocalUuid,
  removeQueueItems,
  saveCatalogCache,
  saveMeta,
  type QueueItem,
} from "./offlineDb";
import type { Client, Product, RouteCard, RouteDetail, Sale, User, Visit, VisitAlert } from "./types";

const listeners = new Set<() => void>();

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyQueue(): void {
  listeners.forEach((fn) => fn());
}

export async function refreshCatalogCache(): Promise<{ clients: Client[]; products: Product[] }> {
  const [clients, products] = await Promise.all([fetchClients(), fetchProducts()]);
  await saveCatalogCache(clients, products);
  return { clients, products };
}

export async function getCachedClients(): Promise<Client[]> {
  const cache = await loadCatalogCache();
  return (cache?.clients as Client[] | undefined) ?? [];
}

export async function getCachedProducts(): Promise<Product[]> {
  const cache = await loadCatalogCache();
  return (cache?.products as Product[] | undefined) ?? [];
}

export async function mergeCatalogClients(clients: Client[]): Promise<void> {
  const prev = await loadCatalogCache();
  await saveCatalogCache(clients, prev?.products ?? []);
}

export async function mergeCatalogProducts(products: Product[]): Promise<void> {
  const prev = await loadCatalogCache();
  await saveCatalogCache((prev?.clients as Client[] | undefined) ?? [], products);
}

export type HomeDayCache = {
  day: string;
  clients: Client[];
  visits: Visit[];
  sales: Sale[];
  route: RouteCard | null;
};

export async function loadHomeDayCache(day: string): Promise<HomeDayCache | null> {
  const row = await loadMeta<HomeDayCache>(`home:${day}`);
  return row?.day === day ? row : null;
}

export async function saveHomeDayCache(row: HomeDayCache): Promise<void> {
  await saveMeta(`home:${row.day}`, row);
}

export async function loadVisitsCache(): Promise<Visit[] | null> {
  return loadMeta<Visit[]>("visits:list");
}

export async function saveVisitsCache(visits: Visit[]): Promise<void> {
  await saveMeta("visits:list", visits);
}

export async function loadSalesCache(): Promise<Sale[] | null> {
  return loadMeta<Sale[]>("sales:list");
}

export async function saveSalesCache(sales: Sale[]): Promise<void> {
  await saveMeta(
    "sales:list",
    sales.map((sale) => ({
      ...sale,
      has_payment_evidence: Boolean(sale.has_payment_evidence || sale.payment_evidence?.trim()),
      payment_evidence: undefined,
    })),
  );
}

export async function loadRouteCache(weekStart: string): Promise<RouteDetail | null> {
  const row = await loadMeta<{ weekStart: string; route: RouteDetail }>(`route:${weekStart}`);
  return row?.weekStart === weekStart ? row.route : null;
}

export async function saveRouteCache(weekStart: string, route: RouteDetail): Promise<void> {
  await saveMeta(`route:${weekStart}`, { weekStart, route });
}

export type SupervisorHomeCache = {
  day: string;
  weekStart: string;
  alerts: VisitAlert[];
  visits: Visit[];
  sellers: User[];
  weekRoutes: RouteCard[];
};

export async function loadSupervisorHomeCache(
  day: string,
  weekStart: string,
): Promise<SupervisorHomeCache | null> {
  const row = await loadMeta<SupervisorHomeCache>(`sup-home:${day}`);
  return row?.day === day && row.weekStart === weekStart ? row : null;
}

export async function saveSupervisorHomeCache(row: SupervisorHomeCache): Promise<void> {
  await saveMeta(`sup-home:${row.day}`, row);
}

export type TeamVisitsCache = {
  sellerId: number | "all";
  visits: Visit[];
  sellers: User[];
};

export async function loadTeamVisitsCache(sellerId: number | "all"): Promise<TeamVisitsCache | null> {
  const row = await loadMeta<TeamVisitsCache>(`team-visits:${sellerId}`);
  return row?.sellerId === sellerId ? row : null;
}

export async function saveTeamVisitsCache(row: TeamVisitsCache): Promise<void> {
  await saveMeta(`team-visits:${row.sellerId}`, row);
}

export async function queueCount(): Promise<number> {
  return (await listQueue()).length;
}

export async function enqueueCloseVisit(visitId: number, payload: VisitCloseInput): Promise<void> {
  const item: QueueItem = {
    id: newLocalUuid("q-close"),
    type: "close_visit",
    createdAt: new Date().toISOString(),
    visitId,
    payload: payload as unknown as Record<string, unknown>,
  };
  await enqueueItem(item);
  notifyQueue();
}

export async function enqueueOfflineVisitSync(payload: Record<string, unknown>): Promise<void> {
  const item: QueueItem = {
    id: newLocalUuid("q-sync"),
    type: "offline_visit_sync",
    createdAt: new Date().toISOString(),
    payload,
  };
  await enqueueItem(item);
  notifyQueue();
}

export async function enqueueCreateSale(payload: SaleCreateInput): Promise<void> {
  const item: QueueItem = {
    id: newLocalUuid("q-sale"),
    type: "create_sale",
    createdAt: new Date().toISOString(),
    payload: payload as unknown as Record<string, unknown>,
  };
  await enqueueItem(item);
  notifyQueue();
}

export type FlushResult = {
  flushed: number;
  remaining: number;
  error?: string;
};

/** Envía la cola al servidor. No borra items si falla la red/auth. */
export async function flushOfflineQueue(): Promise<FlushResult> {
  const queue = await listQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const done: string[] = [];
  let error: string | undefined;

  const syncBatch = queue.filter((q) => q.type === "offline_visit_sync");
  if (syncBatch.length) {
    try {
      await syncOfflineVisits({
        visits: syncBatch.map((q) => q.payload),
      });
      done.push(...syncBatch.map((q) => q.id));
    } catch (err) {
      error = err instanceof Error ? err.message : "Error al sincronizar visitas offline";
      await removeQueueItems(done);
      notifyQueue();
      const remaining = (await listQueue()).length;
      return { flushed: done.length, remaining, error };
    }
  }

  for (const item of queue) {
    if (item.type === "offline_visit_sync") continue;
    try {
      if (item.type === "close_visit") {
        await closeVisit(item.visitId, item.payload as unknown as VisitCloseInput);
      } else if (item.type === "create_sale") {
        await createSale(item.payload as unknown as SaleCreateInput);
      }
      done.push(item.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Error al vaciar la cola offline";
      break;
    }
  }

  await removeQueueItems(done);
  notifyQueue();
  const remaining = (await listQueue()).length;
  return { flushed: done.length, remaining, error };
}
