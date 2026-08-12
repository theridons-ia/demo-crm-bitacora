/** IndexedDB mínimo para cache de catálogo y cola offline (SF-1.9). */

const DB_NAME = "bitacora-campo";
const DB_VERSION = 1;

export type CatalogCache = {
  clients: unknown[];
  products: unknown[];
  updatedAt: string;
};

export type QueueItem =
  | {
      id: string;
      type: "offline_visit_sync";
      createdAt: string;
      payload: Record<string, unknown>;
    }
  | {
      id: string;
      type: "close_visit";
      createdAt: string;
      visitId: number;
      payload: Record<string, unknown>;
    }
  | {
      id: string;
      type: "create_sale";
      createdAt: string;
      payload: Record<string, unknown>;
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("local_visits")) {
        db.createObjectStore("local_visits", { keyPath: "local_uuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

export async function saveCatalogCache(clients: unknown[], products: unknown[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(
    { clients, products, updatedAt: new Date().toISOString() } satisfies CatalogCache,
    "catalog",
  );
  await txDone(tx);
  db.close();
}

export async function loadCatalogCache(): Promise<CatalogCache | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const req = tx.objectStore("meta").get("catalog");
  const value = await new Promise<CatalogCache | null>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as CatalogCache | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return value;
}

export async function listQueue(): Promise<QueueItem[]> {
  const db = await openDb();
  const tx = db.transaction("queue", "readonly");
  const req = tx.objectStore("queue").getAll();
  const rows = await new Promise<QueueItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as QueueItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function enqueueItem(item: QueueItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").put(item);
  await txDone(tx);
  db.close();
}

export async function removeQueueItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  const store = tx.objectStore("queue");
  for (const id of ids) store.delete(id);
  await txDone(tx);
  db.close();
}

export type LocalPendingVisit = {
  local_uuid: string;
  client_id: number;
  client_name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy_m: number | null;
  gps_offline: boolean;
  created_at: string;
};

export async function saveLocalVisit(visit: LocalPendingVisit): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("local_visits", "readwrite");
  tx.objectStore("local_visits").put(visit);
  await txDone(tx);
  db.close();
}

export async function listLocalVisits(): Promise<LocalPendingVisit[]> {
  const db = await openDb();
  const tx = db.transaction("local_visits", "readonly");
  const req = tx.objectStore("local_visits").getAll();
  const rows = await new Promise<LocalPendingVisit[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as LocalPendingVisit[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function removeLocalVisit(localUuid: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("local_visits", "readwrite");
  tx.objectStore("local_visits").delete(localUuid);
  await txDone(tx);
  db.close();
}

export function newLocalUuid(prefix = "local"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
