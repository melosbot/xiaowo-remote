import { VehicleBaseAPI, type BoundVehicle } from "./base.js";
import { VehicleGrpcAPI } from "./grpc.js";
import {
  getCapabilities,
  getCachedCapabilities,
  requireCapability,
  type VehicleCapabilities,
} from "./capabilities.js";
import {
  normalizeRemoteEngineStatus,
  protoTimestampToIso,
  type RemoteEngineStatus,
} from "./engine-status.js";

// ---- SPA1 油箱/电池容量表 ----
// 来源：车主手册 + 官方规格表。纯电车型（carType=electric）不在此表中，走独立默认值。

type PowertrainKind = "fuel" | "phev";

interface CapacityInfo {
  fuelLiters: number;
  batteryKwh: number | null;
  powertrainKind: PowertrainKind;
}

const spa1CapacityMap: Record<string, CapacityInfo> = {
  // XC90
  XC90_B5: { fuelLiters: 71, batteryKwh: null, powertrainKind: "fuel" },
  XC90_B6: { fuelLiters: 71, batteryKwh: null, powertrainKind: "fuel" },
  XC90_T8: { fuelLiters: 71, batteryKwh: 18.8, powertrainKind: "phev" },
  // XC60
  XC60_B5: { fuelLiters: 71, batteryKwh: null, powertrainKind: "fuel" },
  XC60_T8: { fuelLiters: 71, batteryKwh: 18.8, powertrainKind: "phev" },
  // S90 / S90L
  S90_B5:  { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  S90L_B5: { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  S90_T8:  { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  S90L_T8:{ fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  // V90 / V90CC
  V90_B5:   { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  V90_B6:   { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  V90_T6:   { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  V90_T8:   { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  V90CC_B5: { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  V90CC_B6: { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  // S60 / V60 / V60CC
  S60_B5:   { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  S60_T8:   { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  V60_B5:   { fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  V60_T6:   { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  V60_T8:   { fuelLiters: 60, batteryKwh: 18.8, powertrainKind: "phev" },
  V60CC_B5:{ fuelLiters: 60, batteryKwh: null,  powertrainKind: "fuel" },
  // Polestar 1
  POLESTAR_1: { fuelLiters: 60, batteryKwh: 34, powertrainKind: "phev" },
};

/** 从型号名中提取动力变体代号，例如 "B5 四驱智远豪华版" → "B5" */
function extractPowerVariant(modelName: string): string {
  // 匹配常见的动力代号：B3/B4/B5/B6, T4/T5/T6/T8, D4/D5, P6/P8, POLESTAR_1
  const m = modelName.match(/\b([BTDP]\d{1,2}|POLESTAR_\d)\b/i);
  return m ? m[1].toUpperCase() : "";
}

/** 将 API 返回的 seriesName 规范化为查表键 */
function normalizeSeries(seriesName: string): string {
  return seriesName.trim().toUpperCase();
}

interface ResolvedCapacity {
  fuelLiters: number;
  batteryKwh: number | null;
  powertrainKind: PowertrainKind | "electric";
  variant: string;
  key: string;
}

/** 根据车型信息查表获取油箱/电池容量 */
function getSpa1Capacity(info: {
  seriesName: string;
  modelName: string;
  carType?: unknown;
}): ResolvedCapacity {
  const carType = String((info as any).carType ?? "");
  const series = normalizeSeries(String(info.seriesName ?? ""));
  const model = String(info.modelName ?? "");

  if (carType === "electric") {
    return { fuelLiters: 78, batteryKwh: 78, powertrainKind: "electric", variant: "EV", key: `${series}_EV` };
  }

  const variant = extractPowerVariant(model);
  const sn = variant ? `${series}_${variant}` : series;

  const exact = spa1CapacityMap[sn];
  if (exact) {
    return { ...exact, variant, key: sn };
  }

  // 模糊匹配：seriesName 可能有多余后缀（如 "XC60 B5"），尝试前缀匹配
  if (variant) {
    for (const key of Object.keys(spa1CapacityMap)) {
      const [mapSeries, mapVariant] = key.split("_");
      if (mapVariant === variant && (series.startsWith(mapSeries) || mapSeries.startsWith(series))) {
        const cap = spa1CapacityMap[key];
        console.log(`[fuel] fuzzy match: api="${series}" variant="${variant}" → key="${key}"`);
        return { ...cap, variant, key };
      }
    }
  }

  // 未匹配到 → 燃油车默认 60L
  console.log(
    `[fuel] no match for series="${series}" model="${model}" variant="${variant}" → default 60L`
  );
  return {
    fuelLiters: 60,
    batteryKwh: null,
    powertrainKind: "fuel",
    variant: variant || "?",
    key: sn || "?",
  };
}

const SERVICE_WARNING_MSG: Record<string, string> = {
  SERVICE_WARNING_UNSPECIFIED: "状态未知",
  SERVICE_WARNING_NO_WARNING: "无需保养",
  SERVICE_WARNING_UNKNOWN_WARNING: "保养状态异常",
  SERVICE_WARNING_REGULAR_MAINTENANCE_ALMOST_TIME_FOR_SERVICE:
    "即将需要定期保养",
  SERVICE_WARNING_ENGINE_HOURS_ALMOST_TIME_FOR_SERVICE: "即将达到保养工时",
  SERVICE_WARNING_DISTANCE_DRIVEN_ALMOST_TIME_FOR_SERVICE: "即将达到保养里程",
  SERVICE_WARNING_REGULAR_MAINTENANCE_TIME_FOR_SERVICE: "定期保养已到期",
  SERVICE_WARNING_ENGINE_HOURS_TIME_FOR_SERVICE: "已达到保养工时",
  SERVICE_WARNING_DISTANCE_DRIVEN_TIME_FOR_SERVICE: "已达到保养里程",
  SERVICE_WARNING_REGULAR_MAINTENANCE_OVERDUE_FOR_SERVICE: "定期保养已逾期",
  SERVICE_WARNING_ENGINE_HOURS_OVERDUE_FOR_SERVICE: "保养工时已逾期",
  SERVICE_WARNING_DISTANCE_DRIVEN_OVERDUE_FOR_SERVICE: "保养里程已逾期",
};

const CLIMA_RUNNING_STATUS: Record<string, string> = {
  PARKING_CLIMATIZATION_RUNNING_STATUS_UNDEFD: "待机",
  PARKING_CLIMATIZATION_RUNNING_STATUS_IDLE: "待机",
  PARKING_CLIMATIZATION_RUNNING_STATUS_STRTATMPT: "正在启动",
  PARKING_CLIMATIZATION_RUNNING_STATUS_STRTAFTDELY: "定时启动",
  PARKING_CLIMATIZATION_RUNNING_STATUS_PRECLIMAWITHEGYFROMEXTSRCONLYACTV:
    "外部供电预热中",
  PARKING_CLIMATIZATION_RUNNING_STATUS_PRECLIMAACTV: "车内预热中",
  PARKING_CLIMATIZATION_RUNNING_STATUS_PRECLIMAANDPRECLNGACTV: "预热与净化中",
  PARKING_CLIMATIZATION_RUNNING_STATUS_PRECLNGONLYACTV: "空气净化中",
  PARKING_CLIMATIZATION_RUNNING_STATUS_HEATRESIACTV: "余热利用中",
  PARKING_CLIMATIZATION_RUNNING_STATUS_DELTMR: "已延时",
};

const CLIMA_NOTIF: Record<string, string> = {
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_UNDEFD: "",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_NOWARN: "",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_FULO: "燃油不足",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_BATTLO: "电量不足",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_NOTCNCTTOPWR: "未连接电源",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_CLIMAWITHINOKLIM: "温控进行中",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_SRVRGRD: "服务受限",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_LIMDCHRGLO: "充电电量不足",
  PARKING_CLIMATIZATION_NOTIFICATION_TYPE_TMPNOTPSBL: "暂时无法温控",
};

const PRECLEAN_NOTIF: Record<string, string> = {
  PRE_CLEANING_NOTIFICATION_TYPE_NOREQ: "未请求",
  PRE_CLEANING_NOTIFICATION_TYPE_NOWARN: "正常",
  PRE_CLEANING_NOTIFICATION_TYPE_DONE: "已完成",
  PRE_CLEANING_NOTIFICATION_TYPE_ERR: "出错",
  PRE_CLEANING_NOTIFICATION_TYPE_INTRPT: "已中断",
};

const ERS_ERROR_MSG: Record<string, string> = {
  ExceededMaxAttempt: "已达最大启动次数",
  CarUnLocked: "车辆未锁定",
  KeyInCar: "钥匙在车内",
  DoorOpen: "车门未关",
  HoodOpen: "发动机舱盖未关",
  IncorrectGear: "档位不在 P 档",
  PersonInCar: "检测到车内有人",
  PedalPressed: "踏板被踩下",
  LowFuel: "燃油不足",
  LowBattery: "电瓶电量不足",
  LowBatteryAndFuel: "燃油与电瓶电量不足",
  ChargerPlugged: "充电枪已连接",
  EngineCoolantFault: "发动机冷却液故障",
  BatteryCoolantFault: "电池冷却液故障",
  ServiceRequired: "需要保养",
  Other: "其他原因",
};

function isOpen(status: string): boolean {
  return status === "OPEN_STATUS_OPEN" || status === "OPEN_STATUS_AJAR";
}

function hasWarning(status: unknown): boolean {
  if (typeof status === "number") return status > 1;
  if (typeof status !== "string") return false;
  return !status.endsWith("_UNSPECIFIED") && !status.endsWith("_NO_WARNING");
}

/** 轮询告警用的 Exterior 快照 */
export interface ExteriorSnapshot {
  vin: string;
  carLocked: boolean;
  doorsOpen: {
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
    hood: boolean;
    tailgate: boolean;
  };
  windowsOpen: {
    frontLeft: boolean;
    frontRight: boolean;
    rearLeft: boolean;
    rearRight: boolean;
    sunroof: boolean;
  };
}

export interface VehicleStatus {
  vin: string;
  seriesName: string;
  modelName: string;
  modelYear: number;
  nickname: string;
  isAaos: boolean;
  carLocked: boolean;
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

export class VehicleController {
  private grpc: VehicleGrpcAPI;
  private info: BoundVehicle;

  constructor(
    private base: VehicleBaseAPI,
    info: BoundVehicle,
  ) {
    this.grpc = new VehicleGrpcAPI(() => base.vocapiToken);
    this.info = info;
  }

  get vin(): string {
    return this.info.vinCode;
  }

  /**
   * 是否为 AAOS 车机。
   *
   * 不再使用 modelYear 推断。当前只对接 SPA1，所有车辆均走 SPA1 协议。
   * 未来如接入 SPA2，应由 capability 或车辆绑定接口返回平台信息决定。
   */
  get isAaos(): boolean {
    // SPA1 车辆均为非 AAOS。
    // 若后续接入 SPA2，应改为读取车辆绑定信息中的 platform 字段。
    return false;
  }

  private capCache: VehicleCapabilities | null = null;

  /**
   * 获取 VIN 能力（优先从缓存，否则从远端拉取）。
   * 调用时机：session 创建时或 capability 过期时。
   */
  async fetchCapabilities(): Promise<VehicleCapabilities | null> {
    const caps = await getCapabilities(
      this.vin,
      this.base.vocapiToken,
      this.base.xtoken,
    );
    if (caps) this.capCache = caps;
    return caps;
  }

  /** 获取当前已缓存的能力（可能为空） */
  get capabilities(): VehicleCapabilities | null {
    return this.capCache ?? getCachedCapabilities(this.vin) ?? null;
  }

  async getStatus(): Promise<VehicleStatus> {
    const vin = this.vin;
    const failures: string[] = [];

    const [
      exterior,
      health,
      fuel,
      odometer,
      availability,
      location,
      engineStatus,
      prefs,
      clima,
      preClean,
    ] = await Promise.allSettled([
      this.grpc.getExterior(vin),
      this.grpc.getHealth(vin),
      this.grpc.getFuel(vin),
      this.grpc.getOdometer(vin),
      this.grpc.getAvailability(vin),
      this.grpc.getLocation(vin),
      this.grpc.getEngineStatus(vin),
      this.grpc.getPreferences(vin),
      this.grpc.getParkingClimatization(vin),
      this.grpc.getPreCleaning(vin),
    ]);

    const ext = exterior.status === "fulfilled" ? exterior.value?.data : null;
    if (exterior.status === "rejected") failures.push("exterior");
    const hlt = health.status === "fulfilled" ? health.value?.data : null;
    if (health.status === "rejected") failures.push("health");
    const ful = fuel.status === "fulfilled" ? fuel.value?.data : null;
    if (fuel.status === "rejected") failures.push("fuel");
    const odo = odometer.status === "fulfilled" ? odometer.value?.data : null;
    if (odometer.status === "rejected") failures.push("odometer");
    const avail =
      availability.status === "fulfilled" ? availability.value?.data : null;
    if (availability.status === "rejected") failures.push("availability");
    const loc = location.status === "fulfilled" ? location.value : null;
    if (location.status === "rejected") failures.push("location");
    const eng =
      engineStatus.status === "fulfilled" ? engineStatus.value?.data : null;
    if (engineStatus.status === "rejected") failures.push("engine_status");
    const prf = prefs.status === "fulfilled" ? prefs.value?.preference : null;
    if (prefs.status === "rejected") failures.push("preference");
    const clm = clima.status === "fulfilled" ? clima.value?.data : null;
    if (clima.status === "rejected") failures.push("climatization");
    const pcl = preClean.status === "fulfilled" ? preClean.value?.data : null;
    if (preClean.status === "rejected") failures.push("pre_cleaning");

    const windowField = (key: string) => {
      const s = ext ? (ext as any)[key] : "OPEN_STATUS_CLOSED";
      return {
        open: isOpen(s),
        ajar: s === "OPEN_STATUS_AJAR",
      };
    };

    const serviceWarningEnum: string =
      hlt?.service_warning ?? "SERVICE_WARNING_UNSPECIFIED";
    const serviceWarning = hlt ? hasWarning(hlt.service_warning) : false;

    const position = loc
      ? { latitude: loc.latitude, longitude: loc.longitude }
      : { latitude: 0, longitude: 0 };

    const engRunningStatus = normalizeRemoteEngineStatus(
      eng?.engineRunningStatus,
    );
    // Unspecifid1=0 表示无错误，不应展示为错误类型
    const rawErrorType: string = eng?.engineError ?? "Unspecifid1";
    const engErrorType =
      rawErrorType === "Unspecifid1" ? "" : rawErrorType;
    const carInUse =
      avail?.availableStatus === "Unavailable" &&
      avail?.unavailableReason === "CarInUse";

    return {
      vin,
      seriesName: this.info.seriesName ?? "",
      modelName: this.info.modelName ?? "",
      modelYear: Number(this.info.modelYear ?? 0),
      nickname: prf?.nickName ?? "",
      isAaos: this.isAaos,
      carLocked: ext ? ext.central_lock === "LOCK_STATUS_LOCKED" : false,
      doors: {
        frontLeft: isOpen(ext?.front_left_door ?? "OPEN_STATUS_CLOSED"),
        frontRight: isOpen(ext?.front_right_door ?? "OPEN_STATUS_CLOSED"),
        rearLeft: isOpen(ext?.rear_left_door ?? "OPEN_STATUS_CLOSED"),
        rearRight: isOpen(ext?.rear_right_door ?? "OPEN_STATUS_CLOSED"),
        hood: isOpen(ext?.hood ?? "OPEN_STATUS_CLOSED"),
        tailgate: isOpen(ext?.tailgate ?? "OPEN_STATUS_CLOSED"),
        tankLid: isOpen(ext?.tank_lid ?? "OPEN_STATUS_CLOSED"),
      },
      windows: {
        frontLeft: windowField("front_left_window"),
        frontRight: windowField("front_right_window"),
        rearLeft: windowField("rear_left_window"),
        rearRight: windowField("rear_right_window"),
        sunroof: isOpen(ext?.sunroof ?? "OPEN_STATUS_CLOSED"),
      },
      engine: {
        running:
          carInUse ||
          engRunningStatus === "Running",
        carInUse,
        remoteRunning: engRunningStatus === "Running",
        remoteStatus: engRunningStatus,
        remoteUpdateTime: protoTimestampToIso(eng?.updateTime),
        remoteStartTime: protoTimestampToIso(eng?.engineStartTime),
        remoteEndTime: protoTimestampToIso(eng?.engineEndTime),
        errorType: engErrorType,
        errorMsg: engErrorType ? ERS_ERROR_MSG[engErrorType] ?? null : null,
      },
      fuel: (() => {
        const fm = ful ? Math.round(ful.fuelAmount * 100) / 100 : 0;
        const dte = ful?.distanceToEmptyKm ?? 0;
        const avg = ful?.TMFuelAvgConsum ?? 0;
        // SPA1 gRPC 不返回油箱/电池容量，使用型号查表获取精确值。
        // 表中未覆盖的燃油车默认 60L，纯电默认 78kWh。
        const cap = getSpa1Capacity(this.info);
        const tankCapacity = cap.fuelLiters;
        console.log(
          `[fuel] amount=${fm} dte=${dte} tank=${tankCapacity} ` +
          `ratio=${tankCapacity > 0 ? Math.round((fm / tankCapacity) * 100) : 0}% ` +
          `key=${cap.key}`
        );
        return {
          amount: fm,
          distanceToEmptyKm: dte,
          avgConsumptionL100Km: avg,
          tankCapacity,
        };
      })(),
      odometerKm: odo ? Number(odo.odometerMeters) / 1000 : 0,
      drivingStats: {
        tm: {
          distanceKm: Number(odo?.tripMeterManualKm ?? 0),
          avgSpeedKmH: Number(odo?.averageSpeedKmPerHour ?? 0),
          avgFuelL100Km: Number(ful?.TMFuelAvgConsum ?? 0),
        },
        ta: {
          distanceKm: Number(odo?.tripMeterAutomaticKm ?? 0),
          avgSpeedKmH: Number(odo?.averageSpeedKmPerHourAutomatic ?? 0),
          avgFuelL100Km: Number(ful?.ATFuleAvgConsum ?? 0),
        },
      },
      availability: {
        status: avail?.availableStatus ?? "Unspecified2",
        unavailableReason: avail?.unavailableReason ?? "Unspecified1",
      },
      position,
      health: {
        serviceWarning,
        serviceWarningMsg:
          SERVICE_WARNING_MSG[serviceWarningEnum] ?? "状态未知",
        brakeFluidLevelWarning: hlt
          ? hasWarning(hlt.brake_fluid_level_warning)
          : false,
        engineCoolantLevelWarning: hlt
          ? hasWarning(hlt.engine_coolant_level_warning)
          : false,
        oilLevelWarning: hlt ? hasWarning(hlt.oil_level_warning) : false,
        washerFluidLevelWarning: hlt
          ? hasWarning(hlt.washer_fluid_level_warning)
          : false,
        tyrePressure: {
          frontLeft: hlt
            ? hasWarning(hlt.front_left_tyre_pressure_warning)
            : false,
          frontRight: hlt
            ? hasWarning(hlt.front_right_tyre_pressure_warning)
            : false,
          rearLeft: hlt
            ? hasWarning(hlt.rear_left_tyre_pressure_warning)
            : false,
          rearRight: hlt
            ? hasWarning(hlt.rear_right_tyre_pressure_warning)
            : false,
        },
        tyrePressureKpa: {
          frontLeft: hlt?.front_left_tyre_pressure_kpa ?? 0,
          frontRight: hlt?.front_right_tyre_pressure_kpa ?? 0,
          rearLeft: hlt?.rear_left_tyre_pressure_kpa ?? 0,
          rearRight: hlt?.rear_right_tyre_pressure_kpa ?? 0,
        },
        lowVoltageBatteryWarning: hlt
          ? hasWarning(hlt.low_voltage_battery_warning)
          : false,
        daysToService: hlt?.days_to_service ?? 0,
        distanceToServiceKm: hlt?.distance_to_service_km ?? 0,
        engineHoursToService: hlt?.engine_hours_to_service ?? 0,
        exteriorLights: {
          brakeLightLeft: hlt
            ? hasWarning(hlt.brake_light_left_warning)
            : false,
          brakeLightCenter: hlt
            ? hasWarning(hlt.brake_light_center_warning)
            : false,
          brakeLightRight: hlt
            ? hasWarning(hlt.brake_light_right_warning)
            : false,
          fogLightFront: hlt
            ? hasWarning(hlt.fog_light_front_warning)
            : false,
          fogLightRear: hlt
            ? hasWarning(hlt.fog_light_rear_warning)
            : false,
          positionLightFrontLeft: hlt
            ? hasWarning(hlt.position_light_front_left_warning)
            : false,
          positionLightFrontRight: hlt
            ? hasWarning(hlt.position_light_front_right_warning)
            : false,
          positionLightRearLeft: hlt
            ? hasWarning(hlt.position_light_rear_left_warning)
            : false,
          positionLightRearRight: hlt
            ? hasWarning(hlt.position_light_rear_right_warning)
            : false,
          highBeamLeft: hlt
            ? hasWarning(hlt.high_beam_left_warning)
            : false,
          highBeamRight: hlt
            ? hasWarning(hlt.high_beam_right_warning)
            : false,
          lowBeamLeft: hlt
            ? hasWarning(hlt.low_beam_left_warning)
            : false,
          lowBeamRight: hlt
            ? hasWarning(hlt.low_beam_right_warning)
            : false,
          daytimeRunningLightLeft: hlt
            ? hasWarning(hlt.daytime_running_light_left_warning)
            : false,
          daytimeRunningLightRight: hlt
            ? hasWarning(hlt.daytime_running_light_right_warning)
            : false,
          turnIndicationFrontLeft: hlt
            ? hasWarning(hlt.turn_indication_front_left_warning)
            : false,
          turnIndicationFrontRight: hlt
            ? hasWarning(hlt.turn_indication_front_right_warning)
            : false,
          turnIndicationRearLeft: hlt
            ? hasWarning(hlt.turn_indication_rear_left_warning)
            : false,
          turnIndicationRearRight: hlt
            ? hasWarning(hlt.turn_indication_rear_right_warning)
            : false,
          registrationPlateLight: hlt
            ? hasWarning(hlt.registration_plate_light_warning)
            : false,
          sideMarkLights: hlt
            ? hasWarning(hlt.side_mark_lights_warning)
            : false,
          hazardLights: hlt
            ? hasWarning(hlt.hazard_lights_warning)
            : false,
          reverseLights: hlt
            ? hasWarning(hlt.reverse_lights_warning)
            : false,
        },
      },
      climatization: (() => {
        const runningStatus: string =
          clm?.service_info?.running_status ??
          "PARKING_CLIMATIZATION_RUNNING_STATUS_UNDEFD";
        const notifType: string =
          clm?.service_notif?.notification ??
          "PARKING_CLIMATIZATION_NOTIFICATION_TYPE_UNDEFD";
        const running =
          runningStatus !== "PARKING_CLIMATIZATION_RUNNING_STATUS_UNDEFD" &&
          runningStatus !== "PARKING_CLIMATIZATION_RUNNING_STATUS_IDLE" &&
          runningStatus !== "PARKING_CLIMATIZATION_RUNNING_STATUS_DELTMR";
        const cap = this.capabilities;
        return {
          supported:
            cap?.engineRemoteStart === "supported",
          running,
          runningStatus,
          runningStatusMsg:
            CLIMA_RUNNING_STATUS[runningStatus] ?? "待机",
          timeRemainingMin: Number(clm?.service_info?.time_remaining ?? 0),
          action: String(clm?.service_info?.heating_or_cooling_action ?? ""),
          notification: notifType,
          notificationMsg: CLIMA_NOTIF[notifType] ?? "",
        };
      })(),
      preCleaning: (() => {
        const notifType: string =
          pcl?.notification ??
          "PRE_CLEANING_NOTIFICATION_TYPE_NOREQ";
        const aqi = Number(pcl?.aqi ?? 0);
        const pm25 = Number(pcl?.pm25 ?? 0);
        const measurementSeconds = Number(
          pcl?.measurement_timestamp?.seconds ?? 0,
        );
        const cap = this.capabilities;
        return {
          supported:
            cap?.preCleaning === "supported",
          running:
            notifType === "PRE_CLEANING_NOTIFICATION_TYPE_NOWARN",
          notif: notifType,
          notifMsg: PRECLEAN_NOTIF[notifType] ?? "状态未知",
          pm25,
          aqi,
          sensorValid:
            pcl != null &&
            (measurementSeconds > 0 || aqi > 0 || pm25 > 0),
        };
      })(),
      updatedAt: Date.now(),
      failures,
      capabilities: this.capabilities
        ? {
            lock: this.capabilities.lock,
            unlock: this.capabilities.unlock,
            engineRemoteStart: this.capabilities.engineRemoteStart,
            flash: this.capabilities.flash,
            honk: this.capabilities.honk,
            window: this.capabilities.window,
            sunroof: this.capabilities.sunroof,
            tailgate: this.capabilities.tailgate,
            preCleaning: this.capabilities.preCleaning,
            updateStatus: this.capabilities.updateStatus,
          }
        : null,
      vehicleInfo: {
        vin: this.info.vinCode,
        seriesName: String(this.info.seriesName ?? ""),
        modelName: String(this.info.modelName ?? ""),
        modelYear: String(this.info.modelYear ?? ""),
        nickname: prf?.nickName ?? "",
        licencePlate: String((this.info as any).licencePlate ?? ""),
        buyDate: String((this.info as any).buyDate ?? ""),
        carType: String((this.info as any).carType ?? ""),
        outerColor: String((this.info as any).outerColor ?? ""),
        innerColor: String((this.info as any).innerColor ?? ""),
        engineNumber: String((this.info as any).engineNumber ?? ""),
        coverImageUrl: String((this.info as any).coverImageUrl ?? ""),
      },
    };
  }

  /** 轻量 Exterior 快照，供轮询告警使用（不拉全量，仅 1 路 gRPC） */
  async getExteriorSnapshot(): Promise<ExteriorSnapshot> {
    const ext = await this.grpc.getExterior(this.vin);
    const data = ext?.data;
    return {
      vin: this.vin,
      carLocked: data?.central_lock === "LOCK_STATUS_LOCKED",
      doorsOpen: {
        frontLeft: isOpen(data?.front_left_door ?? "OPEN_STATUS_CLOSED"),
        frontRight: isOpen(data?.front_right_door ?? "OPEN_STATUS_CLOSED"),
        rearLeft: isOpen(data?.rear_left_door ?? "OPEN_STATUS_CLOSED"),
        rearRight: isOpen(data?.rear_right_door ?? "OPEN_STATUS_CLOSED"),
        hood: isOpen(data?.hood ?? "OPEN_STATUS_CLOSED"),
        tailgate: isOpen(data?.tailgate ?? "OPEN_STATUS_CLOSED"),
      },
      windowsOpen: {
        frontLeft: isOpen(data?.front_left_window ?? "OPEN_STATUS_CLOSED"),
        frontRight: isOpen(data?.front_right_window ?? "OPEN_STATUS_CLOSED"),
        rearLeft: isOpen(data?.rear_left_window ?? "OPEN_STATUS_CLOSED"),
        rearRight: isOpen(data?.rear_right_window ?? "OPEN_STATUS_CLOSED"),
        sunroof: isOpen(data?.sunroof ?? "OPEN_STATUS_CLOSED"),
      },
    };
  }

  // ---- 带 capability 校验的控制方法 ----

  private guard(
    key: keyof Omit<VehicleCapabilities, "source" | "fetchedAt">,
    label: string,
  ): void {
    const caps = this.capabilities;
    if (caps) requireCapability(caps, key, label);
  }

  async refreshFromCar(): Promise<void> {
    this.guard("updateStatus", "主动刷新");
    await this.grpc.updateStatus(this.vin);
  }

  lock = async () => {
    this.guard("lock", "锁车");
    return this.grpc.lock(this.vin);
  };
  unlock = async (unlockType?: "UNLOCK_UNSPECIFIED" | "TRUNK_ONLY") => {
    this.guard("unlock", "解锁");
    return this.grpc.unlock(this.vin, unlockType);
  };
  engineStart = async (duration: number) => {
    this.guard("engineRemoteStart", "远程启动");
    const requestedDuration = Number.isFinite(duration) ? duration : 15;
    const clampedDuration = Math.min(15, Math.max(1, requestedDuration));
    return this.grpc.engineControl(this.vin, true, clampedDuration);
  };
  engineStop = async () => {
    this.guard("engineRemoteStart", "远程启动");
    return this.grpc.engineControl(this.vin, false, 0);
  };
  honk = async () => {
    this.guard("honk", "鸣笛");
    return this.grpc.honkFlash(this.vin, "HONK");
  };
  flash = async () => {
    this.guard("flash", "闪灯");
    return this.grpc.honkFlash(this.vin, "FLASH");
  };
  honkAndFlash = async () => {
    this.guard("honk", "鸣笛闪灯");
    return this.grpc.honkFlash(this.vin, "HONK_AND_FLASH");
  };
  windowOpen = async () => {
    this.guard("window", "车窗控制");
    return this.grpc.windowControl(this.vin, "OPEN");
  };
  windowClose = async () => {
    this.guard("window", "车窗控制");
    return this.grpc.windowControl(this.vin, "CLOSE");
  };
  sunroofOpen = async () => {
    this.guard("sunroof", "天窗控制");
    return this.grpc.sunroofControl(this.vin, "OPEN");
  };
  sunroofClose = async () => {
    this.guard("sunroof", "天窗控制");
    return this.grpc.sunroofControl(this.vin, "CLOSE");
  };
  tailgateOpen = async () => {
    this.guard("tailgate", "尾门控制");
    return this.grpc.tailgateControl(this.vin, "OPEN");
  };
  tailgateClose = async () => {
    this.guard("tailgate", "尾门控制");
    return this.grpc.tailgateControl(this.vin, "CLOSE");
  };
  // SPA1 petrol cars provide cabin conditioning through remote engine start.
  climatizationStart = () => this.engineStart(15);
  climatizationStop = () => this.engineStop();
  preCleaningStart = async () => {
    this.guard("preCleaning", "空气净化");
    return this.grpc.preCleaningStart(this.vin);
  };
  preCleaningStop = async () => {
    this.guard("preCleaning", "空气净化");
    return this.grpc.preCleaningStop(this.vin);
  };

  close(): void {
    this.grpc.close();
  }
}
