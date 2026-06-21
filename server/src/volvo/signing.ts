import crypto from "node:crypto";
import { REST_HOST } from "./client-profile.js";

const ACCESS_KEY = "204114990";
const SECRET_KEY = "bjGqb3TvEEZ8W8QhoyhEH4IenwCnc4JQ";

function encodeURIComponentSafe(s: string): string {
  return encodeURIComponent(s);
}

function hexEncodeSha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: string, msg: string): string {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest("hex");
}

function generateDateStamp(): string {
  return new Date()
    .toISOString()
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export interface SignOptions {
  /** 固定时间戳（用于确定性测试），不传则使用当前时间 */
  date?: Date;
  /** 测试用 Access Key，不传则使用内置凭据 */
  accessKey?: string;
  /** 测试用 Secret Key，不传则使用内置凭据 */
  secretKey?: string;
  /** 签名使用的 host，不传则使用生产 host */
  host?: string;
}

interface SignHeaders {
  "x-sdk-date": string;
  v587sign: string;
}

export function signRequest(
  url: string,
  method: string,
  body: unknown,
  opts?: SignOptions,
): SignHeaders {
  const accessKey = opts?.accessKey ?? ACCESS_KEY;
  const secretKey = opts?.secretKey ?? SECRET_KEY;
  const host = opts?.host ?? REST_HOST;
  const parsed = new URL(url);

  const headers: Record<string, string> = {
    "x-sdk-content-sha256": "UNSIGNED-PAYLOAD",
    host,
  };

  const dateStamp = opts?.date
    ? opts.date
        .toISOString()
        .replace(/-/g, "")
        .replace(/:/g, "")
        .replace(/\.\d{3}Z$/, "Z")
    : generateDateStamp();

  headers["x-sdk-date"] = dateStamp;
  const date = headers["x-sdk-date"];

  const effectiveBody = ["PUT", "PATCH", "POST"].includes(method) ? body : "";

  let canonicalUri = parsed.pathname
    .split("/")
    .map((p) => encodeURIComponentSafe(p))
    .join("/");
  if (!canonicalUri.endsWith("/")) canonicalUri += "/";

  const queryPairs: [string, string][] = [];
  parsed.searchParams.forEach((v, k) => queryPairs.push([k, v]));
  queryPairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQueryString = queryPairs
    .map(([k, v]) => `${encodeURIComponentSafe(k)}=${encodeURIComponentSafe(v)}`)
    .join("&");

  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  let canonicalHeaders = signedHeaders
    .map((k) => `${k}:${headers[k].trim()}`)
    .join("\n");
  canonicalHeaders += "\n";

  const payloadHash = headers["x-sdk-content-sha256"];

  const canonicalReq = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const stringToSign = `SDK-HMAC-SHA256\n${date}\n${hexEncodeSha256(canonicalReq)}`;
  const signature = hmacSha256(secretKey, stringToSign);
  const authHeader = `SDK-HMAC-SHA256 Access=${accessKey}, SignedHeaders=${signedHeaders.join(
    ";",
  )}, Signature=${signature}`;

  return { "x-sdk-date": date, v587sign: authHeader };
}
