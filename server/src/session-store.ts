import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import crypto from "node:crypto";
import { log } from "./volvo/log.js";
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

// ---- 密码加密(AES-256-GCM)----
// 持久化的密码以密文存储,密钥来自 SESSION_SECRET;未设置则用默认密钥(仅避免明文落盘,生产应配置)
const ENC_PREFIX = "enc:";
const KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET ?? "xiaowo-remote-default-key-v1")
  .digest();
if (!process.env.SESSION_SECRET) {
  log.warn(
    "session-store",
    "SESSION_SECRET 未设置,密码用默认密钥加密(生产请配置 SESSION_SECRET)",
  );
}

/** 加密明文 → "enc:" + base64(iv | authTag | ciphertext) */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/** 解密;仅 "enc:" 前缀才解密,否则视为旧版明文原样返回(向后兼容历史 sessions.json) */
export function decryptPassword(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString(
    "utf8",
  );
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    try {
      mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
      log.warn("session-store", `cannot create ${DATA_DIR}: ${(err as Error).message}`);
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
    log.warn("session-store", `read failed: ${(err as Error).message}`);
    return [];
  }
}

function writeStore(sessions: PersistedSession[]): void {
  if (!writable) return;
  try {
    ensureDir();
    writeFileSync(STORE_FILE, JSON.stringify(sessions), { mode: 0o600 });
  } catch (err) {
    log.warn("session-store", `write failed: ${(err as Error).message}`);
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
  sessions.push({
    sessionId,
    phone,
    password: encryptPassword(password),
    createdAt: Date.now(),
  });
  writeStore(sessions);
}

export function removePersistedSession(sessionId: string): void {
  const sessions = readStore().filter((s) => s.sessionId !== sessionId);
  writeStore(sessions);
}

export function loadPersistedSessions(): PersistedSession[] {
  const out: PersistedSession[] = [];
  for (const s of readStore()) {
    try {
      out.push({ ...s, password: decryptPassword(s.password) });
    } catch (err) {
      log.warn(
        "session-store",
        `decrypt failed for ${s.sessionId.slice(0, 8)}: ${(err as Error).message}`,
      );
    }
  }
  return out;
}
