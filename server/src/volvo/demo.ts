export const DEMO_PHONE = "13800000000"
export const DEMO_PASSWORD = "demo"

export { DEMO_PHONE as demoPhone, DEMO_PASSWORD as demoPassword }

import type { BoundVehicle } from "./base.js"
import type { VehicleStatus } from "./vehicle.js"
import type { VehicleCapabilities } from "./capabilities.js"

// ---- Demo 状态演进：让每次刷新都能看到数据变化 ----

interface DemoState {
  carType: "fuel" | "electric"
  odometerKm: number
  fuelAmount: number          // 油车：L · 电车：kWh
  tankCapacity: number        // 油车：油箱容量 · 电车：电池容量
  avgConsumption: number      // 油车：L/100km · 电车：kWh/100km
  consumptionMin: number
  consumptionMax: number
  position: { lat: number; lng: number }
  pm25: number
  aqi: number
  tyrePressureKpa: { fl: number; fr: number; rl: number; rr: number }
  drivingStatsTm: { distance: number; avgSpeed: number; avgFuel: number }
  remoteStartTime: number | null
  remoteEndTime: number | null
}

const demoStates = new Map<string, DemoState>()

function ensureState(vin: string): DemoState {
  let s = demoStates.get(vin)
  if (!s) {
    const meta = DEMO_VEHICLES.find((v) => v.vinCode === vin)
    const isElectric = meta?.carType === "electric"
    if (isElectric) {
      s = {
        carType: "electric",
        odometerKm: 8650,
        fuelAmount: 78, // 满电
        tankCapacity: 78,
        avgConsumption: 18.5,
        consumptionMin: 17,
        consumptionMax: 22,
        position: { lat: 31.2304, lng: 121.4737 },
        pm25: 12,
        aqi: 45,
        tyrePressureKpa: { fl: 245, fr: 240, rl: 235, rr: 242 },
        drivingStatsTm: { distance: 156.8, avgSpeed: 38, avgFuel: 18.5 },
        remoteStartTime: null,
        remoteEndTime: null,
      }
    } else {
      s = {
        carType: "fuel",
        odometerKm: 12345,
        fuelAmount: 42.5,
        tankCapacity: 71,
        avgConsumption: 7.8,
        consumptionMin: 7.5,
        consumptionMax: 8.1,
        position: { lat: 31.2304, lng: 121.4737 },
        pm25: 12,
        aqi: 45,
        tyrePressureKpa: { fl: 240, fr: 235, rl: 230, rr: 238 },
        drivingStatsTm: { distance: 234.5, avgSpeed: 42, avgFuel: 7.8 },
        remoteStartTime: null,
        remoteEndTime: null,
      }
    }
    demoStates.set(vin, s)
  }
  return s
}

/** 在 base 基础上 ±range/2 抖动，保留两位小数 */
function jitter(base: number, range: number): number {
  const v = base + (Math.random() - 0.5) * range
  return Math.round(v * 100) / 100
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 每次调用演进一次状态，模拟"车在动" */
function evolve(state: DemoState): DemoState {
  if (state.remoteEndTime !== null && state.remoteEndTime <= Date.now()) {
    state.remoteStartTime = null
    state.remoteEndTime = null
  }
  // 里程缓慢累积 0.1~0.5 km
  const delta = 0.1 + Math.random() * 0.4
  state.odometerKm = Math.round((state.odometerKm + delta) * 10) / 10

  // 平均能耗小幅抖动（油车 L/100km · 电车 kWh/100km）
  state.avgConsumption = clamp(
    jitter(state.avgConsumption, state.carType === "electric" ? 0.6 : 0.3),
    state.consumptionMin,
    state.consumptionMax,
  )

  // 能量随里程下降（油耗/电耗）
  const consumed = (delta / 100) * state.avgConsumption
  const minReserve = state.tankCapacity * 0.07 // 保留 ~7% 最低余量
  state.fuelAmount = clamp(
    Math.round((state.fuelAmount - consumed) * 100) / 100,
    minReserve,
    state.tankCapacity,
  )

  // 位置轻微抖动 ±0.0005°
  state.position.lat = jitter(state.position.lat, 0.001)
  state.position.lng = jitter(state.position.lng, 0.001)

  // 胎压 ±2 kPa 抖动，范围 220~260
  state.tyrePressureKpa.fl = clamp(Math.round(jitter(state.tyrePressureKpa.fl, 4)), 220, 260)
  state.tyrePressureKpa.fr = clamp(Math.round(jitter(state.tyrePressureKpa.fr, 4)), 220, 260)
  state.tyrePressureKpa.rl = clamp(Math.round(jitter(state.tyrePressureKpa.rl, 4)), 220, 260)
  state.tyrePressureKpa.rr = clamp(Math.round(jitter(state.tyrePressureKpa.rr, 4)), 220, 260)

  // 车内空气 ±3 / ±8 抖动
  state.pm25 = clamp(Math.round(jitter(state.pm25, 6)), 5, 80)
  state.aqi = clamp(Math.round(jitter(state.aqi, 16)), 20, 200)

  // 驾驶统计 TM 跟随里程累加，速度/能耗抖动
  state.drivingStatsTm.distance = Math.round((state.drivingStatsTm.distance + delta) * 10) / 10
  state.drivingStatsTm.avgSpeed = clamp(Math.round(jitter(state.drivingStatsTm.avgSpeed, 4)), 30, 60)
  state.drivingStatsTm.avgFuel = state.avgConsumption

  return state
}

export const DEMO_VEHICLES: BoundVehicle[] = [
  {
    vinCode: "LVXXXXXXXXXXXXX01",
    seriesName: "XC60",
    modelName: "B5 四驱智远豪华版",
    modelYear: 2023,
    licencePlate: "沪A·12345",
    buyDate: "2023-06-15",
    carType: "fuel",
    outerColor: "水晶白",
    innerColor: "琥珀色",
    engineNumber: "B420T2-000001",
    coverImageUrl: "",
  },
  {
    vinCode: "LVXXXXXXXXXXXXX02",
    seriesName: "XC40 Recharge",
    modelName: "P8 纯电四驱智尊版",
    modelYear: 2024,
    licencePlate: "沪B·67890",
    buyDate: "2024-03-10",
    carType: "electric",
    outerColor: "峡湾蓝",
    innerColor: "暮光饰板",
    engineNumber: "EDM-000002",
    coverImageUrl: "",
  },
]

export const DEMO_CAPS: VehicleCapabilities = {
  lock: "supported",
  unlock: "supported",
  engineRemoteStart: "supported",
  flash: "supported",
  honk: "supported",
  window: "supported",
  sunroof: "supported",
  tailgate: "supported",
  preCleaning: "supported",
  updateStatus: "supported",
  source: "remote",
  fetchedAt: Date.now(),
}

export function demoEngineControl(vin: string, start: boolean, duration: number) {
  const state = ensureState(vin)
  if (!start) {
    state.remoteStartTime = null
    state.remoteEndTime = null
    return
  }

  const requestedDuration = Number.isFinite(duration) ? duration : 15
  const durationMinutes = Math.min(15, Math.max(1, requestedDuration))
  state.remoteStartTime = Date.now()
  state.remoteEndTime = state.remoteStartTime + durationMinutes * 60_000
}

export function demoStatus(vin: string): VehicleStatus {
  const s = evolve(ensureState(vin))
  const distanceToEmpty = Math.round((s.fuelAmount / s.avgConsumption) * 100)
  const meta = DEMO_VEHICLES.find((v) => v.vinCode === vin)
  const isElectric = s.carType === "electric"
  const seriesName: string = (meta?.seriesName as string) ?? "XC60"
  const modelName: string = (meta?.modelName as string) ?? "B5 四驱智远豪华版"
  const modelYear: number = (meta?.modelYear as number) ?? 2023
  const licencePlate: string = (meta?.licencePlate as string) ?? "沪A·12345"
  const buyDate: string = (meta?.buyDate as string) ?? "2023-06-15"
  const outerColor: string = (meta?.outerColor as string) ?? "水晶白"
  const innerColor: string = (meta?.innerColor as string) ?? "琥珀色"
  const engineNumber: string = (meta?.engineNumber as string) ?? "B420T2-000001"
  const nickname = isElectric ? "电沃" : "小沃"
  const remoteRunning = s.remoteEndTime !== null && s.remoteEndTime > Date.now()
  const modelYearStr = String(modelYear)
  return {
    vin,
    seriesName,
    modelName,
    modelYear,
    nickname,
    isAaos: false,
    carLocked: true,
    doors: {
      frontLeft: false, frontRight: false, rearLeft: false, rearRight: false,
      hood: false, tailgate: false, tankLid: false,
    },
    windows: {
      frontLeft: { open: false, ajar: false },
      frontRight: { open: false, ajar: false },
      rearLeft: { open: false, ajar: false },
      rearRight: { open: false, ajar: false },
      sunroof: false,
    },
    engine: {
      running: remoteRunning,
      carInUse: false,
      remoteRunning,
      remoteStatus: remoteRunning ? "Running" : "Off",
      remoteUpdateTime: new Date().toISOString(),
      remoteStartTime: s.remoteStartTime
        ? new Date(s.remoteStartTime).toISOString()
        : null,
      remoteEndTime: s.remoteEndTime
        ? new Date(s.remoteEndTime).toISOString()
        : null,
      errorType: "", errorMsg: null,
    },
    fuel: {
      amount: s.fuelAmount,
      distanceToEmptyKm: distanceToEmpty,
      avgConsumptionL100Km: s.avgConsumption,
      tankCapacity: s.tankCapacity,
    },
    odometerKm: s.odometerKm,
    drivingStats: {
      tm: {
        distanceKm: s.drivingStatsTm.distance,
        avgSpeedKmH: s.drivingStatsTm.avgSpeed,
        avgFuelL100Km: s.drivingStatsTm.avgFuel,
      },
      ta: { distanceKm: 12.3, avgSpeedKmH: 32, avgFuelL100Km: 8.5 },
    },
    availability: { status: "Available", unavailableReason: "" },
    position: { latitude: s.position.lat, longitude: s.position.lng },
    health: {
      serviceWarning: false,
      serviceWarningMsg: "无需保养",
      brakeFluidLevelWarning: false,
      engineCoolantLevelWarning: false,
      oilLevelWarning: false,
      washerFluidLevelWarning: false,
      tyrePressure: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false },
      tyrePressureKpa: {
        frontLeft: s.tyrePressureKpa.fl,
        frontRight: s.tyrePressureKpa.fr,
        rearLeft: s.tyrePressureKpa.rl,
        rearRight: s.tyrePressureKpa.rr,
      },
      lowVoltageBatteryWarning: false,
      daysToService: 180,
      distanceToServiceKm: 8500,
      engineHoursToService: 120,
      exteriorLights: {
        brakeLightLeft: false, brakeLightCenter: false, brakeLightRight: false,
        fogLightFront: false, fogLightRear: false,
        positionLightFrontLeft: false, positionLightFrontRight: false,
        positionLightRearLeft: false, positionLightRearRight: false,
        highBeamLeft: false, highBeamRight: false,
        lowBeamLeft: false, lowBeamRight: false,
        daytimeRunningLightLeft: false, daytimeRunningLightRight: false,
        turnIndicationFrontLeft: false, turnIndicationFrontRight: false,
        turnIndicationRearLeft: false, turnIndicationRearRight: false,
        registrationPlateLight: false, sideMarkLights: false,
        hazardLights: false, reverseLights: false,
      },
    },
    climatization: {
      supported: true, running: false,
      runningStatus: "PARKING_CLIMATIZATION_RUNNING_STATUS_IDLE",
      runningStatusMsg: "待机",
      timeRemainingMin: 0,
      action: "",
      notification: "",
      notificationMsg: "",
    },
    preCleaning: {
      supported: true, running: false,
      notif: "PRE_CLEANING_NOTIFICATION_TYPE_NOREQ",
      notifMsg: "未请求",
      pm25: s.pm25, aqi: s.aqi, sensorValid: true,
    },
    vehicleInfo: {
      vin,
      seriesName,
      modelName,
      modelYear: modelYearStr,
      nickname,
      licencePlate,
      buyDate,
      carType: s.carType,
      outerColor,
      innerColor,
      engineNumber,
      coverImageUrl: "",
    },
    updatedAt: Date.now(),
    failures: [],
    capabilities: {
      lock: "supported",
      unlock: "supported",
      engineRemoteStart: isElectric ? "unsupported" : "supported",
      flash: "supported",
      honk: "supported",
      window: "supported",
      sunroof: "supported",
      tailgate: "supported",
      preCleaning: "supported",
      updateStatus: "supported",
    },
  }
}
