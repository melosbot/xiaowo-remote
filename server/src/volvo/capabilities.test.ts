import { describe, expect, it } from "vitest";
import {
  mapResponseToCapabilities,
  getCachedCapabilities,
  requireCapability,
  CapabilityError,
} from "./capabilities.js";
import type { VehicleCapabilities } from "./capabilities.js";

// ---- mapResponseToCapabilities ----

describe("mapResponseToCapabilities", () => {
  it("完整字段映射为三态", () => {
    const raw: Record<string, unknown> = {
      door_lock: true,
      door_unlock: true,
      remote_start: false,
      honk_and_flash: true,
      window_control: "supported",
      sunroof_control: "unsupported",
      tailgate_control: "false",
      pre_cleaning: "true",
      active_refresh: true,
    };
    const caps = mapResponseToCapabilities(raw);
    expect(caps.lock).toBe("supported");
    expect(caps.unlock).toBe("supported");
    expect(caps.engineRemoteStart).toBe("unsupported");
    expect(caps.flash).toBe("supported");
    expect(caps.honk).toBe("supported");
    expect(caps.window).toBe("supported");
    expect(caps.sunroof).toBe("unsupported");
    expect(caps.tailgate).toBe("unsupported");
    expect(caps.preCleaning).toBe("supported");
    expect(caps.updateStatus).toBe("supported");
  });

  it("缺失字段退化为 unknown", () => {
    const caps = mapResponseToCapabilities({});
    expect(caps.lock).toBe("unknown");
    expect(caps.unlock).toBe("unknown");
    expect(caps.engineRemoteStart).toBe("unknown");
    expect(caps.honk).toBe("unknown");
    expect(caps.flash).toBe("unknown");
    expect(caps.window).toBe("unknown");
    expect(caps.sunroof).toBe("unknown");
    expect(caps.tailgate).toBe("unknown");
    expect(caps.preCleaning).toBe("unknown");
    expect(caps.updateStatus).toBe("unknown");
  });

  it("未知字段不影响已知字段", () => {
    const raw: Record<string, unknown> = {
      door_lock: true,
      some_future_field: "yes",
      nested: { inner: 1 },
    };
    const caps = mapResponseToCapabilities(raw);
    expect(caps.lock).toBe("supported");
    expect(caps.unlock).toBe("unknown"); // not present
  });

  it("非布尔/非 recognized 字符串值为 unknown", () => {
    const raw: Record<string, unknown> = {
      door_lock: 123,
      remote_start: "enabled",
      honk_and_flash: null,
    };
    const caps = mapResponseToCapabilities(raw);
    expect(caps.lock).toBe("unknown"); // number, not boolean
    expect(caps.engineRemoteStart).toBe("unknown"); // not true/false string
    expect(caps.honk).toBe("unknown"); // null
  });
});

// ---- requireCapability ----

describe("requireCapability", () => {
  const supportedCaps: VehicleCapabilities = {
    lock: "supported",
    unlock: "supported",
    engineRemoteStart: "unsupported",
    flash: "unknown",
    honk: "unknown",
    window: "supported",
    sunroof: "unsupported",
    tailgate: "unsupported",
    preCleaning: "unknown",
    updateStatus: "supported",
    source: "remote",
    fetchedAt: 1000,
  };

  it("supported 不抛错", () => {
    expect(() => requireCapability(supportedCaps, "lock", "锁车")).not.toThrow();
  });

  it("unsupported 抛出 CapabilityError", () => {
    expect(() => requireCapability(supportedCaps, "engineRemoteStart", "远程启动"))
      .toThrow(CapabilityError);
    expect(() => requireCapability(supportedCaps, "engineRemoteStart", "远程启动"))
      .toThrow("车辆不支持远程启动");
  });

  it("unknown 抛出 CapabilityError", () => {
    expect(() => requireCapability(supportedCaps, "flash", "闪灯"))
      .toThrow(CapabilityError);
    expect(() => requireCapability(supportedCaps, "flash", "闪灯"))
      .toThrow("暂时无法确认");
  });

  it("sunroof unsupported 抛错", () => {
    expect(() => requireCapability(supportedCaps, "sunroof", "天窗控制"))
      .toThrow("车辆不支持天窗控制");
  });
});

// ---- 缓存 ----

describe("capability cache", () => {
  it("初始缓存为空", () => {
    // Note: cache is module-level; this test relies on no prior test populating it
    // for the same VIN. Since it's an in-memory Map, it should be empty initially.
    const cached = getCachedCapabilities("test-vin-never-used-001");
    expect(cached).toBeUndefined();
  });
});
