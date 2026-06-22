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
  loadCachedProfile,
  loadCachedMembership,
  loadCachedSignIn,
  type MembershipInfo,
  type SignInStatus,
  type UserProfile,
} from "@/lib/api"

interface AccountSnapshot {
  account: UserProfile | null
  membership: MembershipInfo | null
  signin: SignInStatus | null
  loading: boolean
  error: string | null
}

interface AccountContextValue {
  account: UserProfile | null
  membership: MembershipInfo | null
  signin: SignInStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  signIn: () => Promise<SignInStatus>
  signingIn: boolean
}

function cachedSnapshot(): AccountSnapshot {
  return {
    account: loadCachedProfile(),
    membership: loadCachedMembership(),
    signin: loadCachedSignIn(),
    loading: false,
    error: null,
  }
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const { api, sessionId, status } = useAuth()
  const active = status === "authed" && !!sessionId
  const requestKeyRef = useRef("")
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(cachedSnapshot)
  const [signingIn, setSigningIn] = useState(false)

  const fetchAccount = useCallback(async () => {
    if (!sessionId) return
    setSnapshot((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [accountRes, membershipRes, signinRes] = await Promise.allSettled([
        api.getAccount(sessionId),
        api.getMembership(sessionId),
        api.getSignInStatus(sessionId),
      ])
      const account =
        accountRes.status === "fulfilled" ? accountRes.value : null
      const membership =
        membershipRes.status === "fulfilled" ? membershipRes.value : null
      const signin =
        signinRes.status === "fulfilled" ? signinRes.value : null
      const failedCount = [accountRes, membershipRes, signinRes].filter(
        (r) => r.status === "rejected",
      ).length
      setSnapshot({
        account,
        membership,
        signin,
        loading: false,
        error:
          failedCount === 3
            ? "账户信息加载失败，请下拉刷新重试"
            : null,
      })
    } catch (err) {
      setSnapshot((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "账户信息加载失败",
      }))
    }
  }, [api, sessionId])

  const refresh = useCallback(async () => {
    await fetchAccount()
  }, [fetchAccount])

  const signIn = useCallback(async () => {
    if (!sessionId) throw new Error("未登录")
    setSigningIn(true)
    try {
      const result = await api.doSignIn(sessionId)
      setSnapshot((prev) => ({ ...prev, signin: result }))
      void fetchAccount()
      return result
    } finally {
      setSigningIn(false)
    }
  }, [api, sessionId, fetchAccount])

  // active 变化时触发首次拉取
  useEffect(() => {
    const key = active ? sessionId : ""
    if (requestKeyRef.current === key) return
    requestKeyRef.current = key
    if (!active) {
      setSnapshot(cachedSnapshot())
      return
    }
    void fetchAccount()
  }, [active, sessionId, fetchAccount])

  // 监听全局刷新事件（与 top-bar 刷新链路对齐）
  useEffect(() => {
    if (!active) return
    const handler = () => void fetchAccount()
    window.addEventListener("volvo-refresh", handler)
    return () => window.removeEventListener("volvo-refresh", handler)
  }, [active, fetchAccount])

  const value = useMemo<AccountContextValue>(
    () => ({
      account: snapshot.account,
      membership: snapshot.membership,
      signin: snapshot.signin,
      loading: snapshot.loading,
      error: snapshot.error,
      refresh,
      signIn,
      signingIn,
    }),
    [snapshot, refresh, signIn, signingIn],
  )

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error("useAccount must be used within AccountProvider")
  return ctx
}
