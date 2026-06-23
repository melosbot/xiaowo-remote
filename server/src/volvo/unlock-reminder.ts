/**
 * 车门未锁提醒 — 内存状态机
 *
 * 在每次 getStatus() 轮询到 carLocked 变化时追踪锁状态，
 * 超阈值后生成提醒。当 BCC CarLeftUnlockedUpdate 可用时
 * 也会通过此模块更新（未来扩展点）。
 */

export interface UnlockReminder {
  /** 是否有活跃的未锁提醒 */
  active: boolean;
  /** 已解锁分钟数 */
  minutesSinceUnlock: number;
  /** 首次检测到未锁的时间 (ISO 8601) */
  detectedAt: string | null;
}

interface UnlockState {
  /** 首次检测到未锁的 epoch ms */
  detectedAt: number;
  /** 最近一次确认未锁的 epoch ms */
  lastSeenAt: number;
}

/** 解锁后多久开始提醒（毫秒），默认 5 分钟 */
const DEFAULT_THRESHOLD_MS = 5 * 60_000;

const state = new Map<string, UnlockState>();

/** 每次轮询后调用，更新锁状态追踪 */
export function evaluateLockState(vin: string, carLocked: boolean): void {
  const now = Date.now();

  if (carLocked) {
    // 车辆已锁 → 清除提醒状态
    state.delete(vin);
  } else {
    // 车辆未锁 → 记录或更新
    const existing = state.get(vin);
    if (existing) {
      existing.lastSeenAt = now;
    } else {
      state.set(vin, { detectedAt: now, lastSeenAt: now });
    }
  }
}

/**
 * 获取当前未锁提醒（超阈值才返回）
 * 前端在车辆已锁后会自然消失（因为 evaluateLockState 会清除状态）
 */
export function getUnlockReminder(
  vin: string,
  thresholdMs = DEFAULT_THRESHOLD_MS,
): UnlockReminder | null {
  const s = state.get(vin);
  if (!s) return null;

  const now = Date.now();
  const minutesSinceUnlock = Math.floor((now - s.detectedAt) / 60_000);

  // 未达阈值时不返回（避免短时间解锁就弹提醒）
  if (now - s.detectedAt < thresholdMs) return null;

  return {
    active: true,
    minutesSinceUnlock,
    detectedAt: new Date(s.detectedAt).toISOString(),
  };
}

/** 手动清除提醒（用户锁车后调用） */
export function clearUnlockReminder(vin: string): void {
  state.delete(vin);
}

/** 供 BCC 推送直接设置提醒（未来扩展点） */
export function setUnlockReminderFromPush(
  vin: string,
  minutesUnlocked: number,
): void {
  const now = Date.now();
  const detectedAt = now - minutesUnlocked * 60_000;
  state.set(vin, { detectedAt, lastSeenAt: now });
}
