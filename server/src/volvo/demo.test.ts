import { describe, expect, it } from "vitest";
import { demoEngineControl, demoStatus } from "./demo.js";

describe("demo remote engine control", () => {
  it("starts and stops with timestamps", () => {
    const vin = "DEMO_ENGINE_TEST";
    demoEngineControl(vin, true, 5);

    const running = demoStatus(vin).engine;
    expect(running.remoteStatus).toBe("Running");
    expect(running.remoteStartTime).not.toBeNull();
    expect(running.remoteEndTime).not.toBeNull();

    demoEngineControl(vin, false, 0);
    const stopped = demoStatus(vin).engine;
    expect(stopped.remoteStatus).toBe("Off");
    expect(stopped.remoteEndTime).toBeNull();
  });
});
