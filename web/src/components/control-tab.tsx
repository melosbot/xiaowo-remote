import { useState } from "react"
import {
  LockIcon,
  UnlockIcon,

  WindIcon,
  PowerIcon,
  CircleStopIcon,
  ZapIcon,
  Volume2Icon,
  SirenIcon,
  PanelTopOpenIcon,
  PanelTopCloseIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DoorOpenIcon,
  DoorClosedIcon,
  AlertCircleIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ActionState = Record<string, boolean>

/** 判断某个 capability 字段是否被明确标记为不支持 */
function cap(key: string, caps: Record<string, string> | null | undefined): "yes" | "no" | "maybe" {
  if (!caps) return "yes" // 能力数据尚未加载，不阻塞操作
  const v = caps[key]
  if (v === "supported") return "yes"
  if (v === "unsupported") return "no"
  return "maybe"
}

export function ControlTab() {
  const { api, sessionId, selectedVin } = useAuth()
  const { data, refresh } = useVehicleStatus()
  const caps = data?.capabilities ?? null
  const [busy, setBusy] = useState<ActionState>({})
  const [duration, setDuration] = useState(15)
  const [pending, setPending] = useState<{
    key: string
    label: string
    fn: () => Promise<void>
    okMsg: string
  } | null>(null)

  const execute = async (key: string, fn: () => Promise<void>, okMsg: string) => {
    if (!sessionId || !selectedVin) return
    setBusy((b) => ({ ...b, [key]: true }))
    try {
      await fn()
      toast.success(okMsg)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作未完成，请稍后重试")
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
  }

  const LABELS: Record<string, string> = {
    lock: "锁车", unlock: "解锁",
    engineStart: "远程启动", engineStop: "停止远程启动",
    flash: "闪灯", honk: "鸣笛", honkFlash: "鸣笛并闪灯",
    windowOpen: "打开车窗", windowClose: "关闭车窗",
    sunroofOpen: "打开天窗", sunroofClose: "关闭天窗",
    tailgateOpen: "打开尾门", tailgateClose: "关闭尾门",
    preCleaningStart: "开始净化", preCleaningStop: "停止净化",
  }
  const request = (key: string, fn: () => Promise<void>, okMsg: string, label?: string) => {
    setPending({ key, label: label ?? LABELS[key] ?? key, fn, okMsg })
  }

  const confirm = () => {
    if (!pending) return
    if (data?.engine.running) {
      toast.error("发动机运行中，远程控制已锁定")
      setPending(null)
      return
    }
    const { key, fn, okMsg } = pending
    setPending(null)
    execute(key, fn, okMsg)
  }

  const ctrl = (action: string, body?: unknown) =>
    api.control(sessionId!, selectedVin!, action, body)


  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  const actionIcon = (key: string, Icon: LucideIcon) =>
    busy[key] ? (
      <Spinner data-icon="inline-start" />
    ) : (
      <Icon data-icon="inline-start" />
    )

  const engineActive = data.engine.running

  return (
    <>
      <div className="flex flex-col gap-4">
      {engineActive && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircleIcon className="size-4 shrink-0 text-warning" />
          发动机运行中，远程控制已锁定
        </div>
      )}
      {cap("lock", caps) !== "no" && cap("unlock", caps) !== "no" && (
        <Card>
          <CardHeader>
            <CardTitle>车锁</CardTitle>
            <CardDescription>远程锁定或解锁车辆</CardDescription>
            <CardAction>
              <Badge variant={data.carLocked ? "secondary" : "destructive"}>
                {data.carLocked ? "已锁定" : "未锁定"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.carLocked ? (
              <Button
                className="w-full"
                disabled={busy.unlock || cap("unlock", caps) === "maybe" || engineActive}
                onClick={() =>
                  request("unlock", () => ctrl("unlock"), "已发送解锁指令")
                }
              >
                {actionIcon("unlock", UnlockIcon)}
                解锁
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                disabled={busy.lock || cap("lock", caps) === "maybe" || engineActive}
                onClick={() => request("lock", () => ctrl("lock"), "已发送锁车指令")}
              >
                {actionIcon("lock", LockIcon)}
                锁车
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {cap("engineRemoteStart", caps) !== "no" && (
      <Card>
        <CardHeader>
          <CardTitle>远程启动与温控</CardTitle>
          <CardDescription>
            启动发动机并提前调节车内温度，最长 15 分钟
          </CardDescription>
          <CardAction>
            {data.engine.remoteRunning && (
              <Badge variant="default">运行中</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">运行时长</span>
            <Badge variant="secondary">{duration} 分钟</Badge>
          </div>
          <Slider
            value={[duration]}
            min={1}
            max={15}
            step={1}
            disabled={engineActive}
            onValueChange={(v) => setDuration(v[0])}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={busy.engineStart || engineActive}
              onClick={() =>
                request(
                  "engineStart",
                  () => ctrl("engine/start", { duration }),
                  "已发送远程启动指令"
                )
              }
            >
              {actionIcon("engineStart", PowerIcon)}
              远程启动
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.engineStop || engineActive}
              onClick={() =>
                request(
                  "engineStop",
                  () => ctrl("engine/stop"),
                  "已发送停止远程启动指令"
                )
              }
            >
              {actionIcon("engineStop", CircleStopIcon)}
              停止
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {cap("honk", caps) !== "no" && cap("flash", caps) !== "no" && (
      <Card>
        <CardHeader>
          <CardTitle>鸣笛与闪灯</CardTitle>
          <CardDescription>通过声音或灯光快速定位车辆</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              disabled={busy.flash || engineActive}
              onClick={() =>
                request("flash", () => ctrl("flash"), "已发送闪灯指令")
              }
            >
              {actionIcon("flash", ZapIcon)}
              闪灯
            </Button>
            <Button
              variant="outline"
              disabled={busy.honk || engineActive}
              onClick={() => request("honk", () => ctrl("honk"), "已发送鸣笛指令")}
            >
              {actionIcon("honk", Volume2Icon)}
              鸣笛
            </Button>
            <Button
              variant="outline"
              disabled={busy.honkFlash || engineActive}
              onClick={() =>
                request(
                  "honkFlash",
                  () => ctrl("honk-flash"),
                  "已发送鸣笛并闪灯指令"
                )
              }
            >
              {actionIcon("honkFlash", SirenIcon)}
              鸣笛并闪灯
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {(cap("window", caps) !== "no" ||
        cap("sunroof", caps) !== "no" ||
        cap("tailgate", caps) !== "no") && (
      <Card>
        <CardHeader>
          <CardTitle>车窗、天窗与尾门</CardTitle>
          <CardDescription>远程打开或关闭车辆开合部件</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.windowOpen || engineActive}
              onClick={() =>
                request(
                  "windowOpen",
                  () => ctrl("window/open"),
                  "已发送打开车窗指令"
                )
              }
            >
              {actionIcon("windowOpen", PanelTopOpenIcon)}
              打开车窗
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.windowClose || engineActive}
              onClick={() =>
                request(
                  "windowClose",
                  () => ctrl("window/close"),
                  "已发送关闭车窗指令"
                )
              }
            >
              {actionIcon("windowClose", PanelTopCloseIcon)}
              关闭车窗
            </Button>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.sunroofOpen || engineActive}
              onClick={() =>
                request(
                  "sunroofOpen",
                  () => ctrl("sunroof/open"),
                  "已发送打开天窗指令"
                )
              }
            >
              {actionIcon("sunroofOpen", ArrowUpIcon)}
              打开天窗
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.sunroofClose || engineActive}
              onClick={() =>
                request(
                  "sunroofClose",
                  () => ctrl("sunroof/close"),
                  "已发送关闭天窗指令"
                )
              }
            >
              {actionIcon("sunroofClose", ArrowDownIcon)}
              关闭天窗
            </Button>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.tailgateOpen || engineActive}
              onClick={() =>
                request(
                  "tailgateOpen",
                  () => ctrl("tailgate/open"),
                  "已发送打开尾门指令"
                )
              }
            >
              {actionIcon("tailgateOpen", DoorOpenIcon)}
              打开尾门
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy.tailgateClose || engineActive}
              onClick={() =>
                request(
                  "tailgateClose",
                  () => ctrl("tailgate/close"),
                  "已发送关闭尾门指令"
                )
              }
            >
              {actionIcon("tailgateClose", DoorClosedIcon)}
              关闭尾门
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {data.preCleaning.supported && cap("preCleaning", caps) !== "no" && (
        <Card>
          <CardHeader>
            <CardTitle>车内空气净化</CardTitle>
            <CardDescription>启动车内空气净化，约 5 分钟完成</CardDescription>
            <CardAction>
              {data.preCleaning.running && (
                <Badge variant="default">净化中</Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy.preCleaningStart || engineActive}
                onClick={() =>
                  request(
                    "preCleaningStart",
                    () => ctrl("pre-cleaning/start"),
                    "已发送开始净化指令"
                  )
                }
              >
                {actionIcon("preCleaningStart", WindIcon)}
                开始净化
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy.preCleaningStop || engineActive}
                onClick={() =>
                  request(
                    "preCleaningStop",
                    () => ctrl("pre-cleaning/stop"),
                    "已发送停止净化指令"
                  )
                }
              >
                {actionIcon("preCleaningStop", CircleStopIcon)}
                停止净化
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认操作</AlertDialogTitle>
            <AlertDialogDescription>
              确定要执行「{pending?.label}」吗？此操作将向车辆发送远程指令。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>确认{pending?.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
