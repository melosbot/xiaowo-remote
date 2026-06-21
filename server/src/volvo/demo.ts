export const DEMO_PHONE = "13800000000"
export const DEMO_PASSWORD = "demo"

export { DEMO_PHONE as demoPhone, DEMO_PASSWORD as demoPassword }

import type { BoundVehicle } from "./base.js"
import type { VehicleStatus } from "./vehicle.js"
import type { VehicleCapabilities } from "./capabilities.js"

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

export function demoStatus(vin: string): VehicleStatus {
  return {
    vin,
    seriesName: "XC60",
    modelName: "B5 四驱智远豪华版",
    modelYear: 2023,
    nickname: "小沃",
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
      running: false, remoteRunning: false,
      remoteStartTime: null, remoteEndTime: null,
      errorType: "Unspecifid1", errorMsg: null,
    },
    fuel: { amount: 42.5, distanceToEmptyKm: 512, avgConsumptionL100Km: 7.8, tankCapacity: 71 },
    odometerKm: 12345,
    drivingStats: {
      tm: { distanceKm: 234.5, avgSpeedKmH: 42, avgFuelL100Km: 7.8 },
      ta: { distanceKm: 12.3, avgSpeedKmH: 32, avgFuelL100Km: 8.5 },
    },
    availability: { status: "Available", unavailableReason: "" },
    position: { latitude: 31.2304, longitude: 121.4737 },
    health: {
      serviceWarning: false,
      serviceWarningMsg: "无需保养",
      brakeFluidLevelWarning: false,
      engineCoolantLevelWarning: false,
      oilLevelWarning: false,
      washerFluidLevelWarning: false,
      tyrePressure: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false },
      tyrePressureKpa: { frontLeft: 240, frontRight: 235, rearLeft: 230, rearRight: 238 },
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
      pm25: 12, aqi: 45, sensorValid: true,
    },
    vehicleInfo: {
      vin,
      seriesName: "XC60",
      modelName: "B5 四驱智远豪华版",
      modelYear: "2023",
      nickname: "小沃",
      licencePlate: "沪A·12345",
      buyDate: "2023-06-15",
      carType: "fuel",
      outerColor: "水晶白",
      innerColor: "琥珀色",
      engineNumber: "B420T2-000001",
      coverImageUrl: "",
    },
    updatedAt: Date.now(),
    failures: [],
    capabilities: {
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
    },
  }
}
