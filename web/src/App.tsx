import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth"
import { NAV_EVENT, readTab, navigate, type TabKey } from "@/lib/tabs"
import { Header } from "@/components/top-bar"
import { BottomNav } from "@/components/bottom-tab-bar"
import { ControlTab } from "@/components/control-tab"
import { StatusTab } from "@/components/status-tab"
import { MeTab } from "@/components/me-tab"
import { LoginGate } from "@/components/login-gate"
import { VehicleStatusProvider } from "@/hooks/use-vehicle-status"
import { AccountProvider } from "@/hooks/use-account"

export function App() {
  const { status } = useAuth()
  const [tab, setTab] = useState<TabKey>(readTab)

  useEffect(() => {
    const sync = () => setTab(readTab())
    window.addEventListener(NAV_EVENT, sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener(NAV_EVENT, sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])

  if (status === "guest") return <LoginGate />

  return (
    <AccountProvider>
      <VehicleStatusProvider>
        <div className="min-h-svh bg-background text-foreground">
          <Header />
          <main className="mx-auto w-full max-w-app px-4 py-4 pb-24">
            <div className="page-enter">
              {tab === "control" && <ControlTab />}
              {tab === "status" && <StatusTab />}
              {tab === "me" && <MeTab />}
            </div>
          </main>
          <BottomNav active={tab} onChange={navigate} />
        </div>
      </VehicleStatusProvider>
    </AccountProvider>
  )
}

export default App
