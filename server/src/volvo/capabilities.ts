import { log } from "./log.js";
/**
 * SPA1 VIN capability 模型
 *
 * 从 /voc/configurations/features 按 VIN 获取车辆远程控制能力。
 * 一次失败只能产生 unknown，不能写死为 unsupported。
 */

import {
  REST_BASE_URL,
  CAPABILITY_PATH,
  CAPABILITY_CONTENT_TYPE,
  CAPABILITY_ACCEPT,
  REST_USER_AGENT,
} from "./client-profile.js";
import { signRequest } from "./signing.js";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

import type {
  CapabilityState,
  CapabilitySource,
  VehicleCapabilities,
} from "../../../shared/types";

// 类型定义统一来自 shared/types.d.ts，re-export 保持外部 import 路径不变
export type { CapabilityState, CapabilitySource, VehicleCapabilities };

// ---------------------------------------------------------------------------
// 缓存
// ---------------------------------------------------------------------------

/** 按 VIN 缓存最后一次成功的 capability 结果 */
const capabilityCache = new Map<string, VehicleCapabilities>();

/** 查询缓存（不发起网络请求） */
export function getCachedCapabilities(
  vin: string,
): VehicleCapabilities | undefined {
  return capabilityCache.get(vin);
}

/** 写入缓存 */
function cacheCapabilities(vin: string, caps: VehicleCapabilities): void {
  capabilityCache.set(vin, caps);
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

/** 全量未知的初始能力 */
function unknownCapabilities(): Omit<VehicleCapabilities, "source" | "fetchedAt"> {
  return {
    lock: "unknown",
    unlock: "unknown",
    engineRemoteStart: "unknown",
    flash: "unknown",
    honk: "unknown",
    window: "unknown",
    sunroof: "unknown",
    tailgate: "unknown",
    preCleaning: "unknown",
    updateStatus: "unknown",
  };
}

/**
 * 将远端响应中的原始字段映射为内部模型。
 *
 * 响应预期为 JSON 对象，字段名与以下 key 匹配：
 * - remote_start / door_lock / door_unlock / honk_and_flash
 * - window_control / sunroof_control / tailgate_control
 * - pre_cleaning / active_refresh
 *
 * 未知或缺失字段保留为 unknown，不猜测。
 */
export function mapResponseToCapabilities(
  raw: Record<string, unknown>,
): Omit<VehicleCapabilities, "source" | "fetchedAt"> {
  const caps = unknownCapabilities();

  const map = (key: string): CapabilityState => {
    const v = raw[key];
    if (typeof v === "boolean") return v ? "supported" : "unsupported";
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (s === "supported" || s === "true") return "supported";
      if (s === "unsupported" || s === "false") return "unsupported";
    }
    return "unknown";
  };

  caps.lock = map("door_lock");
  caps.unlock = map("door_unlock");
  caps.engineRemoteStart = map("remote_start");
  caps.flash = map("honk_and_flash");
  caps.honk = map("honk_and_flash");
  caps.window = map("window_control");
  caps.sunroof = map("sunroof_control");
  caps.tailgate = map("tailgate_control");
  caps.preCleaning = map("pre_cleaning");
  caps.updateStatus = map("active_refresh");

  return caps;
}

// ---------------------------------------------------------------------------
// 远端请求
// ---------------------------------------------------------------------------

/**
 * 从 VOC 获取 capability。
 *
 * 当前请求结构基于 APK 5.67.0 `apac_capability` 模块推断。
 * 实际请求体格式需以抓包确认为准；若响应不可解析则退化为全量 unknown。
 */
async function fetchCapabilities(
  vin: string,
  accessToken: string,
  xToken: string,
): Promise<VehicleCapabilities | null> {
  const url = `${REST_BASE_URL}${CAPABILITY_PATH}`;
  const body = { vin };

  const headers: Record<string, string> = {
    "Content-Type": CAPABILITY_CONTENT_TYPE,
    Accept: CAPABILITY_ACCEPT,
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "User-Agent": REST_USER_AGENT,
    authorization: `Bearer ${accessToken}`,
    "X-Token": xToken,
  };

  const sign = signRequest(url, "POST", body);
  headers["x-sdk-date"] = sign["x-sdk-date"];
  headers["v587sign"] = sign["v587sign"];

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 404) {
      // 端点不存在：能力查询不可用，返回 null 让调用方跳过能力校验
      return null;
    }
    throw new Error(`Capability 请求失败 HTTP ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  const data =
    json && typeof json === "object" && "data" in (json as Record<string, unknown>)
      ? (json as Record<string, unknown>).data
      : json;

  if (!data || typeof data !== "object") {
    throw new Error("Capability 响应结构异常");
  }

  const caps: VehicleCapabilities = {
    ...mapResponseToCapabilities(data as Record<string, unknown>),
    source: "remote",
    fetchedAt: Date.now(),
  };

  return caps;
}

/**
 * 获取能力：优先远端，失败则用缓存，再失败则 fallback。
 */
export async function getCapabilities(
  vin: string,
  accessToken: string,
  xToken: string,
): Promise<VehicleCapabilities | null> {
  try {
    const result = await fetchCapabilities(vin, accessToken, xToken);
    if (result) {
      cacheCapabilities(vin, result);
      return result;
    }
    // 端点 404：能力查询不可用
    const cached = getCachedCapabilities(vin);
    return cached ?? null;
  } catch (err) {
    log.warn("capability", `fetch failed for ${vin.slice(-6)}: ${err}`);
    const cached = getCachedCapabilities(vin);
    return cached ?? null;
  }
}

// ---------------------------------------------------------------------------
// 能力校验辅助
// ---------------------------------------------------------------------------

export class CapabilityError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** 检查指定操作是否受 capability 支持 */
export function requireCapability(
  caps: VehicleCapabilities,
  key: keyof Omit<VehicleCapabilities, "source" | "fetchedAt">,
  label: string,
): void {
  const state = caps[key];
  if (state === "unsupported") {
    throw new CapabilityError(`车辆不支持${label}`);
  }
  if (state === "unknown") {
    throw new CapabilityError(`暂时无法确认车辆是否支持${label}`);
  }
  // supported: pass
}
