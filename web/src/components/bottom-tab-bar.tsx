import { TABS, type TabKey } from "@/lib/tabs"
import { cn } from "@/lib/utils"

export function BottomNav({
  active,
  onChange,
}: {
  active: TabKey
  onChange: (t: TabKey) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80"
      aria-label="主导航"
    >
      {TABS.map((t) => {
        const Icon = t.icon
        const on = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (!on) onChange(t.key)
            }}
            data-active={on}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors duration-200 motion-reduce:transition-none",
              on ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
