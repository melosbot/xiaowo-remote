import { load } from "@amap/amap-jsapi-loader"

export interface AmapNamespace {
  Map: new (
    container: HTMLDivElement,
    options: { center: [number, number]; zoom: number; viewMode: "2D" }
  ) => AmapMapInstance
  Marker: new (options: {
    position: [number, number]
    title: string
  }) => unknown
}

export interface AmapMapInstance {
  add(overlay: unknown): void
  destroy(): void
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
}

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string
    }
  }
}

export interface AmapConfig {
  key: string
  securityJsCode: string
}

const STORAGE_KEY = "volvo-pwa-amap"
const envConfig: AmapConfig = {
  key: import.meta.env.VITE_AMAP_KEY?.trim() ?? "",
  securityJsCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim() ?? "",
}
let amapPromise: Promise<AmapNamespace> | null = null

export function loadAmapConfig(): AmapConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return envConfig
    const config = JSON.parse(raw) as Partial<AmapConfig>
    if (
      typeof config.key !== "string" ||
      typeof config.securityJsCode !== "string"
    ) {
      return envConfig
    }
    return {
      key: config.key.trim(),
      securityJsCode: config.securityJsCode.trim(),
    }
  } catch {
    return envConfig
  }
}

export function hasStoredAmapConfig(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function saveAmapConfig(config: AmapConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      key: config.key.trim(),
      securityJsCode: config.securityJsCode.trim(),
    })
  )
}

export function clearAmapConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAmapConfigured(): boolean {
  const config = loadAmapConfig()
  return Boolean(config.key && config.securityJsCode)
}

export function loadAmap(): Promise<AmapNamespace> {
  if (!amapPromise) {
    const config = loadAmapConfig()
    window._AMapSecurityConfig = { securityJsCode: config.securityJsCode }
    amapPromise = load({
      key: config.key,
      version: "2.0",
      plugins: [],
    }) as Promise<AmapNamespace>
  }
  return amapPromise
}

export function isValidPosition(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    (latitude !== 0 || longitude !== 0)
  )
}

export function getAmapMarkerUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    position: `${longitude},${latitude}`,
    name: "车辆位置",
    src: "volvo-pwa",
    coordinate: "gaode",
    callnative: "1",
  })
  return `https://uri.amap.com/marker?${params.toString()}`
}

function getAmapAppUrl(latitude: number, longitude: number): string | null {
  const isIos =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const scheme = isIos
    ? "iosamap"
    : /Android/i.test(navigator.userAgent)
      ? "androidamap"
      : null
  if (!scheme) return null

  const params = new URLSearchParams({
    sourceApplication: "小沃远控",
    poiname: "车辆位置",
    lat: String(latitude),
    lon: String(longitude),
    dev: "0",
  })
  return `${scheme}://viewMap?${params.toString()}`
}

export function openAmapApp(latitude: number, longitude: number): void {
  const fallbackUrl = getAmapMarkerUrl(latitude, longitude)
  const appUrl = getAmapAppUrl(latitude, longitude)
  if (!appUrl) {
    window.location.assign(fallbackUrl)
    return
  }

  let timer = 0
  const cleanup = () => {
    window.clearTimeout(timer)
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
  const handleVisibilityChange = () => {
    if (document.hidden) cleanup()
  }

  document.addEventListener("visibilitychange", handleVisibilityChange)
  timer = window.setTimeout(() => {
    cleanup()
    if (!document.hidden) window.location.assign(fallbackUrl)
  }, 1500)
  window.location.href = appUrl
}
