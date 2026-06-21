import { useState, type FormEvent } from "react"
import {
  LogOutIcon,
  RefreshCwIcon,
  LogInIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth"
import { useVehicleStatus } from "@/hooks/use-vehicle-status"
import { loadCredentials } from "@/lib/api"
import {
  clearAmapConfig,
  hasStoredAmapConfig,
  loadAmapConfig,
  saveAmapConfig,
} from "@/lib/amap"
import {
  Card,
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
  const { sessionId, vehicles, selectedVin, phone, selectVin, login, logout } =
    useAuth()
  const { loading: statusLoading, refresh, data } = useVehicleStatus()
  const [phoneInput, setPhoneInput] = useState(
    () => loadCredentials()?.phone ?? phone ?? ""
  )
  const [passwordInput, setPasswordInput] = useState(
    () => loadCredentials()?.password ?? ""
  )
  const [remember, setRemember] = useState(() => !!loadCredentials())
  const [submitting, setSubmitting] = useState(false)
  const [amapKeyInput, setAmapKeyInput] = useState(() => loadAmapConfig().key)
  const [amapSecurityInput, setAmapSecurityInput] = useState(
    () => loadAmapConfig().securityJsCode
  )
  const [hasStoredAmap, setHasStoredAmap] = useState(hasStoredAmapConfig)

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

  const handleRefresh = async () => {
    const refreshed = await refresh()
    if (refreshed) toast.success("车辆状态已刷新")
    else toast.error("暂时无法刷新车辆状态，请稍后重试")
  }

  const handleAmapSave = (e: FormEvent) => {
    e.preventDefault()
    const key = amapKeyInput.trim()
    const securityJsCode = amapSecurityInput.trim()
    if (!key || !securityJsCode) {
      toast.error("请填写高德地图 Web 端 Key 和安全密钥")
      return
    }
    try {
      saveAmapConfig({ key, securityJsCode })
      setHasStoredAmap(true)
      toast.success("高德地图配置已保存")
    } catch {
      toast.error("配置保存失败，请检查浏览器存储权限")
    }
  }

  const handleAmapReset = () => {
    try {
      clearAmapConfig()
      const config = loadAmapConfig()
      setAmapKeyInput(config.key)
      setAmapSecurityInput(config.securityJsCode)
      setHasStoredAmap(false)
      toast.success("已恢复环境中的高德地图配置")
    } catch {
      toast.error("配置恢复失败，请检查浏览器存储权限")
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
              {submitting ? "登录中" : sessionId ? "重新登录" : "登录"}
            </Button>
          </CardFooter>
        </form>
      </Card>

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
            <Button
              variant="outline"
              disabled={statusLoading}
              onClick={handleRefresh}
            >
              {statusLoading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {statusLoading ? "刷新中" : "刷新状态"}
            </Button>
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
          <CardFooter className="grid grid-cols-2 gap-2">
            {hasStoredAmap && (
              <Button type="button" variant="outline" onClick={handleAmapReset}>
                <RotateCcwIcon data-icon="inline-start" />
                恢复默认
              </Button>
            )}
            <Button
              type="submit"
              className={hasStoredAmap ? undefined : "col-span-2"}
            >
              <SaveIcon data-icon="inline-start" />
              保存
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关于应用</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
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

      {sessionId && (
        <Button variant="outline" onClick={handleLogout}>
          <LogOutIcon data-icon="inline-start" />
          退出
        </Button>
      )}
    </div>
  )
}
