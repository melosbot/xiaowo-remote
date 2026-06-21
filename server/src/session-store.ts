import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

interface PersistedSession {
  sessionId: string;
  phone: string;
  password: string;
  createdAt: number;
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
const STORE_FILE = path.join(DATA_DIR, "sessions.json");

let writable = true;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    try {
      mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
      console.error(`[session-store] cannot create ${DATA_DIR}:`, (err as Error).message);
      writable = false;
    }
  }
}

function readStore(): PersistedSession[] {
  try {
    if (!existsSync(STORE_FILE)) return [];
    const raw = readFileSync(STORE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (s: unknown) =>
        s &&
        typeof (s as PersistedSession).sessionId === "string" &&
        typeof (s as PersistedSession).phone === "string" &&
        typeof (s as PersistedSession).password === "string",
    );
  } catch (err) {
    console.error(`[session-store] read failed:`, (err as Error).message);
    return [];
  }
}

function writeStore(sessions: PersistedSession[]): void {
  if (!writable) return;
  try {
    ensureDir();
    writeFileSync(STORE_FILE, JSON.stringify(sessions), { mode: 0o600 });
  } catch (err) {
    console.error(`[session-store] write failed:`, (err as Error).message);
    writable = false;
  }
}

export function persistSession(
  sessionId: string,
  phone: string,
  password: string,
): void {
  // Dedup by phone: same account should only have one persisted session
  const sessions = readStore().filter(
    (s) => s.sessionId !== sessionId && s.phone !== phone,
  );
  sessions.push({ sessionId, phone, password, createdAt: Date.now() });
  writeStore(sessions);
}

export function removePersistedSession(sessionId: string): void {
  const sessions = readStore().filter((s) => s.sessionId !== sessionId);
  writeStore(sessions);
}

export function loadPersistedSessions(): PersistedSession[] {
  return readStore();
}
