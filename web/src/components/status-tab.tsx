import { type ReactNode } from "react"
import {
  ExternalLinkIcon,
  RefreshCwIcon,
  WindIcon,
  FuelIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { AmapMap } from "@/components/amap-map"
import { getAmapMarkerUrl, isValidPosition, openAmapApp } from "@/lib/amap"
import { cn } from "@/lib/utils"

const FAILURE_LABELS: Record<string, string> = {
  exterior: "车身状态",
  health: "车辆健康",
  fuel: "燃油信息",
  odometer: "里程信息",
  availability: "车辆可用性",
  location: "车辆位置",
  engine_status: "发动机状态",
  preference: "车辆偏好",
  climatization: "停车温控",
  pre_cleaning: "车内净化",
}

function Stat({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
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

export function StatusTab() {
  const { data, loading, error, refresh } = useVehicleStatus()

  const handleRefresh = async () => {
    const refreshed = await refresh()
    if (refreshed) toast.success("车辆状态已刷新")
    else toast.error("暂时无法刷新车辆状态，请稍后重试")
  }

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
    data.preCleaning.notifMsg,
    data.preCleaning.aqi > 0 ? `AQI ${data.preCleaning.aqi}` : null,
    data.preCleaning.pm25 > 0 ? `PM2.5 ${data.preCleaning.pm25} μg/m³` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>车辆概览</CardTitle>
          <CardDescription>
            {data.seriesName} {data.modelName} ·{" "}
            {data.nickname || data.vin.slice(-6)}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleRefresh}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {loading ? "刷新中" : "刷新状态"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FuelIcon className="size-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">
                  {data.fuel.amount} L
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
                className="mt-2"
              />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat
              label="累计里程"
              value={`${Math.round(data.odometerKm)} km`}
            />
            <Stat
              label="平均油耗"
              value={`${data.fuel.avgConsumptionL100Km.toFixed(1)} L/100 km`}
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
          {data.preCleaning.supported && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <WindIcon className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">车内空气</span>
                <span className="ml-auto text-sm font-medium">
                  {hasAirQualityMeasurement
                    ? airQualitySummary
                    : data.preCleaning.notifMsg}
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
                label="平均油耗"
                value={
                  data.drivingStats.tm.avgFuelL100Km > 0
                    ? `${data.drivingStats.tm.avgFuelL100Km.toFixed(1)} L/100 km`
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
                label="平均油耗"
                value={
                  data.drivingStats.ta.avgFuelL100Km > 0
                    ? `${data.drivingStats.ta.avgFuelL100Km.toFixed(1)} L/100 km`
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
        <CardContent className="flex flex-col gap-2.5">
          {([
            { pos: "左前", door: data.doors.frontLeft, win: data.windows.frontLeft },
            { pos: "右前", door: data.doors.frontRight, win: data.windows.frontRight },
            { pos: "左后", door: data.doors.rearLeft, win: data.windows.rearLeft },
            { pos: "右后", door: data.doors.rearRight, win: data.windows.rearRight },
          ] as const).map(({ pos, door, win }) => (
            <div key={pos} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground w-8">{pos}</span>
              <div className="flex gap-1.5">
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
          <CardContent className="flex flex-col gap-2.5">
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
        <CardContent className="flex flex-col gap-2.5">
          <BoolStat
            label="保养状态"
            on={data.health.serviceWarning}
            onText={data.health.serviceWarningMsg}
            offText={data.health.serviceWarningMsg}
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <WarningStat
              label="左前轮胎压力"
              on={data.health.tyrePressure.frontLeft}
              onText="异常"
            />
            <WarningStat
              label="右前轮胎压力"
              on={data.health.tyrePressure.frontRight}
              onText="异常"
            />
            <WarningStat
              label="左后轮胎压力"
              on={data.health.tyrePressure.rearLeft}
              onText="异常"
            />
            <WarningStat
              label="右后轮胎压力"
              on={data.health.tyrePressure.rearRight}
              onText="异常"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>车辆位置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <AmapMap
            latitude={data.position.latitude}
            longitude={data.position.longitude}
          />
          <Stat
            label="GCJ-02 坐标（经度 / 纬度）"
            value={
              <span className="font-mono text-xs">
                {data.position.longitude}, {data.position.latitude}
              </span>
            }
          />
          {isValidPosition(data.position.latitude, data.position.longitude) && (
            <Button asChild variant="outline" size="sm">
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

      <p className="text-center text-xs text-muted-foreground">
        最后更新：
        {new Date(data.updatedAt).toLocaleTimeString("zh-CN", {
          hour12: false,
        })}
        {data.failures.length > 0 &&
          ` · 部分数据暂不可用：${data.failures
            .map((source) => FAILURE_LABELS[source] ?? "其他数据")
            .join("、")}`}
      </p>
    </div>
  )
}
