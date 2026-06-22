import { useState, useEffect, type FormEvent } from "react"
import {
  LogOutIcon,
  LogInIcon,
  RotateCcwIcon,
  SaveIcon,
  FlaskConicalIcon,
  SendIcon,
  GiftIcon,
  CalendarCheckIcon,
  TrendingUpIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import {
  loadCredentials,
  loadCachedProfile,
  loadCachedMembership,
  shouldThrottleFetch,
  markFetchDone,
  type UserProfile,
  type MembershipInfo,
} from "@/lib/api"
import {
  clearAmapConfig,
  loadAmapConfig,
  saveAmapConfig,
} from "@/lib/amap"
import { loadTgConfig, saveTgConfig } from "@/lib/tg"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function SettingsTab() {
  const { api, sessionId, vehicles, selectedVin, phone, selectVin, login, logout } =
    useAuth()
  const { data } = useVehicleStatus()
  const [phoneInput, setPhoneInput] = useState(
    () => loadCredentials()?.phone ?? phone ?? ""
  )
  const [passwordInput, setPasswordInput] = useState(
    () => loadCredentials()?.password ?? ""
  )
  const [remember, setRemember] = useState(() => !!loadCredentials())
  const [submitting, setSubmitting] = useState(false)
  const [account, setAccount] = useState<UserProfile | null>(() => loadCachedProfile())
  const [membership, setMembership] = useState<MembershipInfo | null>(() => loadCachedMembership())
  const [signIn, setSignIn] = useState<{
    signInState: boolean
    signInCount: number
  } | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [amapKeyInput, setAmapKeyInput] = useState("")
  const [amapSecurityInput, setAmapSecurityInput] = useState("")
  const [amapTesting, setAmapTesting] = useState(false)
  const [amapSaving, setAmapSaving] = useState(false)

  // ---- Telegram ----
  const [tgToken, setTgToken] = useState("")
  const [tgChatId, setTgChatId] = useState("")
  const [tgSaving, setTgSaving] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgTokenSaving, setTgTokenSaving] = useState(false)
  const [tgStatus, setTgStatus] = useState<{
    configured: boolean
    tokenHint: string
    source: "ui" | "env" | null
  } | null>(null)
  // 手动刷新账户 + 会员数据（不受节流限制）
  const refreshAccount = async () => {
    if (!sessionId) return
    const [acc, mem, sig] = await Promise.allSettled([
      api.getAccount(sessionId),
      api.getMembership(sessionId),
      api.getSignInStatus(sessionId),
    ])
    if (acc.status === "fulfilled" && acc.value) setAccount(acc.value)
    if (mem.status === "fulfilled") setMembership(mem.value)
    if (sig.status === "fulfilled") setSignIn(sig.value)
    markFetchDone()
  }

  // 加载时刷一次（冷却期内跳过）+ 监听顶部刷新按钮
  useEffect(() => {
    if (!sessionId) return
    if (!shouldThrottleFetch()) {
      void refreshAccount()
    }
    const handler = () => { void refreshAccount() }
    window.addEventListener("volvo-refresh", handler)
    return () => window.removeEventListener("volvo-refresh", handler)
  }, [sessionId, api])

  const handleSignIn = async () => {
    if (!sessionId || signingIn) return
    setSigningIn(true)
    try {
      const result = await api.doSignIn(sessionId)
      setSignIn(result)
      if (result.signInState) {
        toast.success("签到成功！")
        // 签到后更新会员数据
        api.getMembership(sessionId).then(setMembership).catch(() => {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "签到失败")
    } finally {
      setSigningIn(false)
    }
  }

  // 从服务端拉取设置（跟随账号）
  useEffect(() => {
    api.getTgStatus().then(setTgStatus).catch(() => {})
    if (!sessionId) return
    api
      .getSettings(sessionId)
      .then((s) => {
        setAmapKeyInput(s.amapKey || "")
        setAmapSecurityInput(s.amapSecurityCode || "")
        setTgChatId(s.tgChatId || "")
        // 同步到 localStorage，保持 amap.ts / tg.ts 兼容
        if (s.amapKey || s.amapSecurityCode) {
          saveAmapConfig({ key: s.amapKey, securityJsCode: s.amapSecurityCode })
        }
        if (s.tgChatId) saveTgConfig({ chatId: s.tgChatId })
      })
      .catch(() => {
        // 服务端不可用时回退 localStorage
        setAmapKeyInput(loadAmapConfig().key)
        setAmapSecurityInput(loadAmapConfig().securityJsCode)
        setTgChatId(loadTgConfig().chatId)
      })
  }, [api, sessionId])

  const handleTgSetToken = async () => {
    if (!tgToken.trim()) {
      // 清空 → 回退环境变量
      setTgTokenSaving(true)
      try {
        await api.setTgToken("")
        const status = await api.getTgStatus()
        setTgStatus(status)
        toast.success(status.configured ? "已回退到环境变量配置" : "Bot Token 已清除")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "操作失败")
      } finally {
        setTgTokenSaving(false)
      }
      return
    }
    setTgTokenSaving(true)
    try {
      const result = await api.setTgToken(tgToken.trim())
      const status = await api.getTgStatus()
      setTgStatus(status)
      if (result.verified) {
        toast.success(`Bot Token 已保存 · @${result.username}`)
      } else {
        toast.warning("Token 已保存到服务端，但 Telegram 验证未通过，请检查是否正确")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setTgTokenSaving(false)
    }
  }

  const handleAmapTest = async () => {
    setAmapTesting(true)
    try {
      const config = loadAmapConfig()
      const { default: AMapLoader } = await import("@amap/amap-jsapi-loader")
      await AMapLoader.load({ key: config.key, version: "2.0" })
      toast.success("高德地图配置有效，可以正常加载")
    } catch {
      toast.error("高德地图 Key 无效，请检查 Key 和安全密钥")
    } finally {
      setAmapTesting(false)
    }
  }

  const handleTgSave = async () => {
    if (!tgChatId.trim()) {
      toast.error("请填写 Chat ID")
      return
    }
    setTgSaving(true)
    try {
      saveTgConfig({ chatId: tgChatId.trim() })
      // 持久化到服务端（跟随账号）+ 同步到轮询
      if (sessionId) {
        await api.saveSettings(sessionId, { tgChatId: tgChatId.trim() })
      }
      toast.success("Telegram Chat ID 已保存" + (sessionId ? "到账号" : ""))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setTgSaving(false)
    }
  }

  const handleTgTest = async () => {
    if (!tgChatId.trim()) {
      toast.error("请先填写 Chat ID")
      return
    }
    setTgTesting(true)
    try {
      await api.testTgPush(tgChatId.trim())
      toast.success("测试消息已发送，请检查 Telegram")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "推送测试失败，请检查 Chat ID")
    } finally {
      setTgTesting(false)
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!phoneInput || !passwordInput) {
      toast.error("请填写手机号和密码")
      return
    }
    setSubmitting(true)
    try {
      await login(phoneInput, passwordInput, remember)
      toast.success("登录成功")
      if (!remember) setPasswordInput("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败，请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    toast.success("已安全退出")
  }

  const handleAmapSave = async (e: FormEvent) => {
    e.preventDefault()
    const key = amapKeyInput.trim()
    const securityJsCode = amapSecurityInput.trim()
    if (!key || !securityJsCode) {
      toast.error("请填写高德地图 Web 端 Key 和安全密钥")
      return
    }
    setAmapSaving(true)
    try {
      // 同步到 localStorage（amap.ts 依赖）
      saveAmapConfig({ key, securityJsCode })
      // 持久化到服务端（跟随账号）
      if (sessionId) {
        await api.saveSettings(sessionId, { amapKey: key, amapSecurityCode: securityJsCode })
      }
      toast.success("高德地图配置已保存" + (sessionId ? "到账号" : ""))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setAmapSaving(false)
    }
  }

  const handleAmapReset = () => {
    try {
      clearAmapConfig()
      const config = loadAmapConfig()
      setAmapKeyInput(config.key)
      setAmapSecurityInput(config.securityJsCode)
      toast.success("已恢复环境变量中的高德地图配置")
    } catch {
      toast.error("配置恢复失败，请检查浏览器存储权限")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sessionId && account ? (
        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>
              {account.mobile}
              {membership && ` · ${membership.levelTitle} No.${membership.uniqueNumberCode}`}
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                {membership && (
                  <Button
                    variant={signIn?.signInState ? "secondary" : "default"}
                    size="sm"
                    disabled={signIn?.signInState || signingIn}
                    onClick={handleSignIn}
                  >
                    {signingIn ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <CalendarCheckIcon data-icon="inline-start" />
                    )}
                    {signIn?.signInState ? "已签" : "签到"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOutIcon data-icon="inline-start" />
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {account.headPortrait ? (
                <img
                  src={account.headPortrait}
                  alt=""
                  className="size-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full bg-muted text-xl text-muted-foreground">
                  {(account.nickName || account.lastName + account.firstName || "?").charAt(0)}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">
                  {account.lastName}{account.firstName}
                </span>
                {account.nickName && (
                  <span className="text-sm text-muted-foreground">{account.nickName}</span>
                )}
              </div>
            </div>
            {membership && (
              <>
                <Separator />
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2">
                    <GiftIcon className="size-4 text-primary" />
                    <span className="text-lg font-bold">{membership.vRestValue}</span>
                    <span className="text-[10px] text-muted-foreground">可用 V 值</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2">
                    <TrendingUpIcon className="size-4 text-primary" />
                    <span className="text-lg font-bold">{membership.growthValue}</span>
                    <span className="text-[10px] text-muted-foreground">成长值</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/50 py-2">
                    <CalendarCheckIcon className="size-4 text-primary" />
                    <span className="text-lg font-bold">{signIn?.signInCount ?? 0}</span>
                    <span className="text-[10px] text-muted-foreground">本月签到</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>距下一级还差 {membership.growthValueForUpgrade} 成长值</span>
                    <span>{Math.round(membership.levelProgress * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, membership.levelProgress * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>本月 +{membership.monthValue} V值</span>
                  {membership.expireTime && <span>到期 {membership.expireTime}</span>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>账号与登录</CardTitle>
            <CardDescription>管理沃尔沃汽车 App 中国区账号</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin} className="contents">
            <CardContent>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="phone">手机号</FieldLabel>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    placeholder="请输入手机号"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入沃尔沃汽车 App 密码"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </Field>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">记住密码</span>
                  <Switch checked={remember} onCheckedChange={setRemember} />
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <LogInIcon data-icon="inline-start" />
                )}
                {submitting ? "登录中" : "登录"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {sessionId && vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>我的车辆</CardTitle>
            <CardDescription>选择车辆并查看基础信息</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={selectedVin ?? undefined} onValueChange={selectVin}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择车辆" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>已绑定车辆</SelectLabel>
                  {vehicles.map((v) => (
                    <SelectItem key={v.vinCode} value={v.vinCode}>
                      {v.seriesName} {v.modelName} · {v.vinCode.slice(-6)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {data?.vehicleInfo && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">车型</span>
                  <span className="text-sm">
                    {data.vehicleInfo.seriesName} {data.vehicleInfo.modelName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">车牌号</span>
                  <span className="text-sm">
                    {data.vehicleInfo.licencePlate || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">VIN 码</span>
                  <span className="text-sm font-mono">{data.vehicleInfo.vin}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">车辆年款</span>
                  <span className="text-sm">
                    {data.vehicleInfo.modelYear
                      ? `${data.vehicleInfo.modelYear}款`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">购车时间</span>
                  <span className="text-sm">
                    {data.vehicleInfo.buyDate
                      ? data.vehicleInfo.buyDate.split(" ")[0]
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">动力类型</span>
                  <span className="text-sm">
                    {data.vehicleInfo.carType === "fuel"
                      ? "汽油"
                      : data.vehicleInfo.carType || "—"}
                  </span>
                </div>
                {data.vehicleInfo.outerColor && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      外观颜色
                    </span>
                    <span className="text-sm">{data.vehicleInfo.outerColor}</span>
                  </div>
                )}
                {data.vehicleInfo.innerColor && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      内饰颜色
                    </span>
                    <span className="text-sm">{data.vehicleInfo.innerColor}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>高德地图</CardTitle>
          <CardDescription>
            用于显示车辆位置，配置仅保存在当前浏览器中
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAmapSave} className="contents">
          <CardContent>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="amap-key">Web 端 Key</FieldLabel>
                <Input
                  id="amap-key"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="请输入高德地图 Web 端 Key"
                  value={amapKeyInput}
                  onChange={(e) => setAmapKeyInput(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="amap-security">
                  安全密钥（securityJsCode）
                </FieldLabel>
                <Input
                  id="amap-security"
                  type="password"
                  autoComplete="new-password"
                  placeholder="请输入安全密钥"
                  value={amapSecurityInput}
                  onChange={(e) => setAmapSecurityInput(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" onClick={handleAmapReset}>
              <RotateCcwIcon data-icon="inline-start" />
              恢复
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={amapTesting}
              onClick={handleAmapTest}
            >
              {amapTesting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FlaskConicalIcon data-icon="inline-start" />
              )}
              测试
            </Button>
            <Button type="submit" disabled={amapSaving}>
              {amapSaving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              保存
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram 推送</CardTitle>
          <CardDescription>
            离车告警通知。Bot Token 也可通过服务端环境变量
            <code className="mx-1 text-xs">TG_BOT_TOKEN</code>
            持久化配置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="tg-token">Bot Token</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="tg-token"
                  type="password"
                  autoComplete="new-password"
                  placeholder={tgStatus?.configured ? tgStatus.tokenHint : "从 @BotFather 获取"}
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={tgTokenSaving}
                  onClick={handleTgSetToken}
                  className="shrink-0"
                >
                  {tgTokenSaving ? <Spinner data-icon="inline-start" /> : null}
                  {tgToken.trim() ? "保存" : tgStatus?.source === "ui" ? "清除" : "保存"}
                </Button>
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bot 状态</span>
              {tgStatus?.configured ? (
                <Badge variant="default">
                  {tgStatus.source === "ui" ? "网页配置" : "环境变量"}
                  {" · "}
                  {tgStatus.tokenHint}
                </Badge>
              ) : (
                <Badge variant="secondary">未配置</Badge>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="tg-chat-id">Chat ID</FieldLabel>
              <Input
                id="tg-chat-id"
                inputMode="numeric"
                placeholder="从 @userinfobot 获取"
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={tgTesting || !tgStatus?.configured}
            onClick={handleTgTest}
          >
            {tgTesting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            测试推送
          </Button>
          <Button disabled={tgSaving} onClick={handleTgSave}>
            {tgSaving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            保存 Chat ID
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关于应用</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>产品名称</span>
            <Badge variant="secondary">小沃远控</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>车辆服务</span>
            <span>沃尔沃中国 API</span>
          </div>
          <Separator />
          <p className="text-xs">
            应用通过服务端连接沃尔沃中国
            API。登录密码仅在开启“记住密码”时保存在当前浏览器，会话信息仅存储在当前设备。
          </p>
        </CardContent>
      </Card>

    </div>
  )
}
