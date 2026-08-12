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
  newLocalUuid,
  removeQueueItems,
  saveCatalogCache,
  type QueueItem,
} from "./offlineDb";
import type { Client, Product } from "./types";

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
