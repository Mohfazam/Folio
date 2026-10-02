import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface StoredCallRecord {
  id: string;
  receivedAt: string;
  payload: any;
}

const STORAGE_DIR = join(process.cwd(), ".call-history");
const STORAGE_FILE = join(STORAGE_DIR, "calls.json");

// In-memory cache for fast reads
let memoryCache: StoredCallRecord[] | null = null;

async function ensureDir() {
  try {
    await mkdir(STORAGE_DIR, { recursive: true });
  } catch {
    // Ignore if exists
  }
}

async function loadFromDisk(): Promise<StoredCallRecord[]> {
  try {
    await ensureDir();
    const data = await readFile(STORAGE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveToDisk(records: StoredCallRecord[]): Promise<void> {
  try {
    await ensureDir();
    await writeFile(STORAGE_FILE, JSON.stringify(records, null, 2), "utf-8");
  } catch (err) {
    console.error("[callStore] Failed to write calls to disk:", err);
  }
}

export async function getCallRecords(): Promise<StoredCallRecord[]> {
  if (!memoryCache) {
    memoryCache = await loadFromDisk();
  }
  return memoryCache;
}

export async function storeCallRecord(payload: any): Promise<StoredCallRecord> {
  const records = await getCallRecords();
  
  const id = payload.deliveryId || payload.requestId || `call-${Date.now()}`;
  const record: StoredCallRecord = {
    id,
    receivedAt: new Date().toISOString(),
    payload,
  };

  // Upsert by deliveryId/requestId to maintain idempotency
  const existingIdx = records.findIndex((r) => r.id === id);
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    // Prepend so newest is first
    records.unshift(record);
  }

  // Keep last 100 calls in local test store
  if (records.length > 100) {
    records.splice(100);
  }

  memoryCache = records;
  await saveToDisk(records);
  return record;
}

export async function clearCallRecords(): Promise<void> {
  memoryCache = [];
  await saveToDisk([]);
}
