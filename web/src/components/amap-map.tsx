import { useCallback, useRef } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Map,
  MapMarker,
  MarkerContent,
  MapControls,
  type MapRef,
} from "@/components/ui/map"
import { isValidPosition, loadAmapConfig } from "@/lib/amap"

export function AmapMap({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const mapRef = useRef<MapRef>(null)
  const hasPosition = isValidPosition(latitude, longitude)
  const config = loadAmapConfig()
  const isConfigured = Boolean(config.key && config.securityJsCode)

  const handleVehicleLocate = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.setCenter([longitude, latitude])
    map.setZoom(16)
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
        <Map
          ref={mapRef}
          center={[longitude, latitude]}
          zoom={16}
          viewMode="2D"
          styles={{ light: "amap://styles/whitesmoke", dark: "amap://styles/dark" }}
          amapKey={config.key}
          securityJsCode={config.securityJsCode}
          className="size-full"
          aria-label="车辆位置地图"
        >
          <MapMarker longitude={longitude} latitude={latitude}>
            <MarkerContent />
          </MapMarker>
          <MapControls
            showZoom
            showLocate
            showScale
            position="bottom-right"
            locateFn={handleVehicleLocate}
            locateLabel="回到车辆位置"
          />
        </Map>
      </div>
    </div>
  )
}
