/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  createApi,
  loadAuth,
  saveAuth,
  clearAuth,
  clearVehicleStatusCache,
  saveCredentials,
  clearCredentials,
  type BoundVehicle,
  type PersistedAuth,
  type VolvoApi,
  type VehicleStatus,
} from "@/lib/api"

type Connection = "online" | "offline" | "connecting"

interface AuthState {
  sessionId: string | null
  vehicles: BoundVehicle[]
  selectedVin: string | null
  phone: string
  status: "loading" | "authed" | "guest"
  connection: Connection
}

interface AuthContextValue extends AuthState {
  api: VolvoApi
  login: (phone: string, password: string, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
  selectVin: (vin: string) => void
  setConnection: (c: Connection) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ""

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => createApi(API_BASE), [])
  const [state, setState] = useState<AuthState>(() => {
    const persisted = loadAuth()
    if (persisted) {
      return {
        sessionId: persisted.sessionId,
        vehicles: persisted.vehicles,
        selectedVin: persisted.selectedVin,
        phone: persisted.phone,
        status: "loading",
        connection: "connecting",
      }
    }
    return {
      sessionId: null,
      vehicles: [],
      selectedVin: null,
      phone: "",
      status: "guest",
      connection: "offline",
    }
  })

  const persist = useCallback((auth: PersistedAuth) => {
    saveAuth(auth)
  }, [])

  const login = useCallback(
    async (phone: string, password: string, remember = false) => {
      const res = await api.login(phone, password)
      const selectedVin = res.vehicles[0]?.vinCode ?? ""
      setState({
        sessionId: res.sessionId,
        vehicles: res.vehicles,
        selectedVin,
        phone,
        status: "authed",
        connection: "connecting",
      })
      persist({
        sessionId: res.sessionId,
        vehicles: res.vehicles,
        selectedVin,
        phone,
        savedAt: Date.now(),
      })
      if (remember) {
        saveCredentials({ phone, password })
      } else {
        clearCredentials()
      }
    },
    [api, persist]
  )

  const logout = useCallback(async () => {
    if (state.sessionId) await api.logout(state.sessionId)
    clearAuth()
    clearCredentials()
    clearVehicleStatusCache()
    setState({
      sessionId: null,
      vehicles: [],
      selectedVin: null,
      phone: "",
      status: "guest",
      connection: "offline",
    })
  }, [api, state.sessionId])

  const selectVin = useCallback(
    (vin: string) => {
      setState((prev) => {
        const next = {
          ...prev,
          selectedVin: vin,
          connection: "connecting" as const,
        }
        const persisted = loadAuth()
        if (persisted) persist({ ...persisted, selectedVin: vin })
        return next
      })
    },
    [persist]
  )

  const setConnection = useCallback((c: Connection) => {
    setState((prev) =>
      prev.connection === c ? prev : { ...prev, connection: c }
    )
  }, [])

  useEffect(() => {
    if (state.status !== "loading" || !state.sessionId) return
    let cancelled = false
    api.validate(state.sessionId).then((valid) => {
      if (cancelled) return
      if (valid) {
        setState((prev) => ({ ...prev, status: "authed" }))
      } else {
        clearAuth()
        clearVehicleStatusCache()
        setState({
          sessionId: null,
          vehicles: [],
          selectedVin: null,
          phone: "",
          status: "guest",
          connection: "offline",
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [api, state.status, state.sessionId])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, api, login, logout, selectVin, setConnection }),
    [state, api, login, logout, selectVin, setConnection]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export type { VehicleStatus }
