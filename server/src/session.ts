import { randomUUID } from "node:crypto";
import { VehicleBaseAPI, type BoundVehicle, type UserProfile } from "./volvo/base.js";
import { VehicleController } from "./volvo/vehicle.js";
import {
  persistSession,
  removePersistedSession,
  loadPersistedSessions,
} from "./session-store.js";

interface Session {
  base: VehicleBaseAPI;
  vehicles: Map<string, VehicleController>;
  phone: string;
  createdAt: number;
  keepAlive: ReturnType<typeof setInterval>;
}

const sessions = new Map<string, Session>();
const phoneSessions = new Map<string, string>(); // phone → sessionId
const notifyChatIds = new Map<string, string>(); // vin → tg chatId
const KEEPALIVE_INTERVAL_MS = 1000 * 60 * 5;

async function initSession(
  phone: string,
  password: string,
  sessionId?: string,
): Promise<{ sessionId: string; vehicles: BoundVehicle[] }> {
  const base = new VehicleBaseAPI(phone, password);
  await base.login();
  await base.updateToken();
  const vehicles = await base.getVehicles();

  const sid = sessionId ?? randomUUID();
  const controllers = new Map<string, VehicleController>();
  for (const info of vehicles) {
    const ctrl = new VehicleController(base, info);
    controllers.set(info.vinCode, ctrl);
    ctrl.fetchCapabilities().catch((err) => {
      console.error(
        `[session] capability fetch failed for ${info.vinCode.slice(-6)}:`,
        (err as Error).message,
      );
    });
  }

  const keepAlive = setInterval(() => {
    void keepAliveTokens(sid).catch((err) => {
      console.error(`[keepalive] session ${sid.slice(0, 8)} failed:`, err);
    });
  }, KEEPALIVE_INTERVAL_MS);
  keepAlive.unref();

  const oldSid = phoneSessions.get(phone);
  if (oldSid && oldSid !== sid) {
    destroySession(oldSid);
  }

  sessions.set(sid, {
    base,
    vehicles: controllers,
    phone,
    createdAt: Date.now(),
    keepAlive,
  });
  phoneSessions.set(phone, sid);
  return { sessionId: sid, vehicles };
}

export async function createSession(
  phone: string,
  password: string,
): Promise<{ sessionId: string; vehicles: BoundVehicle[] }> {
  const result = await initSession(phone, password);
  persistSession(result.sessionId, phone, password);
  return result;
}

export async function restoreSessions(): Promise<void> {
  const stored = loadPersistedSessions();
  for (const s of stored) {
    try {
      await initSession(s.phone, s.password, s.sessionId);
      console.log(`[session] restored ${s.sessionId.slice(0, 8)}`);
    } catch (err) {
      // 恢复失败不立即删除持久化会话：可能是 Volvo API 偶发故障，
      // 下次重启或客户端触发自动重登时还有机会恢复。
      // 只有在用户主动退出时才应删除持久化记录。
      console.error(
        `[session] restore failed for ${s.sessionId.slice(0, 8)} (kept on disk for retry):`,
        (err as Error).message,
      );
    }
  }
  if (stored.length > 0) {
    console.log(`[session] restored ${sessions.size}/${stored.length} sessions`);
  }
}

async function keepAliveTokens(sessionId: string): Promise<void> {
  const s = sessions.get(sessionId);
  if (!s) return;
  await s.base.login();
  await s.base.updateToken();
}

export function getSession(sessionId: string): Session {
  const s = sessions.get(sessionId);
  if (!s) throw new SessionError("登录状态已失效，请重新登录");
  return s;
}

export function getController(
  sessionId: string,
  vin: string,
): VehicleController {
  const s = getSession(sessionId);
  const ctrl = s.vehicles.get(vin);
  if (!ctrl) throw new SessionError("未找到对应车辆，请重新选择");
  return ctrl;
}

export async function ensureFreshTokens(sessionId: string): Promise<void> {
  const s = getSession(sessionId);
  await s.base.login();
  await s.base.updateToken();
}

export async function validateSession(sessionId: string): Promise<boolean> {
  const s = sessions.get(sessionId);
  if (!s) return false;
  try {
    await s.base.login();
    await s.base.updateToken();
    return true;
  } catch (err) {
    console.error(
      `[session] validate failed for ${sessionId.slice(0, 8)}:`,
      (err as Error).message,
    );
    return false;
  }
}

export function destroySession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) {
    clearInterval(s.keepAlive);
    for (const ctrl of s.vehicles.values()) ctrl.close();
    sessions.delete(sessionId);
    phoneSessions.delete(s.phone);
    removePersistedSession(sessionId);
  }
}

// ---- 轮询告警 ----

/** 返回所有活跃 session 的轮询目标（vin + controller） */
export function getActivePollingTargets(): Array<{
  vin: string;
  getExterior: () => ReturnType<
    import("./volvo/vehicle.js").VehicleController["getExteriorSnapshot"]
  >;
}> {
  const targets: Array<{
    vin: string;
    getExterior: () => ReturnType<
      import("./volvo/vehicle.js").VehicleController["getExteriorSnapshot"]
    >;
  }> = [];
  for (const [, s] of sessions) {
    for (const [vin, ctrl] of s.vehicles) {
      targets.push({
        vin,
        getExterior: () => ctrl.getExteriorSnapshot(),
      });
    }
  }
  return targets;
}

/** 保存 TG 通知 Chat ID（按 VIN 索引） */
export function setNotifyChatId(vin: string, chatId: string): void {
  notifyChatIds.set(vin, chatId);
}

/** 查询 VIN 对应的 TG Chat ID */
export function getNotifyChatIdForVin(vin: string): string | null {
  return notifyChatIds.get(vin) ?? null;
}

/** 获取 session 对应的手机号 */
export function getSessionPhone(sessionId: string): string | null {
  return sessions.get(sessionId)?.phone ?? null;
}

/** 获取 session 对应的用户信息 */
export function getSessionProfile(sessionId: string): UserProfile | null {
  return sessions.get(sessionId)?.base.userProfile ?? null;
}

/** 获取 session 的 base API，用于调用 membership/sign-in 等 */
export function getSessionBase(
  sessionId: string,
): import("./volvo/base.js").VehicleBaseAPI | null {
  return sessions.get(sessionId)?.base ?? null;
}

export class SessionError extends Error {}
