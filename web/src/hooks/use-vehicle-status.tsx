/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/lib/auth"
import {
  loadVehicleStatus,
  saveVehicleStatus,
  shouldThrottleFetch,
  markFetchDone,
  type VehicleStatus,
} from "@/lib/api"

interface VehicleStatusContextValue {
  data: VehicleStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<VehicleStatus | null>
}

interface VehicleStatusSnapshot {
  vin: string
  data: VehicleStatus | null
  loading: boolean
  error: string | null
}

function cachedSnapshot(vin: string | null): VehicleStatusSnapshot {
  return {
    vin: vin ?? "",
    data: vin ? loadVehicleStatus(vin) : null,
    loading: false,
    error: null,
  }
}

const VehicleStatusContext = createContext<VehicleStatusContextValue | null>(
  null
)

export function VehicleStatusProvider({ children }: { children: ReactNode }) {
  const { selectedVin } = useAuth()
  return (
    <VehicleStatusProviderForVin key={selectedVin ?? ""}>
      {children}
    </VehicleStatusProviderForVin>
  )
}

function VehicleStatusProviderForVin({ children }: { children: ReactNode }) {
  const { api, sessionId, selectedVin, status, setConnection } = useAuth()
  const active = status === "authed" && !!sessionId && !!selectedVin
  const requestKey = active ? `${sessionId}:${selectedVin}` : ""
  const currentRequestKeyRef = useRef(requestKey)
  const inFlightRef = useRef<Map<string, Promise<VehicleStatus | null>>>(new Map())
  const [snapshot, setSnapshot] = useState<VehicleStatusSnapshot>(() =>
    cachedSnapshot(selectedVin)
  )

  useEffect(() => {
    currentRequestKeyRef.current = requestKey
  }, [requestKey])

  const fetchStatus = useCallback(async () => {
    if (!sessionId || !selectedVin || !requestKey) return null

    const existingRequest = inFlightRef.current.get(requestKey)
    if (existingRequest) return existingRequest

    const request = (async () => {
      setSnapshot((previous) => ({
        vin: selectedVin,
        data:
          previous.vin === selectedVin
            ? previous.data
            : loadVehicleStatus(selectedVin),
        loading: true,
        error: previous.vin === selectedVin ? previous.error : null,
      }))
      try {
        const nextStatus = await api.getStatus(sessionId, selectedVin)
        if (currentRequestKeyRef.current !== requestKey) return null
        saveVehicleStatus(nextStatus)
        setSnapshot({
          vin: selectedVin,
          data: nextStatus,
          loading: false,
          error: null,
        })
        setConnection("online")
        return nextStatus
      } catch (err) {
        if (currentRequestKeyRef.current !== requestKey) return null
        const message = err instanceof Error ? err.message : String(err)
        setSnapshot((previous) => ({
          vin: selectedVin,
          data:
            previous.vin === selectedVin
              ? previous.data
              : loadVehicleStatus(selectedVin),
          loading: false,
          error: message,
        }))
        setConnection("offline")
        return null
      }
    })()

    inFlightRef.current.set(requestKey, request)
    try {
      return await request
    } finally {
      inFlightRef.current.delete(requestKey)
    }
  }, [api, requestKey, selectedVin, sessionId, setConnection])

  useEffect(() => {
    if (!active) return
    // 冷却期内跳过，直接读缓存（防刷页面）
    if (shouldThrottleFetch()) return
    void fetchStatus().then(() => markFetchDone())
    // 定期刷新：15±5 分钟随机
    const interval = 10 * 60_000 + Math.random() * 10 * 60_000
    const timer = setInterval(() => { void fetchStatus() }, interval)
    return () => clearInterval(timer)
  }, [active, fetchStatus])

  const currentSnapshot =
    snapshot.vin === (selectedVin ?? "")
      ? snapshot
      : cachedSnapshot(selectedVin)

  const value = useMemo<VehicleStatusContextValue>(
    () => ({
      data: currentSnapshot.data,
      loading: currentSnapshot.loading,
      error: currentSnapshot.error,
      refresh: fetchStatus,
    }),
    [
      currentSnapshot.data,
      currentSnapshot.error,
      currentSnapshot.loading,
      fetchStatus,
    ]
  )

  return (
    <VehicleStatusContext.Provider value={value}>
      {children}
    </VehicleStatusContext.Provider>
  )
}

export function useVehicleStatus(): VehicleStatusContextValue {
  const context = useContext(VehicleStatusContext)
  if (!context) {
    throw new Error(
      "useVehicleStatus must be used within VehicleStatusProvider"
    )
  }
  return context
}
