import { randomUUID } from "node:crypto";
import { VehicleBaseAPI, type BoundVehicle } from "./volvo/base.js";
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
      console.error(
        `[session] restore failed for ${s.sessionId.slice(0, 8)}:`,
        (err as Error).message,
      );
      removePersistedSession(s.sessionId);
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
  } catch {
    destroySession(sessionId);
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

export class SessionError extends Error {}
