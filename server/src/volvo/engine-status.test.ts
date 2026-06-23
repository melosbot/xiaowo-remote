import { describe, expect, it } from "vitest";
import {
  normalizeRemoteEngineStatus,
  protoTimestampToIso,
} from "./engine-status.js";

describe("remote engine status", () => {
  it("normalizes protobuf enum values", () => {
    expect(normalizeRemoteEngineStatus("Running")).toBe("Running");
    expect(normalizeRemoteEngineStatus("STARTED")).toBe("Running");
    expect(normalizeRemoteEngineStatus("Unspecifid2")).toBe("Unknown");
  });

  it("converts protobuf timestamps to ISO strings", () => {
    expect(
      protoTimestampToIso({ seconds: "1710000000", nanos: 500_000_000 }),
    ).toBe("2024-03-09T16:00:00.500Z");
    expect(protoTimestampToIso({ seconds: "0", nanos: 0 })).toBeNull();
    expect(protoTimestampToIso(null)).toBeNull();
  });
});
