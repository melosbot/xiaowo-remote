export interface BoundVehicle {
  vinCode: string
  seriesName: string
  modelName: string
  modelYear: number
}

export interface LoginResponse {
  sessionId: string
  vehicles: BoundVehicle[]
}

export interface VehicleStatus {
  vin: string
  seriesName: string
  modelName: string
  modelYear: number
  nickname: string
  isAaos: boolean
  carLocked: boolean
  doors: {
    frontLeft: boolean
    frontRight: boolean
    rearLeft: boolean
    rearRight: boolean
    hood: boolean
    tailgate: boolean
    tankLid: boolean
  }
  windows: {
    frontLeft: { open: boolean; ajar: boolean }
    frontRight: { open: boolean; ajar: boolean }
    rearLeft: { open: boolean; ajar: boolean }
    rearRight: { open: boolean; ajar: boolean }
    sunroof: boolean
  }
  engine: {
    /** 发动机是否在运转（行驶中或远程启动运行中） */
    running: boolean
    /** 车辆正在被驾驶（Availability=CarInUse），此时远程控制不可用 */
    carInUse: boolean
    /** 远程启动是否在运行（EngineRunningStatus=Running） */
    remoteRunning: boolean
    remoteStatus: "Unknown" | "Off" | "Starting" | "Running" | "Stopping"
    remoteUpdateTime: string | null
    remoteStartTime: string | null
    remoteEndTime: string | null
    /** 远程启动错误类型，空字符串表示无错误 */
    errorType: string
    errorMsg: string | null
  }
  fuel: {
    amount: number
    distanceToEmptyKm: number
    avgConsumptionL100Km: number
    tankCapacity: number
  }
  odometerKm: number
  drivingStats: {
    tm: {
      distanceKm: number
      avgSpeedKmH: number
      avgFuelL100Km: number
    }
    ta: {
      distanceKm: number
      avgSpeedKmH: number
      avgFuelL100Km: number
    }
  }
  availability: {
    status: string
    unavailableReason: string
  }
  position: { latitude: number; longitude: number }
  health: {
    serviceWarning: boolean
    serviceWarningMsg: string
    brakeFluidLevelWarning: boolean
    engineCoolantLevelWarning: boolean
    oilLevelWarning: boolean
    washerFluidLevelWarning: boolean
    tyrePressure: {
      frontLeft: boolean
      frontRight: boolean
      rearLeft: boolean
      rearRight: boolean
    }
    tyrePressureKpa: {
      frontLeft: number
      frontRight: number
      rearLeft: number
      rearRight: number
    }
    lowVoltageBatteryWarning: boolean
    daysToService: number
    distanceToServiceKm: number
    engineHoursToService: number
    exteriorLights: {
      brakeLightLeft: boolean
      brakeLightCenter: boolean
      brakeLightRight: boolean
      fogLightFront: boolean
      fogLightRear: boolean
      positionLightFrontLeft: boolean
      positionLightFrontRight: boolean
      positionLightRearLeft: boolean
      positionLightRearRight: boolean
      highBeamLeft: boolean
      highBeamRight: boolean
      lowBeamLeft: boolean
      lowBeamRight: boolean
      daytimeRunningLightLeft: boolean
      daytimeRunningLightRight: boolean
      turnIndicationFrontLeft: boolean
      turnIndicationFrontRight: boolean
      turnIndicationRearLeft: boolean
      turnIndicationRearRight: boolean
      registrationPlateLight: boolean
      sideMarkLights: boolean
      hazardLights: boolean
      reverseLights: boolean
    }
  }
  climatization: {
    supported: boolean
    running: boolean
    runningStatus: string
    runningStatusMsg: string
    timeRemainingMin: number
    action: string
    notification: string
    notificationMsg: string
  }
  preCleaning: {
    supported: boolean
    running: boolean
    notif: string
    notifMsg: string
    pm25: number
    aqi: number
    sensorValid: boolean
  }
  vehicleInfo: {
    vin: string
    seriesName: string
    modelName: string
    modelYear: string
    nickname: string
    licencePlate: string
    buyDate: string
    carType: string
    outerColor: string
    innerColor: string
    engineNumber: string
    coverImageUrl: string
  }
  updatedAt: number
  failures: string[]
  capabilities: {
    lock: string
    unlock: string
    engineRemoteStart: string
    flash: string
    honk: string
    window: string
    sunroof: string
    tailgate: string
    preCleaning: string
    updateStatus: string
  } | null
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
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
    async refreshFromCar(sessionId: string, vin: string): Promise<void> {
      await request(`${base}/api/vehicles/${encodeURIComponent(vin)}/refresh`, {
        method: "POST",
        body: JSON.stringify({ session: sessionId }),
      })
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
    async getCapabilities(
      sessionId: string,
      vin: string,
    ): Promise<VehicleStatus["capabilities"]> {
      const r = await request<{ capabilities: VehicleStatus["capabilities"] }>(
        `${base}/api/vehicles/${encodeURIComponent(vin)}/capabilities?session=${encodeURIComponent(sessionId)}`
      )
      return r.capabilities
    },
    async getTgStatus(): Promise<{
      configured: boolean
      tokenHint: string
      source: "ui" | "env" | null
    }> {
      return request(`${base}/api/settings/tg/status`)
    },
    async setTgToken(
      token: string,
    ): Promise<{ ok: boolean; username?: string; verified: boolean; source: string }> {
      return request(`${base}/api/settings/tg/set-token`, {
        method: "POST",
        body: JSON.stringify({ token }),
      })
    },
    async testTgBot(
      token?: string,
    ): Promise<{ ok: boolean; username?: string }> {
      return request(`${base}/api/settings/tg/test-bot`, {
        method: "POST",
        body: JSON.stringify({ token: token ?? "" }),
      })
    },
    async testTgPush(chatId: string): Promise<void> {
      await request(`${base}/api/settings/tg/test-push`, {
        method: "POST",
        body: JSON.stringify({ chatId }),
      })
    },
    async saveTgChatId(vin: string, chatId: string): Promise<void> {
      await request(`${base}/api/settings/tg/chat-id`, {
        method: "POST",
        body: JSON.stringify({ vin, chatId }),
      })
    },
    async getSettings(sessionId: string): Promise<{
      amapKey: string
      amapSecurityCode: string
      tgChatId: string
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
        tgChatId?: string
      },
    ): Promise<{
      amapKey: string
      amapSecurityCode: string
      tgChatId: string
    }> {
      return request(`${base}/api/settings`, {
        method: "POST",
        body: JSON.stringify({ session: sessionId, settings }),
      })
    },
  }
}

export type VolvoApi = ReturnType<typeof createApi>
