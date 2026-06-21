import { describe, expect, it } from "vitest";
import { signRequest } from "./signing.js";

// 固定时间：2025-01-15T08:00:00.000Z
const FIXED_DATE = new Date("2025-01-15T08:00:00.000Z");
const TEST_KEY = "test-access-key-001";
const TEST_SECRET = "test-secret-key-001";
const TEST_HOST = "test.example.com";

describe("signRequest", () => {
  it("用固定时间和测试密钥生成确定性签名", () => {
    const result = signRequest(
      "https://test.example.com/app/iam/api/v1/auth",
      "POST",
      { phoneNumber: "0086138000000000", password: "test" },
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: TEST_HOST },
    );

    expect(result["x-sdk-date"]).toBe("20250115T080000Z");
    expect(result.v587sign).toContain("SDK-HMAC-SHA256");
    expect(result.v587sign).toContain(`Access=${TEST_KEY}`);
    expect(result.v587sign).toContain("SignedHeaders=host;x-sdk-content-sha256;x-sdk-date");
    expect(result.v587sign).toContain("Signature=");
  });

  it("同一输入产生相同签名", () => {
    const a = signRequest(
      "https://test.example.com/api/test",
      "GET",
      "",
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: TEST_HOST },
    );
    const b = signRequest(
      "https://test.example.com/api/test",
      "GET",
      "",
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: TEST_HOST },
    );
    expect(a.v587sign).toBe(b.v587sign);
    expect(a["x-sdk-date"]).toBe(b["x-sdk-date"]);
  });

  it("不同时间产生不同签名", () => {
    const a = signRequest(
      "https://test.example.com/api/test",
      "GET",
      "",
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: TEST_HOST },
    );
    const b = signRequest(
      "https://test.example.com/api/test",
      "GET",
      "",
      {
        date: new Date("2025-01-15T08:00:01.000Z"),
        accessKey: TEST_KEY,
        secretKey: TEST_SECRET,
        host: TEST_HOST,
      },
    );
    expect(a.v587sign).not.toBe(b.v587sign);
  });

  it("不同 host 产生不同签名", () => {
    const a = signRequest(
      "https://host-a.example.com/api/test",
      "POST",
      { a: 1 },
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: "host-a.example.com" },
    );
    const b = signRequest(
      "https://host-b.example.com/api/test",
      "POST",
      { a: 1 },
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: "host-b.example.com" },
    );
    expect(a.v587sign).not.toBe(b.v587sign);
  });

  it("不传 opts 时使用内置凭据和当前时间", () => {
    const result = signRequest(
      "https://apigateway.digitalvolvo.com/app/iam/api/v1/auth",
      "POST",
      { test: true },
    );
    expect(result["x-sdk-date"]).toMatch(/^\d{8}T\d{6}Z$/);
    expect(result.v587sign).toContain("SDK-HMAC-SHA256");
    expect(result.v587sign).toContain("Signature=");
  });

  it("签名 Header 集合为 host, x-sdk-content-sha256, x-sdk-date", () => {
    const result = signRequest(
      "https://test.example.com/foo",
      "GET",
      "",
      { date: FIXED_DATE, accessKey: TEST_KEY, secretKey: TEST_SECRET, host: TEST_HOST },
    );
    // 验证 SignedHeaders 为三个字段，按字母排序
    expect(result.v587sign).toContain(
      "SignedHeaders=host;x-sdk-content-sha256;x-sdk-date",
    );
  });
});
