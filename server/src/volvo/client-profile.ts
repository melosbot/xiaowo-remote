/**
 * 客户端身份配置
 *
 * 集中管理所有请求族使用的 App 版本、User-Agent、host、媒体类型。
 * 所有值均以 APK 5.67.0 反编译产物为证据来源。
 *
 * Header profile 分三组：
 * 1. DigitalVolvo REST（鉴权 / 账号 / 车辆绑定 / capability）
 * 2. SPA1 gRPC（状态查询 + InvocationService 控制）
 * 3. SPA1 capability REST（/voc/configurations/features）
 */

// ---------------------------------------------------------------------------
// 公共身份
// ---------------------------------------------------------------------------

/** 沃尔沃汽车 App 版本（aapt 确认） */
export const APP_VERSION = "5.67.0";

// ---------------------------------------------------------------------------
// DigitalVolvo REST
// ---------------------------------------------------------------------------

export const REST_HOST = "apigateway.digitalvolvo.com";
export const REST_BASE_URL = `https://${REST_HOST}`;

/** 基础请求头（不含 Authorization / X-Token / HMAC 签名） */
export const REST_BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Accept-Language": "zh-CN,zh-Hans;q=0.9",
  "X-Ca-Version": "1.0",
  "x-sdk-content-sha256": "UNSIGNED-PAYLOAD",
  version: APP_VERSION,
  Accept: "application/json; charset=utf-8",
};

/** User-Agent（REST 请求）：格式参考 gRPC 已确认值 */
export const REST_USER_AGENT = `vca-android/${APP_VERSION}`;

// ---------------------------------------------------------------------------
// SPA1 gRPC
// ---------------------------------------------------------------------------

export const GRPC_MAIN_HOST = "cepmobtoken.prod.c3.volvocars.com.cn:443";
export const GRPC_LBS_HOST = "cepmobtoken.lbs.prod.c3.volvocars.com.cn:443";
export const GRPC_USER_AGENT = `vca-android/${APP_VERSION} grpc-java-okhttp/1.68.0`;
export const GRPC_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Capability REST（SPA1 C3 —— /voc/configurations/features）
// ---------------------------------------------------------------------------

/**
 * Capability 端点路径。
 * APK 5.67.0 `apac_capability` 模块引用。
 * 完整 URL：{REST_BASE_URL}/voc/configurations/features
 */
export const CAPABILITY_PATH = "/voc/configurations/features";

/** 请求媒体类型（featurequery.v4） */
export const CAPABILITY_CONTENT_TYPE =
  "application/vnd.volvocar.featurequery.v4+json";

/** 响应媒体类型（featurelist.v4） */
export const CAPABILITY_ACCEPT = "application/vnd.volvocar.featurelist.v4+json";
