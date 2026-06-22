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

export interface UserProfile {
  /** 姓（来自 JWT） */
  firstName: string;
  /** 名（来自 JWT） */
  lastName: string;
  /** 昵称 */
  nickName: string;
  /** 头像 URL */
  headPortrait: string;
  /** 手机号 */
  mobile: string;
  /** 会员 ID */
  memberId: string;
  /** Volvo ID */
  vocId: string;
}

export interface MembershipInfo {
  vTotalValue: number;
  vRestValue: number;
  monthValue: number;
  expireTime: string;
  levelTitle: string;
  levelNumber: number;
  levelProgress: number;
  growthValue: number;
  validGrowthValue: number;
  growthValueForUpgrade: number;
  nextLevelBeginGrowthValue: number;
  uniqueNumberCode: string;
  qrCodeUrl: string;
}

export interface SignInStatus {
  signInState: boolean;
  signInCount: number;
}

export class VolvoAPIError extends Error {}

export class VehicleBaseAPI {
  private refreshToken = "";
  private vocapiAccessToken = "";
  private digitalvolvoAccessToken = "";
  private digitalvolvoXToken = "";
  private expireAt = 0;
  private profile: UserProfile | null = null;

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

  /** 登录后获取的用户信息 */
  get userProfile(): UserProfile | null {
    return this.profile;
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

    // 从 JWT 提取姓名 + 登录响应提取账户标识
    try {
      const payload = JSON.parse(
        Buffer.from(
          String(data.globalAccessToken).split(".")[1],
          "base64url",
        ).toString("utf8"),
      );
      this.profile = {
        firstName: String(payload.firstName ?? ""),
        lastName: String(payload.lastName ?? ""),
        nickName: String(data.nickName ?? ""),
        headPortrait: String(data.headPortrait ?? ""),
        mobile: String(data.mobile ?? ""),
        memberId: String(data.memberId ?? ""),
        vocId: String(data.vocId ?? payload.sub ?? ""),
      };
    } catch {
      this.profile = null;
    }
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

  /** 获取会员信息（V值、等级、成长值） */
  async getMembershipInfo(): Promise<MembershipInfo | null> {
    const url = `${REST_BASE_URL}/app/membership/api/v2/getBasicMemberInfo`;
    const result = await this.requestDigitalvolvo("GET", url);
    const d = result?.data;
    console.log(
      `[membership] vRestValue=${d?.vRestValue} monthValue=${d?.monthValue} ` +
      `levelTitle=${d?.levelTitle} levelProgress=${d?.levelProgress}`
    );
    if (!d) return null;
    return {
      vTotalValue: Number(d.vTotalValue ?? 0),
      vRestValue: Number(d.vRestValue ?? 0),
      monthValue: Number(d.monthValue ?? 0),
      expireTime: String(d.expireTime ?? ""),
      levelTitle: String(d.levelTitle ?? ""),
      levelNumber: Number(d.levelNumber ?? 0),
      levelProgress: Number(d.levelProgress ?? 0),
      growthValue: Number(d.growthValue ?? 0),
      validGrowthValue: Number(d.validGrowthValue ?? 0),
      growthValueForUpgrade: Number(d.growthValueForUpgrade ?? 0),
      nextLevelBeginGrowthValue: Number(d.nextLevelBeginGrowthValue ?? 0),
      uniqueNumberCode: String(d.uniqueNumberCode ?? ""),
      qrCodeUrl: String(d.qrCodeUrl ?? ""),
    };
  }

  /** 获取签到状态（从任务列表判断签到任务是否已完成） */
  async getSignInStatus(memberId: string): Promise<SignInStatus | null> {
    // 从签到接口获取 signInCount
    const signUrl = `${REST_BASE_URL}/app/app/newSign/signIn`;
    const signResult = await this.requestDigitalvolvo("POST", signUrl, { memberId });
    const signCount = Number(signResult?.data?.signInCount ?? 0);

    // 从任务列表判断今日是否已签（eventCode=C_EVENT_000036）
    const taskUrl = `${REST_BASE_URL}/app/membership/api/v2/getTasksByMemberIdAndChannel?memberId=${memberId}&channel=app`;
    const taskResult = await this.requestDigitalvolvo("GET", taskUrl);
    const taskGroups = taskResult?.data ?? [];
    let todaySigned = false;
    for (const group of taskGroups) {
      for (const item of group.item ?? []) {
        if (item.eventCode === "C_EVENT_000036" && item.complete === true) {
          todaySigned = true;
        }
      }
    }

    return { signInState: todaySigned, signInCount: signCount };
  }

  /** 执行签到 */
  async doSignIn(memberId: string): Promise<SignInStatus | null> {
    // 先检查今天是否已签
    const status = await this.getSignInStatus(memberId);
    if (status?.signInState) {
      throw new Error("今日已签到，请明天再来");
    }

    // 尝试执行签到——POST /app/app/newSign/signIn 可能既是查询也是执行
    // 签到时传额外字段触发，具体格式明天未签时抓日志确认
    console.log("[sign-in] attempting sign-in for memberId:", memberId);

    // 尝试 1: 基础 memberId
    const url = `${REST_BASE_URL}/app/app/newSign/signIn`;
    let result = await this.requestDigitalvolvo("POST", url, { memberId });
    console.log("[sign-in] POST {memberId} →", JSON.stringify(result?.data).slice(0, 300));

    // 尝试 2: 加 channel
    result = await this.requestDigitalvolvo("POST", url, { memberId, channel: "app" });
    console.log("[sign-in] POST {memberId, channel} →", JSON.stringify(result?.data).slice(0, 300));

    // 尝试 3: signIn flag
    result = await this.requestDigitalvolvo("POST", url, { memberId, signIn: 1 });
    console.log("[sign-in] POST {memberId, signIn:1} →", JSON.stringify(result?.data).slice(0, 300));

    // 重新查状态
    return this.getSignInStatus(memberId);
  }
}
