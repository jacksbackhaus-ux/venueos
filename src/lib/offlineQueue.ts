/**
 * Offline-first queue for critical operational logging.
 * Uses IndexedDB when available, falls back to localStorage.
 */
import { supabase } from "@/integrations/supabase/client";

export type ActionType =
  | "temp_log"
  | "cleaning_log"
  | "day_sheet_update"
  | "incident_create"
  | "delivery_log";

export type QueueStatus = "queued" | "syncing" | "failed";

export interface QueueItem {
  id: string;                 // client_uuid (also row id server-side for idempotency)
  created_at: string;
  site_id: string | null;
  action_type: ActionType;
  payload_json: Record<string, unknown>;
  status: QueueStatus;
  retry_count: number;
  last_error?: string | null;
}

const DB_NAME = "miseos-offline";
const STORE = "offline_queue";
const LS_KEY = "miseos.offline_queue.v1";

let dbPromise: Promise<IDBDatabase> | null = null;
function getDB(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => {
      dbPromise = null;
      throw new Error("idb-failed");
    });
  }
  return dbPromise;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// --- LocalStorage fallback ---------------------------------------------------
function lsRead(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as QueueItem[];
  } catch {
    return [];
  }
}
function lsWrite(items: QueueItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {}
}

// --- Public API --------------------------------------------------------------
export async function enqueue(input: {
  action_type: ActionType;
  site_id: string | null;
  payload: Record<string, unknown>;
}): Promise<QueueItem> {
  const item: QueueItem = {
    id: uuid(),
    created_at: new Date().toISOString(),
    site_id: input.site_id,
    action_type: input.action_type,
    payload_json: { ...input.payload, client_uuid: undefined } as Record<string, unknown>,
    status: "queued",
    retry_count: 0,
    last_error: null,
  };
  // Tag the payload with client_uuid for server-side idempotency.
  item.payload_json.client_uuid = item.id;

  const db = await tryDB();
  if (db) {
    await idbPut(db, item);
  } else {
    const all = lsRead();
    all.push(item);
    lsWrite(all);
  }
  emitChange();
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  const db = await tryDB();
  if (!db) return lsRead();
  return idbAll(db);
}

export async function countByStatus(): Promise<{ queued: number; syncing: number; failed: number; total: number }> {
  const items = await listQueue();
  const out = { queued: 0, syncing: 0, failed: 0, total: items.length };
  for (const i of items) out[i.status]++;
  return out;
}

export async function removeItem(id: string) {
  const db = await tryDB();
  if (db) {
    await idbDelete(db, id);
  } else {
    lsWrite(lsRead().filter((i) => i.id !== id));
  }
  emitChange();
}

export async function updateItem(id: string, patch: Partial<QueueItem>) {
  const db = await tryDB();
  if (db) {
    const existing = await idbGet(db, id);
    if (!existing) return;
    await idbPut(db, { ...existing, ...patch });
  } else {
    const all = lsRead().map((i) => (i.id === id ? { ...i, ...patch } : i));
    lsWrite(all);
  }
  emitChange();
}

async function tryDB(): Promise<IDBDatabase | null> {
  try {
    const p = getDB();
    return p ? await p : null;
  } catch {
    return null;
  }
}

function idbAll(db: IDBDatabase): Promise<QueueItem[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueueItem[]);
    req.onerror = () => reject(req.error);
  });
}
function idbGet(db: IDBDatabase, id: string): Promise<QueueItem | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as QueueItem | undefined);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(db: IDBDatabase, item: QueueItem): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Sync orchestrator -------------------------------------------------------
let processing = false;

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error)?.message || String(err);
  return /network|fetch|failed to fetch|offline|timeout/i.test(msg);
}

export async function processQueue(): Promise<void> {
  if (processing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  processing = true;
  try {
    const items = (await listQueue()).filter((i) => i.status !== "failed").sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    for (const item of items) {
      await updateItem(item.id, { status: "syncing" });
      try {
        const { data, error } = await supabase.functions.invoke("offline-sync", {
          body: {
            site_id: item.site_id,
            action_type: item.action_type,
            client_uuid: item.id,
            payload: item.payload_json,
          },
        });
        if (error) throw error;
        if ((data as { ok?: boolean } | null)?.ok === false) {
          throw new Error((data as { error?: string }).error || "sync failed");
        }
        await removeItem(item.id);
      } catch (err) {
        const networkFail = isNetworkError(err);
        const retry = item.retry_count + 1;
        // Exponential backoff handled at trigger level (we just stop processing on network failure).
        await updateItem(item.id, {
          status: networkFail ? "queued" : "failed",
          retry_count: retry,
          last_error: (err as Error)?.message?.slice(0, 500) || "error",
        });
        if (networkFail) break;
      }
    }
  } finally {
    processing = false;
    emitChange();
  }
}

// --- Helper: try online, fall back to queue ---------------------------------
/** Wrap a critical write so that, if offline or network fails, it queues. */
export async function tryOnlineOrQueue<T>(
  input: { action_type: ActionType; site_id: string | null; payload: Record<string, unknown> },
  online: () => Promise<T>
): Promise<{ mode: "online"; result: T } | { mode: "queued"; item: QueueItem }> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    const item = await enqueue(input);
    return { mode: "queued", item };
  }
  try {
    const result = await online();
    return { mode: "online", result };
  } catch (err) {
    if (isNetworkError(err)) {
      const item = await enqueue(input);
      return { mode: "queued", item };
    }
    throw err;
  }
}

// --- Change events for UI ----------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitChange() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

// --- Auto-sync triggers ------------------------------------------------------
let installed = false;
let backoffMs = 2000;
export function installAutoSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const tick = () => {
    processQueue().then(async () => {
      const c = await countByStatus();
      backoffMs = c.queued > 0 ? Math.min(backoffMs * 2, 60_000) : 2000;
    });
  };
  window.addEventListener("online", () => {
    backoffMs = 2000;
    tick();
  });
  // Periodic background attempt while items remain.
  setInterval(() => {
    countByStatus().then((c) => {
      if (c.queued > 0 || c.syncing > 0) tick();
    });
  }, 15_000);
  // Process on load.
  tick();
}
