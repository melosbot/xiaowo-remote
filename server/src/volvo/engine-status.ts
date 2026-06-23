import type { RemoteEngineStatus } from "../../../shared/types";

// 类型定义统一来自 shared/types.d.ts，re-export 保持外部 import 路径不变
export type { RemoteEngineStatus };

interface ProtoTimestamp {
  seconds?: string | number;
  nanos?: string | number;
}

export function normalizeRemoteEngineStatus(value: unknown): RemoteEngineStatus {
  switch (String(value ?? "").toLowerCase()) {
    case "off":
      return "Off";
    case "starting":
      return "Starting";
    case "running":
    case "started":
      return "Running";
    case "stopping":
      return "Stopping";
    default:
      return "Unknown";
  }
}

export function protoTimestampToIso(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const timestamp = value as ProtoTimestamp;
  const seconds = Number(timestamp.seconds);
  const nanos = Number(timestamp.nanos ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(nanos)) {
    return null;
  }

  const milliseconds = seconds * 1000 + nanos / 1_000_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
