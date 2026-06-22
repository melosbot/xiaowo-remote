import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import { cn } from "@/lib/utils"
import { VolvoLogo } from "@/components/volvo-logo"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"

export function Header() {
  const { connection } = useAuth()
  const { loading, refresh } = useVehicleStatus()

  const variant =
    connection === "online"
      ? "default"
      : connection === "connecting"
        ? "secondary"
        : "outline"
  const dotClass =
    connection === "online"
      ? "bg-online"
      : connection === "connecting"
        ? "status-pulse bg-warning"
        : "bg-muted-foreground/40"
  const label =
    connection === "online"
      ? "在线"
      : connection === "connecting"
        ? "连接中"
        : "离线"

  const handleRefresh = async () => {
    // 触发全局刷新：车辆状态 + 账户/会员数据
    window.dispatchEvent(new CustomEvent("volvo-refresh"))
    const refreshed = await refresh()
    if (refreshed) toast.success("状态已刷新")
    else toast.error("暂时无法刷新，请稍后重试")
  }

  return (
    <header className="sticky top-0 z-20 flex h-header items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex items-center gap-2 font-heading font-medium">
        <VolvoLogo className="size-5 text-primary" />
        <span>小沃远控</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Badge variant={variant} className="gap-1">
          <span
            className={cn(
              "size-1.5 rounded-full transition-colors duration-300",
              dotClass
            )}
          />
          {label}
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={loading}
          onClick={handleRefresh}
          aria-label="刷新车辆状态"
        >
          {loading ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </div>
    </header>
  )
}
