import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./volvo/log.js";
import {
  createSession,
  ensureFreshTokens,
  getController,
  getSession,
  destroySession,
  validateSession,
  getSessionProfile,
  getSessionBase,
  restoreSessions,
  SessionError,
  getSessionPhone,
  shutdownAllSessions,
  getActiveSessionCount,
} from "./session.js";
import { InvocationError } from "./volvo/grpc.js";
import { VolvoAPIError } from "./volvo/base.js";
import { CapabilityError } from "./volvo/capabilities.js";
import {
  DEMO_PHONE,
  DEMO_PASSWORD,
  DEMO_VEHICLES,
  DEMO_CAPS,
  demoEngineControl,
  demoStatus,
} from "./volvo/demo.js";
import { getUserSettings, updateUserSettings } from "./volvo/settings-store.js";

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const app = express();

// ---- 安全策略 ----
app.use(helmet({
  contentSecurityPolicy: false, // PWA 由 Vite 注入 CSP meta，服务端不覆盖
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? true, // 默认允许所有同源，设 CORS_ORIGIN 限制
  methods: ["GET", "POST"],
  maxAge: 86400,
}));
app.use(express.json({ limit: "64kb" }));

// 全局限速
app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求过于频繁，请稍后重试" },
}));

// 登录限速（防暴力破解）
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "登录尝试过多，请 15 分钟后再试" },
});

// 请求日志（仅 VERBOSE=1 时输出）
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/")) {
    if (req.method === "POST" || req.method === "PUT") {
      const safe = { ...(req.body ?? {}) };
      if ("password" in safe) safe.password = "***";
      if ("token" in safe) safe.token = "***";
      log.info("req", `${req.method} ${req.path} ${JSON.stringify(safe).slice(0, 500)}`);
    } else {
      log.info("req", `${req.method} ${req.path}`);
    }
  }
  next();
});

// Demo session store
const demoStore = new Map<string, { vehicles: typeof DEMO_VEHICLES }>();

function isDemo(sessionId: string): boolean {
  return sessionId.startsWith("demo-");
}

function sendError(res: express.Response, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    err instanceof SessionError
      ? 401
      : err instanceof CapabilityError
        ? 403
        : err instanceof InvocationError
          ? 502
          : err instanceof VolvoAPIError
            ? 502
            : 500;
  res.status(status).json({ error: msg });
}

interface AuthBody {
  session?: string;
}

async function withSession<T>(
  req: express.Request,
  res: express.Response,
  fn: (sessionId: string) => Promise<T>,
) {
  try {
    const sessionId =
      String((req.body as AuthBody)?.session ?? "") ||
      String((req.query as AuthBody).session ?? "");
    if (!sessionId) {
      res.status(401).json({ error: "登录状态无效，请重新登录" });
      return;
    }
    await ensureFreshTokens(sessionId);
    const result = await fn(sessionId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("withSession", `${msg} (${err instanceof SessionError ? "SessionError" : err instanceof VolvoAPIError ? "VolvoAPIError" : typeof err})`);
    sendError(res, err);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    sessions: getActiveSessionCount(),
  });
});

app.get("/api/account", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  if (isDemo(sessionId)) {
    res.json({
      firstName: "Demo",
      lastName: "",
      nickName: "Demo",
      headPortrait: "",
      mobile: DEMO_PHONE,
      memberId: "",
      vocId: "",
    });
    return;
  }
  await withSession(req, res, async (sessionId) => {
    return getSessionProfile(sessionId);
  });
});

app.get("/api/membership", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  if (isDemo(sessionId)) {
    res.json({
      vTotalValue: 8800, vRestValue: 3260, monthValue: 480,
      expireTime: "2099/12/31", levelTitle: "白银会员", levelNumber: 2,
      levelProgress: 0.62, growthValue: 3200, growthValueForUpgrade: 1800,
      validGrowthValue: 3200,
      uniqueNumberCode: "",
    });
    return;
  }
  await withSession(req, res, async (sessionId) => {
    const base = getSessionBase(sessionId);
    if (!base) return null;
    const info = await base.getMembershipInfo();
    if (!info) return null;
    return info;
  });
});

app.get("/api/membership/signin", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  if (isDemo(sessionId)) { res.json({ signInState: true, signInCount: 7 }); return }
  await withSession(req, res, async (sessionId) => {
    const base = getSessionBase(sessionId);
    if (!base) return null;
    const profile = base.userProfile;
    if (!profile?.memberId) return null;
    return base.getSignInStatus(profile.memberId);
  });
});

app.post("/api/membership/signin", async (req, res) => {
  const sessionId = String((req.body as AuthBody).session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  if (isDemo(sessionId)) { res.json({ signInState: true, signInCount: 1 }); return }
  await withSession(req, res, async (sessionId) => {
    const base = getSessionBase(sessionId);
    if (!base) return null;
    const profile = base.userProfile;
    if (!profile?.memberId) return null;
    return base.doSignIn(profile.memberId);
  });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body ?? {};
    if (!phone || !password) {
      res.status(400).json({ error: "请填写手机号和密码" });
      return;
    }
    if (phone === DEMO_PHONE && password === DEMO_PASSWORD) {
      const sessionId = `demo-${Date.now()}`;
      demoStore.set(sessionId, { vehicles: DEMO_VEHICLES });
      res.json({ sessionId, vehicles: DEMO_VEHICLES });
      return;
    }
    const { sessionId, vehicles } = await createSession(phone, password);
    res.json({ sessionId, vehicles });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/logout", (req, res) => {
  try {
    const sessionId = (req.body as AuthBody)?.session;
    if (!sessionId) { res.json({ ok: true }); return }
    if (isDemo(sessionId)) { demoStore.delete(sessionId); res.json({ ok: true }); return }
    destroySession(sessionId);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/session/validate", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (!sessionId) { res.status(401).json({ valid: false }); return }
  if (isDemo(sessionId)) { res.json({ valid: demoStore.has(sessionId) }); return }
  const valid = await validateSession(sessionId);
  res.json({ valid });
});

app.get("/api/vehicles/:vin/status", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (isDemo(sessionId)) {
    if (!demoStore.has(sessionId)) { res.status(401).json({ error: "登录状态已失效" }); return }
    res.json({ status: demoStatus(req.params.vin) });
    return;
  }
  await withSession(req, res, async (sessionId) => {
    const ctrl = getController(sessionId, req.params.vin);
    const status = await ctrl.getStatus();
    return { status };
  });
});

app.post("/api/vehicles/:vin/refresh", async (req, res) => {
  const sessionId = (req.body as AuthBody)?.session ?? "";
  if (isDemo(sessionId)) { res.json({ ok: true }); return }
  await withSession(req, res, async (sessionId) => {
    const ctrl = getController(sessionId, req.params.vin);
    await ctrl.refreshFromCar();
    return { ok: true };
  });
});

app.get("/api/vehicles/:vin/capabilities", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (isDemo(sessionId)) { res.json({ capabilities: DEMO_CAPS }); return }
  await withSession(req, res, async (sessionId) => {
    const ctrl = getController(sessionId, req.params.vin);
    const caps = await ctrl.fetchCapabilities();
    return { capabilities: caps ?? null };
  });
});

type ActionHandler = (
  ctrl: ReturnType<typeof getController>,
) => Promise<unknown>;

async function controlAction(
  req: express.Request,
  res: express.Response,
  handler: ActionHandler,
  demoHandler?: () => void,
) {
  const sessionId = (req.body as AuthBody)?.session ?? "";
  if (isDemo(sessionId)) {
    // 模拟延迟
    await new Promise(r => setTimeout(r, 400));
    demoHandler?.();
    res.json({ ok: true });
    return;
  }
  const vin = String(req.params.vin);
  await withSession(req, res, async (sessionId) => {
    const ctrl = getController(sessionId, vin);
    await handler(ctrl);
    return { ok: true };
  });
}

app.post("/api/vehicles/:vin/lock", (req, res) =>
  controlAction(req, res, (c) => c.lock()),
);
app.post("/api/vehicles/:vin/unlock", (req, res) =>
  controlAction(req, res, (c) => c.unlock(req.body?.unlockType)),
);
app.post("/api/vehicles/:vin/engine/start", (req, res) =>
  controlAction(
    req,
    res,
    (c) => c.engineStart(Number(req.body?.duration ?? 15)),
    () => demoEngineControl(
      req.params.vin,
      true,
      Number(req.body?.duration ?? 15),
    ),
  ),
);
app.post("/api/vehicles/:vin/engine/stop", (req, res) =>
  controlAction(
    req,
    res,
    (c) => c.engineStop(),
    () => demoEngineControl(req.params.vin, false, 0),
  ),
);
app.post("/api/vehicles/:vin/honk", (req, res) =>
  controlAction(req, res, (c) => c.honk()),
);
app.post("/api/vehicles/:vin/flash", (req, res) =>
  controlAction(req, res, (c) => c.flash()),
);
app.post("/api/vehicles/:vin/honk-flash", (req, res) =>
  controlAction(req, res, (c) => c.honkAndFlash()),
);
app.post("/api/vehicles/:vin/window/open", (req, res) =>
  controlAction(req, res, (c) => c.windowOpen()),
);
app.post("/api/vehicles/:vin/window/close", (req, res) =>
  controlAction(req, res, (c) => c.windowClose()),
);
app.post("/api/vehicles/:vin/sunroof/open", (req, res) =>
  controlAction(req, res, (c) => c.sunroofOpen()),
);
app.post("/api/vehicles/:vin/sunroof/close", (req, res) =>
  controlAction(req, res, (c) => c.sunroofClose()),
);
app.post("/api/vehicles/:vin/tailgate/open", (req, res) =>
  controlAction(req, res, (c) => c.tailgateOpen()),
);
app.post("/api/vehicles/:vin/tailgate/close", (req, res) =>
  controlAction(req, res, (c) => c.tailgateClose()),
);
app.post("/api/vehicles/:vin/climatization/start", (req, res) =>
  controlAction(req, res, (c) => c.climatizationStart()),
);
app.post("/api/vehicles/:vin/climatization/stop", (req, res) =>
  controlAction(req, res, (c) => c.climatizationStop()),
);
app.post("/api/vehicles/:vin/pre-cleaning/start", (req, res) =>
  controlAction(req, res, (c) => c.preCleaningStart()),
);
app.post("/api/vehicles/:vin/pre-cleaning/stop", (req, res) =>
  controlAction(req, res, (c) => c.preCleaningStop()),
);

// ---- 用户设置（按账号持久化） ----

app.get("/api/settings", (req, res) => {
  const sessionId = String((req.query as Record<string, string>).session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  const phone = getSessionPhone(sessionId);
  if (!phone) { res.status(401).json({ error: "登录状态已失效" }); return }
  res.json(getUserSettings(phone));
});

app.post("/api/settings", (req, res) => {
  const sessionId = String((req.body as Record<string, unknown>)?.session ?? "");
  if (!sessionId) { res.status(401).json({ error: "未登录" }); return }
  const phone = getSessionPhone(sessionId);
  if (!phone) { res.status(401).json({ error: "登录状态已失效" }); return }
  const patch = (req.body as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
  if (!patch || typeof patch !== "object") {
    res.status(400).json({ error: "缺少 settings" });
    return;
  }
  const updated = updateUserSettings(phone, {
    amapKey: typeof patch.amapKey === "string" ? patch.amapKey : undefined,
    amapSecurityCode: typeof patch.amapSecurityCode === "string" ? patch.amapSecurityCode : undefined,
  });
  res.json(updated);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.WEB_ROOT ?? path.resolve(__dirname, "../../web/dist");

if (existsSync(webRoot)) {
  app.use(
    express.static(webRoot, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(path.join(webRoot, "index.html"));
  });
}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

restoreSessions().then(() => {
  const server = app.listen(PORT, HOST, () => {
    log.startup("server", `listening on http://${HOST}:${PORT}`);
  });

  // 优雅关闭:容器收到 SIGTERM(滚动更新/stop)时,停收新连接 → 等 in-flight → 关闭 gRPC
  function shutdown(signal: string) {
    log.warn("shutdown", `${signal} received, closing gracefully...`);
    server.close(() => {
      shutdownAllSessions();
      log.warn("shutdown", "all connections closed, exit");
      process.exit(0);
    });
    // 兜底:gRPC 控制指令可能耗时,8s 后仍未结束则强制退出
    setTimeout(() => {
      log.warn("shutdown", "graceful shutdown timeout, force exit");
      process.exit(1);
    }, 8000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
