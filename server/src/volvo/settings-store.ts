import { log } from "./log.js";
/**
 * 用户设置持久化
 *
 * 按手机号索引，存储在 DATA_DIR/settings.json。
 * AMap Key、安全密钥等设置跟随账号，换设备登录自动同步。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
const STORE_FILE = path.join(DATA_DIR, "settings.json");

export interface UserSettings {
  amapKey: string;
  amapSecurityCode: string;
}

function empty(): UserSettings {
  return { amapKey: "", amapSecurityCode: "" };
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function readStore(): Record<string, UserSettings> {
  try {
    if (!existsSync(STORE_FILE)) return {};
    const raw = readFileSync(STORE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data as Record<string, UserSettings>;
  } catch (err) {
    log.error("settings-store", `read failed: ${(err as Error).message}`);
    return {};
  }
}

function writeStore(data: Record<string, UserSettings>): void {
  try {
    ensureDir();
    writeFileSync(STORE_FILE, JSON.stringify(data), { mode: 0o600 });
  } catch (err) {
    log.error("settings-store", `write failed: ${(err as Error).message}`);
  }
}

/** 获取用户设置 */
export function getUserSettings(phone: string): UserSettings {
  const store = readStore();
  return store[phone] ?? empty();
}

/** 保存用户设置（部分更新） */
export function updateUserSettings(
  phone: string,
  patch: Partial<UserSettings>,
): UserSettings {
  const store = readStore();
  const current = store[phone] ?? empty();
  const updated: UserSettings = {
    amapKey: patch.amapKey ?? current.amapKey,
    amapSecurityCode: patch.amapSecurityCode ?? current.amapSecurityCode,
  };
  store[phone] = updated;
  writeStore(store);
  return updated;
}
