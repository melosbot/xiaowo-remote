/**
 * 离车告警轮询
 *
 * 每 15 分钟对所有活跃 session 的车辆调用 getExterior（1 gRPC/车），
 * 与上次快照对比，检测三类异常并推送 TG：
 *   1. 车未锁（上次锁了 → 这次没锁）
 *   2. 门未关（上次关了 → 这次开了）
 *   3. 窗未关（上次关了 → 这次开了）
 */

import type { ExteriorSnapshot } from "./vehicle.js";
import { getBotToken, sendMessage } from "./tg-notify.js";

const POLL_INTERVAL_MS = 1000 * 60 * 15; // 15 分钟

const DOOR_LABELS: Record<string, string> = {
  frontLeft: "左前门",
  frontRight: "右前门",
  rearLeft: "左后门",
  rearRight: "右后门",
  hood: "发动机舱盖",
  tailgate: "尾门",
};

const WINDOW_LABELS: Record<string, string> = {
  frontLeft: "左前窗",
  frontRight: "右前窗",
  rearLeft: "左后窗",
  rearRight: "右后窗",
  sunroof: "天窗",
};

function nick(vin: string): string {
  return vin.slice(-6);
}

/** 对比两次快照，生成告警消息列表 */
function diffSnapshots(
  prev: ExteriorSnapshot,
  curr: ExteriorSnapshot,
): string[] {
  const msgs: string[] = [];
  const label = nick(curr.vin);

  // 车锁状态变化：上次锁了 → 这次没锁
  if (prev.carLocked && !curr.carLocked) {
    msgs.push(`🔓 车辆 ${label} 已解锁`);
  }

  // 门状态变化：上次关了 → 这次开了
  for (const [key, active] of Object.entries(curr.doorsOpen)) {
    if (active && !(prev.doorsOpen as Record<string, boolean>)[key]) {
      msgs.push(`🚪 车辆 ${label} ${DOOR_LABELS[key] ?? key} 已打开`);
    }
  }

  // 窗状态变化：上次关了 → 这次开了
  for (const [key, active] of Object.entries(curr.windowsOpen)) {
    if (active && !(prev.windowsOpen as Record<string, boolean>)[key]) {
      msgs.push(`🪟 车辆 ${label} ${WINDOW_LABELS[key] ?? key} 已打开`);
    }
  }

  return msgs;
}

export interface PollingTarget {
  vin: string;
  getExterior: () => Promise<ExteriorSnapshot>;
}

export function startPolling(
  getTargets: () => PollingTarget[],
  getChatId: (vin: string) => string | null,
): NodeJS.Timeout {
  const snapshots = new Map<string, ExteriorSnapshot>();
  const token = getBotToken();
  if (!token) {
    console.log("[polling] TG_BOT_TOKEN not set, skipping alert push");
  }

  const tick = async () => {
    const targets = getTargets();
    if (targets.length === 0) return;

    console.log(`[polling] checking ${targets.length} vehicle(s)...`);

    for (const { vin, getExterior } of targets) {
      try {
        const curr = await getExterior();
        const prev = snapshots.get(vin);

        if (prev) {
          const msgs = diffSnapshots(prev, curr);
          if (msgs.length > 0 && token) {
            const chatId = getChatId(vin);
            if (chatId) {
              for (const msg of msgs) {
                await sendMessage(token, chatId, msg).catch((err) =>
                  console.error(`[polling] tg send failed for ${nick(vin)}:`, err),
                );
              }
            }
          }
        }

        snapshots.set(vin, curr);
      } catch (err) {
        console.error(
          `[polling] exterior fetch failed for ${nick(vin)}:`,
          (err as Error).message,
        );
        // 失败时保留上次快照，不覆盖
      }
    }
  };

  // 首次不立即执行，等一个间隔
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  timer.unref();
  console.log(`[polling] started, interval=${POLL_INTERVAL_MS / 60000}min`);
  return timer;
}
