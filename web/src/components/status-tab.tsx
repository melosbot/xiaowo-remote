import { type ReactNode } from "react"
import { ExternalLinkIcon, RefreshCwIcon, FuelIcon, AlertTriangleIcon } from "lucide-react"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { AmapMap } from "@/components/amap-map"
import { getAmapMarkerUrl, isValidPosition, openAmapApp } from "@/lib/amap"
import { cn } from "@/lib/utils"

function Stat({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  )
}

function BoolStat({
  label,
  on,
  onText = "已打开",
  offText = "已关闭",
}: {
  label: string
  on: boolean
  onText?: string
  offText?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Badge variant={on ? "destructive" : "secondary"}>
        {on ? onText : offText}
      </Badge>
    </div>
  )
}

function WarningStat({
  label,
  on,
  onText,
}: {
  label: string
  on: boolean
  onText: string
}) {
  return <BoolStat label={label} on={on} onText={onText} offText="正常" />
}

const EXTERIOR_LIGHT_LABELS: Record<string, string> = {
  brakeLightLeft: "左刹车灯",
  brakeLightCenter: "中央刹车灯",
  brakeLightRight: "右刹车灯",
  fogLightFront: "前雾灯",
  fogLightRear: "后雾灯",
  positionLightFrontLeft: "左前位置灯",
  positionLightFrontRight: "右前位置灯",
  positionLightRearLeft: "左后位置灯",
  positionLightRearRight: "右后位置灯",
  highBeamLeft: "左远光灯",
  highBeamRight: "右远光灯",
  lowBeamLeft: "左近光灯",
  lowBeamRight: "右近光灯",
  daytimeRunningLightLeft: "左日行灯",
  daytimeRunningLightRight: "右日行灯",
  turnIndicationFrontLeft: "左前转向灯",
  turnIndicationFrontRight: "右前转向灯",
  turnIndicationRearLeft: "左后转向灯",
  turnIndicationRearRight: "右后转向灯",
  registrationPlateLight: "牌照灯",
  sideMarkLights: "侧标灯",
  hazardLights: "危险警示灯",
  reverseLights: "倒车灯",
}

export function StatusTab() {
  const { data, loading, error, refresh } = useVehicleStatus()

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (error && !data) {
    return (
      <Empty className="py-12">
        <EmptyTitle>暂时无法获取车辆状态</EmptyTitle>
        <EmptyDescription>{error}</EmptyDescription>
        <Button variant="outline" onClick={refresh} className="mt-4">
          <RefreshCwIcon data-icon="inline-start" />
          重试
        </Button>
      </Empty>
    )
  }

  if (!data) return null

  const hasAirQualityMeasurement =
    data.preCleaning.sensorValid ||
    data.preCleaning.aqi > 0 ||
    data.preCleaning.pm25 > 0
  const airQualitySummary = [
    data.preCleaning.aqi > 0 ? `AQI ${data.preCleaning.aqi}` : null,
    data.preCleaning.pm25 > 0 ? `PM2.5 ${data.preCleaning.pm25} μg/m³` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const isElectric = data.vehicleInfo.carType === "electric"
  const energyUnit = isElectric ? "kWh" : "L"
  const consumptionLabel = isElectric ? "平均电耗" : "平均油耗"
  const serviceBadgeText = [
    data.health.serviceWarningMsg,
    data.health.distanceToServiceKm > 0
      ? `${data.health.distanceToServiceKm} km`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>车辆概览</CardTitle>
          <CardAction>
            <span className="text-xs text-muted-foreground">
              {data.seriesName} {data.modelName} ·{" "}
              {data.nickname || data.vin.slice(-6)}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="inline-flex items-baseline gap-1">
                <FuelIcon className="size-5 self-center text-muted-foreground" />
                <span className="text-xl font-semibold">
                  {data.fuel.amount}
                </span>
                <span className="text-sm text-muted-foreground">
                  {energyUnit}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                预计续航 {data.fuel.distanceToEmptyKm} km
              </span>
            </div>
            <Progress
              value={
                data.fuel.tankCapacity > 0
                  ? Math.min(
                      100,
                      (data.fuel.amount / data.fuel.tankCapacity) * 100
                    )
                  : 0
              }
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat
              label="累计里程"
              value={`${Math.round(data.odometerKm)} km`}
            />
            <Stat
              label={consumptionLabel}
              value={`${data.fuel.avgConsumptionL100Km.toFixed(1)} ${energyUnit}/100 km`}
            />
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                data.carLocked ? "bg-online" : "bg-destructive"
              )}
            />
            <span className="text-sm text-muted-foreground">车辆锁定</span>
            <span className="ml-auto text-sm">
              {data.carLocked ? "已锁定" : "未锁定"}
            </span>
          </div>
          {data.unlockReminder?.active && (
            <div className="flex items-center gap-2 mt-2 p-3 rounded-md border border-destructive/50 bg-destructive/5">
              <AlertTriangleIcon className="size-4 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  车辆未锁定提醒
                </p>
                <p className="text-xs text-muted-foreground">
                  已解锁 {data.unlockReminder.minutesSinceUnlock} 分钟
                  {data.unlockReminder.minutesSinceUnlock >= 30
                    ? "，建议尽快确认车辆状态"
                    : "，是否忘记锁车？"}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                data.engine.running ? "bg-online" : "bg-muted-foreground/40"
              )}
            />
            <span className="text-sm text-muted-foreground">发动机</span>
            <span className="ml-auto text-sm">
              {data.engine.running ? "运行中" : "已停止"}
            </span>
          </div>
          {data.engine.errorMsg && !data.engine.remoteRunning && (
            <p className="text-xs text-destructive">
              上次远程启动失败：{data.engine.errorMsg}
            </p>
          )}
          {data.preCleaning.supported && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">车内空气</span>
                <span className="ml-auto text-sm font-medium">
                  {hasAirQualityMeasurement ? airQualitySummary : "—"}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>驾驶统计</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              上次重置后 TM
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Stat
                label={consumptionLabel}
                value={
                  data.drivingStats.tm.avgFuelL100Km > 0
                    ? `${data.drivingStats.tm.avgFuelL100Km.toFixed(1)} ${energyUnit}/100 km`
                    : "—"
                }
              />
              <Stat
                label="平均速度"
                value={
                  data.drivingStats.tm.avgSpeedKmH > 0
                    ? `${data.drivingStats.tm.avgSpeedKmH} km/h`
                    : "—"
                }
              />
              <Stat
                label="里程"
                value={`${data.drivingStats.tm.distanceKm.toFixed(1)} km`}
              />
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              上次行程 TA
            </p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <Stat
                label={consumptionLabel}
                value={
                  data.drivingStats.ta.avgFuelL100Km > 0
                    ? `${data.drivingStats.ta.avgFuelL100Km.toFixed(1)} ${energyUnit}/100 km`
                    : "--"
                }
              />
              <Stat
                label="平均速度"
                value={
                  data.drivingStats.ta.avgSpeedKmH > 0
                    ? `${data.drivingStats.ta.avgSpeedKmH} km/h`
                    : "--"
                }
              />
              <Stat
                label="里程"
                value={`${data.drivingStats.ta.distanceKm.toFixed(1)} km`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>门窗状态</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(
            [
              {
                pos: "左前",
                door: data.doors.frontLeft,
                win: data.windows.frontLeft,
              },
              {
                pos: "右前",
                door: data.doors.frontRight,
                win: data.windows.frontRight,
              },
              {
                pos: "左后",
                door: data.doors.rearLeft,
                win: data.windows.rearLeft,
              },
              {
                pos: "右后",
                door: data.doors.rearRight,
                win: data.windows.rearRight,
              },
            ] as const
          ).map(({ pos, door, win }) => (
            <div key={pos} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{pos}</span>
              <div className="flex gap-1">
                <Badge variant={door ? "destructive" : "secondary"}>
                  {door ? "门已开" : "门已关"}
                </Badge>
                <Badge variant={win.open ? "destructive" : "secondary"}>
                  {win.open ? (win.ajar ? "窗微开" : "窗已开") : "窗已关"}
                </Badge>
              </div>
            </div>
          ))}
          <Separator />
          <BoolStat label="发动机舱盖" on={data.doors.hood} />
          <BoolStat label="尾门" on={data.doors.tailgate} />
          <BoolStat label="天窗" on={data.windows.sunroof} />
        </CardContent>
      </Card>

      {data.climatization.supported && (
        <Card>
          <CardHeader>
            <CardTitle>停车温控</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">运行状态</span>
              <Badge
                variant={data.climatization.running ? "default" : "secondary"}
              >
                {data.climatization.runningStatusMsg}
              </Badge>
            </div>
            <Stat
              label="剩余运行时间"
              value={
                data.climatization.timeRemainingMin > 0
                  ? `${data.climatization.timeRemainingMin} 分钟`
                  : "—"
              }
            />
            {data.climatization.notificationMsg && (
              <p className="text-xs text-muted-foreground">
                提示：{data.climatization.notificationMsg}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>车辆健康</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <BoolStat
            label="保养状态"
            on={data.health.serviceWarning}
            onText={serviceBadgeText}
            offText={serviceBadgeText}
          />
          <WarningStat
            label="低压电瓶"
            on={data.health.lowVoltageBatteryWarning}
            onText="电量不足"
          />
          <WarningStat
            label="制动液"
            on={data.health.brakeFluidLevelWarning}
            onText="液位过低"
          />
          <WarningStat
            label="发动机冷却液"
            on={data.health.engineCoolantLevelWarning}
            onText="液位过低"
          />
          <WarningStat
            label="机油液位"
            on={data.health.oilLevelWarning}
            onText="异常"
          />
          <WarningStat
            label="风挡清洗液"
            on={data.health.washerFluidLevelWarning}
            onText="余量不足"
          />
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {(
              [
                {
                  pos: "左前",
                  warn: data.health.tyrePressure.frontLeft,
                  kpa: data.health.tyrePressureKpa.frontLeft,
                },
                {
                  pos: "右前",
                  warn: data.health.tyrePressure.frontRight,
                  kpa: data.health.tyrePressureKpa.frontRight,
                },
                {
                  pos: "左后",
                  warn: data.health.tyrePressure.rearLeft,
                  kpa: data.health.tyrePressureKpa.rearLeft,
                },
                {
                  pos: "右后",
                  warn: data.health.tyrePressure.rearRight,
                  kpa: data.health.tyrePressureKpa.rearRight,
                },
              ] as const
            ).map(({ pos, warn, kpa }) => (
              <div key={pos} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{pos}轮胎</span>
                <span className="text-sm">
                  {kpa > 0 ? (
                    <>
                      <span
                        className={
                          warn
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        {kpa} kPa
                      </span>
                    </>
                  ) : (
                    <Badge variant={warn ? "destructive" : "secondary"}>
                      {warn ? "异常" : "正常"}
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {Object.entries(data.health.exteriorLights).some(([, v]) => v) && (
        <Card>
          <CardHeader>
            <CardTitle>外部灯光</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(data.health.exteriorLights)
                .filter(([, v]) => v)
                .map(([key]) => (
                  <WarningStat
                    key={key}
                    label={EXTERIOR_LIGHT_LABELS[key] ?? key}
                    on={true}
                    onText="故障"
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>车辆位置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AmapMap
            latitude={data.position.latitude}
            longitude={data.position.longitude}
          />
          <Stat
            label="GCJ-02 坐标（经度 / 纬度）"
            value={
              <span className="text-xs">
                {data.position.longitude}, {data.position.latitude}
              </span>
            }
          />
          {isValidPosition(data.position.latitude, data.position.longitude) && (
            <Button asChild variant="outline">
              <a
                href={getAmapMarkerUrl(
                  data.position.latitude,
                  data.position.longitude
                )}
                onClick={(event) => {
                  event.preventDefault()
                  openAmapApp(data.position.latitude, data.position.longitude)
                }}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                打开地图
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
