import { useState, type FormEvent } from "react"
import { LogInIcon } from "lucide-react"
import { VolvoLogo } from "@/components/volvo-logo"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth"
import { loadCredentials } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

export function LoginGate() {
  const { login } = useAuth()
  const [phone, setPhone] = useState(() => loadCredentials()?.phone ?? "")
  const [password, setPassword] = useState(
    () => loadCredentials()?.password ?? ""
  )
  const [remember, setRemember] = useState(() => !!loadCredentials())
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!phone || !password) {
      toast.error("请填写手机号和密码")
      return
    }
    setLoading(true)
    try {
      await login(phone, password, remember)
      toast.success("登录成功")
      if (!remember) setPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="page-enter w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-panel bg-primary/10 text-primary">
            <VolvoLogo className="size-8 text-primary" />
          </div>
          <CardTitle className="font-heading text-xl font-semibold">
            小沃远控
          </CardTitle>
          <CardDescription>登录沃尔沃汽车 App 中国区账号</CardDescription>
        </CardHeader>
        <form onSubmit={submit} className="contents">
          <CardContent>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="phone">手机号</FieldLabel>
                <Input
                  id="phone"
                  inputMode="numeric"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">密码</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入沃尔沃汽车 App 密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">记住密码</span>
                <Switch checked={remember} onCheckedChange={setRemember} />
              </div>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled={loading}>
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LogInIcon data-icon="inline-start" />
              )}
              {loading ? "登录中" : "登录"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
