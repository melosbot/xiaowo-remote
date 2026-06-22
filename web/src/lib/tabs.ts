import { GaugeIcon, LockIcon, UserRoundIcon, type LucideIcon } from "lucide-react";

export type TabKey = "control" | "status" | "me";

export interface TabDef {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

export const TABS: TabDef[] = [
  { key: "control", label: "控制", icon: LockIcon },
  { key: "status", label: "状态", icon: GaugeIcon },
  { key: "me", label: "我的", icon: UserRoundIcon },
];

export const DEFAULT_TAB: TabKey = "control";

export function parseTab(value: string | null): TabKey {
  return TABS.some((t) => t.key === value) ? (value as TabKey) : DEFAULT_TAB;
}

export const NAV_EVENT = "volvo:nav";

export function navigate(tab: TabKey): void {
  const u = new URL(window.location.href);
  u.searchParams.set("tab", tab);
  window.history.pushState(null, "", u);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function readTab(): TabKey {
  return parseTab(new URLSearchParams(window.location.search).get("tab"));
}
