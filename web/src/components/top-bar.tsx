import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { VolvoLogo } from "@/components/volvo-logo"

export function Header() {
  const { connection } = useAuth()
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

  return (
    <header className="sticky top-0 z-20 flex h-header items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex items-center gap-2 font-heading font-semibold">
        <VolvoLogo className="size-5 text-primary" />
        <span>小沃远控</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "size-2 rounded-full transition-colors duration-300",
            dotClass
          )}
        />
      </div>
    </header>
  )
}
