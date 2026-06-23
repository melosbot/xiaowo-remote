import type {
  BoundVehicle,
  VehicleStatus,
  UserProfile,
  MembershipInfo,
  SignInStatus,
} from "../../../shared/types"

// 类型定义统一来自 shared/types.d.ts，re-export 供前端其他模块沿用 `@/lib/api` 路径
export type {
  BoundVehicle,
  VehicleStatus,
  UserProfile,
  MembershipInfo,
  SignInStatus,
}

export interface LoginResponse {
  sessionId: string
  vehicles: BoundVehicle[]
}
const STORAGE_KEY = "volvo-pwa-auth"
const CREDENTIALS_KEY = "volvo-pwa-credentials"
const STATUS_KEY_PREFIX = "volvo-pwa-status:"

export interface PersistedAuth {
  sessionId: string
  vehicles: BoundVehicle[]
  selectedVin: string
  phone: string
  savedAt: number
}

export interface PersistedCredentials {
  phone: string
  password: string
}

const PROFILE_CACHE_KEY = "volvo-pwa-profile"
const MEMBERSHIP_CACHE_KEY = "volvo-pwa-membership"
const LAST_FETCH_KEY = "volvo-pwa-last-fetch"

/** 两次强制刷新最小间隔（毫秒），防刷 */
const FETCH_COOLDOWN_MS = 5 * 60_000 // 5 分钟

export function shouldThrottleFetch(): boolean {
  try {
    const last = localStorage.getItem(LAST_FETCH_KEY)
    return last ? Date.now() - Number(last) < FETCH_COOLDOWN_MS : false
  } catch { return false }
}

export function markFetchDone(): void {
  localStorage.setItem(LAST_FETCH_KEY, String(Date.now()))
}

/** 清除刷新冷却期，登录后调用确即刻拉取 */
export function clearFetchThrottle(): void {
  localStorage.removeItem(LAST_FETCH_KEY)
}

/** 读取最后一次数据拉取时间戳 */
export function lastFetchTime(): number | null {
  try {
    const v = localStorage.getItem(LAST_FETCH_KEY)
    return v ? Number(v) : null
  } catch { return null }
}

export function loadCachedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch { return null }
}

function saveCachedProfile(p: UserProfile) {
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p))
}

export function loadCachedMembership(): MembershipInfo | null {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_CACHE_KEY)
    return raw ? (JSON.parse(raw) as MembershipInfo) : null
  } catch { return null }
}

function saveCachedMembership(m: MembershipInfo) {
  localStorage.setItem(MEMBERSHIP_CACHE_KEY, JSON.stringify(m))
}

const SIGNIN_CACHE_KEY = "volvo-pwa-signin"

export function loadCachedSignIn(): SignInStatus | null {
  try {
    const raw = localStorage.getItem(SIGNIN_CACHE_KEY)
    return raw ? (JSON.parse(raw) as SignInStatus) : null
  } catch { return null }
}

function saveCachedSignIn(s: SignInStatus) {
  localStorage.setItem(SIGNIN_CACHE_KEY, JSON.stringify(s))
}

export function loadCredentials(): PersistedCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedCredentials
    if (!parsed.phone || !parsed.password) return null
    return parsed
  } catch {
    return null
  }
}

export function saveCredentials(creds: PersistedCredentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds))
}

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY)
}

export function loadAuth(): PersistedAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedAuth
    if (!parsed.sessionId || !parsed.selectedVin) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuth(auth: PersistedAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function loadVehicleStatus(vin: string): VehicleStatus | null {
  try {
    const raw = localStorage.getItem(`${STATUS_KEY_PREFIX}${vin}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VehicleStatus
    if (parsed.vin !== vin || typeof parsed.updatedAt !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function saveVehicleStatus(status: VehicleStatus): void {
  localStorage.setItem(
    `${STATUS_KEY_PREFIX}${status.vin}`,
    JSON.stringify(status)
  )
}

export function clearVehicleStatusCache(): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(STATUS_KEY_PREFIX)) localStorage.removeItem(key)
  }
}

export class ApiError extends Error {}

/** 请求超时:略大于后端 gRPC 的 30s,避免误杀控制指令 */
const REQUEST_TIMEOUT_MS = 35_000

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("请求超时，请稍后重试")
    }
    throw new ApiError(err instanceof Error ? err.message : "网络请求失败")
  } finally {
    clearTimeout(timer)
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new ApiError(data.error ?? `服务请求失败（HTTP ${res.status}）`)
  }
  return data as unknown as T
}

export function createApi(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "")
  return {
    async login(phone: string, password: string): Promise<LoginResponse> {
      return request(`${base}/api/login`, {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      })
    },
    async logout(sessionId: string): Promise<void> {
      await request(`${base}/api/logout`, {
        method: "POST",
        body: JSON.stringify({ session: sessionId }),
      }).catch(() => {})
    },
    async validate(sessionId: string): Promise<boolean> {
      const r = await request<{ valid: boolean }>(
        `${base}/api/session/validate?session=${encodeURIComponent(sessionId)}`
      )
      return r.valid
    },
    async getStatus(sessionId: string, vin: string): Promise<VehicleStatus> {
      const r = await request<{ status: VehicleStatus }>(
        `${base}/api/vehicles/${encodeURIComponent(vin)}/status?session=${encodeURIComponent(sessionId)}`
      )
      return r.status
    },
    async control(
      sessionId: string,
      vin: string,
      action: string,
      body?: unknown
    ): Promise<void> {
      await request(
        `${base}/api/vehicles/${encodeURIComponent(vin)}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ session: sessionId, ...(body ?? {}) }),
        }
      )
    },
    async getAccount(sessionId: string): Promise<UserProfile | null> {
      const data = await request<UserProfile>(
        `${base}/api/account?session=${encodeURIComponent(sessionId)}`
      )
      if (data) saveCachedProfile(data)
      return data
    },
    async getMembership(sessionId: string): Promise<MembershipInfo> {
      const data = await request<MembershipInfo>(
        `${base}/api/membership?session=${encodeURIComponent(sessionId)}`
      )
      if (data) saveCachedMembership(data)
      return data
    },
    async getSignInStatus(
      sessionId: string,
    ): Promise<SignInStatus> {
      const data = await request<SignInStatus>(
        `${base}/api/membership/signin?session=${encodeURIComponent(sessionId)}`
      )
      if (data) saveCachedSignIn(data)
      return data
    },
    async doSignIn(sessionId: string): Promise<SignInStatus> {
      return request(`${base}/api/membership/signin`, {
        method: "POST",
        body: JSON.stringify({ session: sessionId }),
      })
    },
    async getSettings(sessionId: string): Promise<{
      amapKey: string
      amapSecurityCode: string
    }> {
      return request(
        `${base}/api/settings?session=${encodeURIComponent(sessionId)}`,
      )
    },
    async saveSettings(
      sessionId: string,
      settings: {
        amapKey?: string
        amapSecurityCode?: string
      },
    ): Promise<{
      amapKey: string
      amapSecurityCode: string
    }> {
      return request(`${base}/api/settings`, {
        method: "POST",
        body: JSON.stringify({ session: sessionId, settings }),
      })
    },
  }
}

export type VolvoApi = ReturnType<typeof createApi>
