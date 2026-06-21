import { useCallback, useEffect, useRef, useState } from "react"
import { LocateFixedIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  isAmapConfigured,
  isValidPosition,
  loadAmap,
  type AmapMapInstance,
} from "@/lib/amap"

export function AmapMap({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AmapMapInstance | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  const hasPosition = isValidPosition(latitude, longitude)
  const isConfigured = isAmapConfigured()

  useEffect(() => {
    if (!hasPosition || !isConfigured || !containerRef.current) return

    let cancelled = false
    setState("loading")

    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return
        const center: [number, number] = [longitude, latitude]
        const map = new AMap.Map(containerRef.current, {
          center,
          zoom: 16,
          viewMode: "2D",
        })
        map.add(new AMap.Marker({ position: center, title: "车辆位置" }))
        mapRef.current = map
        setState("ready")
      })
      .catch(() => {
        if (!cancelled) setState("error")
      })

    return () => {
      cancelled = true
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [hasPosition, isConfigured, latitude, longitude])

  const handleLocate = useCallback(() => {
    mapRef.current?.setCenter([longitude, latitude])
    mapRef.current?.setZoom(16)
  }, [latitude, longitude])

  if (!hasPosition) {
    return (
      <Alert>
        <AlertTitle>暂无位置信息</AlertTitle>
        <AlertDescription>车辆尚未返回有效坐标。</AlertDescription>
      </Alert>
    )
  }

  if (!isConfigured) {
    return (
      <Alert>
        <AlertTitle>尚未配置高德地图</AlertTitle>
        <AlertDescription>
          请前往“设置 &gt; 高德地图”完成配置。
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-56 overflow-hidden rounded-lg border">
        <div
          ref={containerRef}
          className="size-full"
          aria-label="车辆位置地图"
        />
        {state === "loading" && (
          <Skeleton className="absolute inset-0 size-full rounded-none" />
        )}
        {state === "ready" && (
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-2 top-2 shadow-sm"
            onClick={handleLocate}
            aria-label="回到车辆位置"
          >
            <LocateFixedIcon />
          </Button>
        )}
      </div>
      {state === "error" && (
        <Alert variant="destructive">
          <AlertTitle>高德地图加载失败</AlertTitle>
          <AlertDescription>请检查地图配置或网络连接后重试。</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
