/**
 * 前后端共享类型（以后端为数据源头）。
 *
 * 纯类型 declaration 文件：不参与 emit、不受 tsconfig 的 rootDir 限制，
 * 两端通过相对路径 `import type` 引用，无需配置 paths/alias：
 *   - server/src/volvo/*.ts → ../../../shared/types
 *   - web/src/lib/*.ts     → ../../../shared/types
 */

// ---------------------------------------------------------------------------
// 车辆绑定（REST listBindCar 返回项）
// ---------------------------------------------------------------------------

export interface BoundVehicle {
  vinCode: string;
  seriesName: string;
  modelName: string;
  modelYear: number;
  /** REST 返回可能携带更多字段（licencePlate/carType 等），统一放开 */
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// 车门未锁提醒（内存状态机产出）
// ---------------------------------------------------------------------------

export interface UnlockReminder {
  /** 是否有活跃的未锁提醒 */
  active: boolean;
  /** 已解锁分钟数 */
  minutesSinceUnlock: number;
  /** 首次检测到未锁的时间 (ISO 8601) */
  detectedAt: string | null;
}

// ---------------------------------------------------------------------------
// 远程启动状态
// ---------------------------------------------------------------------------

export type RemoteEngineStatus =
  | "Unknown"
  | "Off"
  | "Starting"
  | "Running"
  | "Stopping";

// ---------------------------------------------------------------------------
// 能力（capability）模型
// ---------------------------------------------------------------------------

/** 三态能力值 */
export type CapabilityState = "supported" | "unsupported" | "unknown";

/** 能力数据来源 */
export type CapabilitySource = "remote" | "cache" | "fallback";

/** 车辆远程控制能力 */
export interface VehicleCapabilities {
  lock: CapabilityState;
  unlock: CapabilityState;
  engineRemoteStart: CapabilityState;
  flash: CapabilityState;
  honk: CapabilityState;
  window: CapabilityState;
  sunroof: CapabilityState;
  tailgate: CapabilityState;
  preCleaning: CapabilityState;
  updateStatus: CapabilityState;
  /** 数据来源 */
  source: CapabilitySource;
  /** Unix 毫秒，从远端或缓存获取时刻 */
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// 车辆状态（聚合 gRPC 各 service + capability + REST 信息）
// ---------------------------------------------------------------------------

export interface VehicleStatus {
  vin: string;
  seriesName: string;
  modelName: string;
  modelYear: number;
  nickname: string;
  isAaos: boolean;
  carLocked: boolean;
  /** 车门未锁提醒（超阈值后出现） */
  unlockReminder: UnlockReminder | null;
  doors: {
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
    hood: boolean;
    tailgate: boolean;
    tankLid: boolean;
  };
  windows: {
    frontLeft: { open: boolean; ajar: boolean };
    frontRight: { open: boolean; ajar: boolean };
    rearLeft: { open: boolean; ajar: boolean };
    rearRight: { open: boolean; ajar: boolean };
    sunroof: boolean;
  };
  engine: {
    /** 发动机是否在运转（行驶中或远程启动运行中） */
    running: boolean;
    /** 车辆正在被驾驶（Availability=CarInUse），此时远程控制不可用 */
    carInUse: boolean;
    /** 远程启动是否在运行（EngineRunningStatus=Running） */
    remoteRunning: boolean;
    remoteStatus: RemoteEngineStatus;
    remoteUpdateTime: string | null;
    remoteStartTime: string | null;
    remoteEndTime: string | null;
    /** 远程启动错误类型，空字符串表示无错误 */
    errorType: string;
    errorMsg: string | null;
  };
  fuel: {
    amount: number;
    distanceToEmptyKm: number;
    avgConsumptionL100Km: number;
    tankCapacity: number;
  };
  odometerKm: number;
  drivingStats: {
    tm: {
      distanceKm: number;
      avgSpeedKmH: number;
      avgFuelL100Km: number;
    };
    ta: {
      distanceKm: number;
      avgSpeedKmH: number;
      avgFuelL100Km: number;
    };
  };
  availability: {
    status: string;
    unavailableReason: string;
  };
  position: { latitude: number; longitude: number };
  health: {
    serviceWarning: boolean;
    serviceWarningMsg: string;
    brakeFluidLevelWarning: boolean;
    engineCoolantLevelWarning: boolean;
    oilLevelWarning: boolean;
    washerFluidLevelWarning: boolean;
    tyrePressure: {
      frontLeft: boolean;
      frontRight: boolean;
      rearLeft: boolean;
      rearRight: boolean;
    };
    tyrePressureKpa: {
      frontLeft: number;
      frontRight: number;
      rearLeft: number;
      rearRight: number;
    };
    lowVoltageBatteryWarning: boolean;
    daysToService: number;
    distanceToServiceKm: number;
    engineHoursToService: number;
    exteriorLights: {
      brakeLightLeft: boolean;
      brakeLightCenter: boolean;
      brakeLightRight: boolean;
      fogLightFront: boolean;
      fogLightRear: boolean;
      positionLightFrontLeft: boolean;
      positionLightFrontRight: boolean;
      positionLightRearLeft: boolean;
      positionLightRearRight: boolean;
      highBeamLeft: boolean;
      highBeamRight: boolean;
      lowBeamLeft: boolean;
      lowBeamRight: boolean;
      daytimeRunningLightLeft: boolean;
      daytimeRunningLightRight: boolean;
      turnIndicationFrontLeft: boolean;
      turnIndicationFrontRight: boolean;
      turnIndicationRearLeft: boolean;
      turnIndicationRearRight: boolean;
      registrationPlateLight: boolean;
      sideMarkLights: boolean;
      hazardLights: boolean;
      reverseLights: boolean;
    };
  };
  climatization: {
    supported: boolean;
    running: boolean;
    runningStatus: string;
    runningStatusMsg: string;
    timeRemainingMin: number;
    action: string;
    notification: string;
    notificationMsg: string;
  };
  preCleaning: {
    supported: boolean;
    running: boolean;
    notif: string;
    notifMsg: string;
    pm25: number;
    aqi: number;
    sensorValid: boolean;
  };
  vehicleInfo: {
    vin: string;
    seriesName: string;
    modelName: string;
    modelYear: string;
    nickname: string;
    licencePlate: string;
    buyDate: string;
    carType: string;
    outerColor: string;
    innerColor: string;
    engineNumber: string;
    coverImageUrl: string;
  };
  updatedAt: number;
  failures: string[];
  capabilities: {
    lock: string;
    unlock: string;
    engineRemoteStart: string;
    flash: string;
    honk: string;
    window: string;
    sunroof: string;
    tailgate: string;
    preCleaning: string;
    updateStatus: string;
  } | null;
}

// ---------------------------------------------------------------------------
// 账户 / 会员 / 签到
// ---------------------------------------------------------------------------

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
