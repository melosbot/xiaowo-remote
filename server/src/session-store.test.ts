import { test, expect } from "vitest";
import { encryptPassword, decryptPassword } from "./session-store.js";

test("密码加解密往返", () => {
  const plain = "test-fixture-pw-9X2";
  const enc = encryptPassword(plain);
  expect(enc).not.toBe(plain);
  expect(enc.startsWith("enc:")).toBe(true);
  expect(decryptPassword(enc)).toBe(plain);
});

test("每次加密产生不同密文(随机 IV)", () => {
  const plain = "same-password";
  expect(encryptPassword(plain)).not.toBe(encryptPassword(plain));
});

test("旧版明文向后兼容(无 enc: 前缀原样返回)", () => {
  expect(decryptPassword("plain-password-legacy")).toBe("plain-password-legacy");
});

test("密文被篡改时解密抛错(GCM 完整性校验)", () => {
  const enc = encryptPassword("secret");
  const tampered = enc.slice(0, -2) + "AA";
  expect(() => decryptPassword(tampered)).toThrow();
});
