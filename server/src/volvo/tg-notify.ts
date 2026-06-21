/**
 * Telegram Bot API 封装
 *
 * Bot Token 来源优先级：
 *   1. 前端设置页传入（setBotToken），自动持久化到 DATA_DIR/tg-bot-token
 *   2. 环境变量 TG_BOT_TOKEN（服务端配置，始终有效）
 *
 * Chat ID 由用户在浏览器设置页输入，按 VIN 存储在 session.ts。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const TG_API_BASE = "https://api.telegram.org";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
const TOKEN_FILE = path.join(DATA_DIR, "tg-bot-token");

export { DATA_DIR as _dataDir, TOKEN_FILE as _tokenFile };

/** 前端设置的 token（内存 + 磁盘持久化） */
let uiToken: string | null = null;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadPersistedToken(): string | null {
  try {
    if (!existsSync(TOKEN_FILE)) return null;
    const raw = readFileSync(TOKEN_FILE, "utf-8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

function persistToken(token: string | null): void {
  try {
    ensureDir();
    if (token) {
      writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
      console.log("[tg] token persisted to", TOKEN_FILE);
    } else {
      if (existsSync(TOKEN_FILE)) {
        writeFileSync(TOKEN_FILE, "", { mode: 0o600 });
      }
    }
  } catch (err) {
    console.error("[tg] failed to persist token:", (err as Error).message);
  }
}

/** 服务启动时调用，加载磁盘持久化的 token */
export function initTokenPersistence(): void {
  const saved = loadPersistedToken();
  if (saved) {
    uiToken = saved;
    console.log("[tg] restored bot token from disk");
  }
}

/** 获取当前有效的 Bot Token */
export function getBotToken(): string | null {
  return uiToken || (process.env.TG_BOT_TOKEN?.trim() ?? "") || null;
}

/** 前端设置 token（自动持久化到磁盘） */
export function setBotToken(token: string | null): void {
  const trimmed = token?.trim() || null;
  uiToken = trimmed;
  persistToken(trimmed);
}

/** Token 来源描述（用于前端展示） */
export function getTokenSource(): "ui" | "env" | null {
  if (uiToken) return "ui";
  if ((process.env.TG_BOT_TOKEN?.trim() ?? "")) return "env";
  return null;
}

interface TgResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function callTg<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TgResponse<T>> {
  const url = `${TG_API_BASE}/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as TgResponse<T>;
  if (!json.ok) {
    console.error(`[tg] ${method} failed:`, json.description);
  }
  return json;
}

/** 验证 Bot Token 有效性并返回 Bot 用户名 */
export async function testBotToken(
  token: string,
): Promise<{ ok: boolean; username?: string }> {
  try {
    const res = await callTg<{ username: string }>(token, "getMe", {});
    return { ok: res.ok, username: res.result?.username };
  } catch (err) {
    console.error("[tg] testBotToken error:", (err as Error).message);
    return { ok: false };
  }
}

/** 发送消息到指定 Chat */
export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await callTg(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("[tg] sendMessage error:", (err as Error).message);
  }
}
