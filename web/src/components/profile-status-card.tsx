import { CheckCircle2Icon, CircleIcon, LogOutIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { MembershipInfo, SignInStatus, UserProfile } from "@/lib/api"

type ProfileStatusCardProps = {
  account: UserProfile | null
  membership: MembershipInfo | null
  signin: SignInStatus | null
  loading?: boolean
  signingIn?: boolean
  loggingOut?: boolean
  onSignIn?: () => void
  onLogout?: () => void
}

function maskMobile(mobile?: string) {
  if (!mobile) return "未绑定手机号"
  return mobile.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2")
}

function formatExpireTime(value?: string) {
  if (!value) return "—"
  const parts = value.split("/")
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`
  return value
}

export function ProfileStatusCard({
  account,
  membership,
  signin,
  loading = false,
  signingIn = false,
  loggingOut = false,
  onSignIn,
  onLogout,
}: ProfileStatusCardProps) {
  const displayName =
    account?.nickName ||
    `${account?.lastName ?? ""}${account?.firstName ?? ""}` ||
    "Volvo 用户"

  const fallback =
    account?.nickName?.slice(0, 1) ||
    account?.lastName?.slice(0, 1) ||
    account?.firstName?.slice(0, 1) ||
    "V"

  const mobile = maskMobile(account?.mobile)
  const levelTitle = membership?.levelTitle ?? "会员"
  const vRestValue = membership?.vRestValue ?? 0
  const monthValue = membership?.monthValue ?? 0
  const expireTime = formatExpireTime(membership?.expireTime)
  const progress = Math.round((membership?.levelProgress ?? 0) * 100)
  const validGrowthValue = membership?.validGrowthValue ?? 0
  const growthValueForUpgrade = membership?.growthValueForUpgrade ?? 0
  const signed = signin?.signInState ?? false
  const signInCount = signin?.signInCount ?? 0

  if (loading && !account) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-panel" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Separator />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-1 w-full" />
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>账户与会员</CardTitle>
        <Badge variant="secondary">{levelTitle}</Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 rounded-panel border">
            <AvatarImage src={account?.headPortrait} alt={displayName} />
            <AvatarFallback className="rounded-panel bg-primary/10 text-primary text-base font-semibold">
              {fallback}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">
              {displayName}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {mobile}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">可用 V 值</span>
          <span className="text-sm font-medium">{vRestValue}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">本月获得</span>
          <span className="text-sm font-medium">{monthValue}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">V 值到期</span>
          <span className="text-sm font-medium">{expireTime}</span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">有效成长值</span>
            <span className="ml-2 font-medium">{validGrowthValue}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            还差 {growthValueForUpgrade}
          </span>
        </div>
        <div className="space-y-1.5">
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>本月签到 {signInCount} 次</span>
            <span>{progress}%</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="grid grid-cols-2 gap-2">
        <Button
          variant={signed ? "secondary" : "default"}
          disabled={signed || signingIn}
          onClick={onSignIn}
        >
          {signingIn ? (
            <Spinner data-icon="inline-start" />
          ) : signed ? (
            <CheckCircle2Icon data-icon="inline-start" />
          ) : (
            <CircleIcon data-icon="inline-start" />
          )}
          {signed ? "今日已签" : "签到"}
        </Button>
        <Button
          variant="destructive"
          disabled={loggingOut}
          onClick={onLogout}
        >
          {loggingOut ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <LogOutIcon data-icon="inline-start" />
          )}
          退出
        </Button>
      </CardFooter>
    </Card>
  )
}
