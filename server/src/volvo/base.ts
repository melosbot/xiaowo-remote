import { signRequest } from "./signing.js";
import {
  REST_BASE_URL,
  REST_HOST,
  REST_BASE_HEADERS,
  REST_USER_AGENT,
} from "./client-profile.js";

const BASE_HEADERS: Record<string, string> = { ...REST_BASE_HEADERS };

export interface VolvoTokens {
  refreshToken: string;
  vocapiAccessToken: string;
  digitalvolvoAccessToken: string;
  digitalvolvoXToken: string;
  expireAt: number;
}

export interface BoundVehicle {
  vinCode: string;
  seriesName: string;
  modelName: string;
  modelYear: number;
  [k: string]: unknown;
}

export class VolvoAPIError extends Error {}

export class VehicleBaseAPI {
  private refreshToken = "";
  private vocapiAccessToken = "";
  private digitalvolvoAccessToken = "";
  private digitalvolvoXToken = "";
  private expireAt = 0;

  constructor(
    public username: string,
    public password: string,
  ) {}

  get vocapiToken(): string {
    return this.vocapiAccessToken;
  }

  /** REST DigitalVolvo access token（Bearer） */
  get dvAccessToken(): string {
    return this.digitalvolvoAccessToken;
  }

  /** REST X-Token（JWT） */
  get xtoken(): string {
    return this.digitalvolvoXToken;
  }

  private async requestDigitalvolvo(
    method: "GET" | "POST",
    url: string,
    body?: unknown,
  ): Promise<any> {
    const headers: Record<string, string> = { ...BASE_HEADERS };
    if (this.digitalvolvoAccessToken)
      headers["authorization"] = `Bearer ${this.digitalvolvoAccessToken}`;
    if (this.digitalvolvoXToken) headers["X-Token"] = this.digitalvolvoXToken;

    const sign = signRequest(url, method, body);
    headers["x-sdk-date"] = sign["x-sdk-date"];
    headers["v587sign"] = sign["v587sign"];
    headers["User-Agent"] = REST_USER_AGENT;

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new VolvoAPIError(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as any;
    if (!json.success)
      throw new VolvoAPIError(json.errMsg ?? "沃尔沃服务请求失败");
    return json;
  }

  async login(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (this.expireAt - now >= 60 * 10) return;

    const url = `${REST_BASE_URL}/app/iam/api/v1/auth`;
    const result = await this.requestDigitalvolvo("POST", url, {
      authType: "password",
      password: this.password,
      phoneNumber: `0086${this.username}`,
    });

    const data = result.data;
    if (!data?.globalAccessToken || !data?.accessToken) {
      throw new VolvoAPIError("登录失败，未获取到有效凭证");
    }
    this.refreshToken = data.refreshToken;
    this.vocapiAccessToken = data.globalAccessToken;
    this.digitalvolvoAccessToken = data.accessToken;
    this.digitalvolvoXToken = data.jwtToken;
    this.expireAt = now + Number(data.expiresIn);
  }

  async updateToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    if (this.expireAt - now >= 60 * 2) return;

    const url = `${REST_BASE_URL}/app/iam/api/v1/refreshToken?refreshToken=${this.refreshToken}`;
    const result = await this.requestDigitalvolvo("GET", url);
    const data = result.data;
    this.refreshToken = data.refreshToken;
    this.vocapiAccessToken = data.globalAccessToken;
    this.digitalvolvoAccessToken = data.accessToken;
    this.digitalvolvoXToken = data.jwtToken;
    this.expireAt = now + Number(data.expiresIn);
  }

  async getVehicles(): Promise<BoundVehicle[]> {
    const url = `${REST_BASE_URL}/app/account/vehicles/api/v1/owner/listBindCar`;
    const result = await this.requestDigitalvolvo("GET", url);
    return (result?.data ?? []) as BoundVehicle[];
  }
}
