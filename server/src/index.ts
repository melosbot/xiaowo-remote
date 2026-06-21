import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSession,
  ensureFreshTokens,
  getController,
  getSession,
  destroySession,
  validateSession,
  restoreSessions,
  SessionError,
} from "./session.js";
import { InvocationError } from "./volvo/grpc.js";
import { VolvoAPIError } from "./volvo/base.js";
import { CapabilityError } from "./volvo/capabilities.js";
import {
  DEMO_PHONE,
  DEMO_PASSWORD,
  DEMO_VEHICLES,
  DEMO_CAPS,
  demoStatus,
} from "./volvo/demo.js";

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const app = express();
app.use(cors());
app.use(express.json());

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
    sendError(res, err);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
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

app.get("/api/vehicles", async (req, res) => {
  const sessionId = String((req.query as AuthBody).session ?? "");
  if (isDemo(sessionId)) {
    const d = demoStore.get(sessionId);
    if (!d) { res.status(401).json({ error: "登录状态已失效" }); return }
    res.json({ vehicles: d.vehicles.map(v => v.vinCode) });
    return;
  }
  await withSession(req, res, async (sessionId) => {
    const session = getSession(sessionId);
    return { vehicles: [...session.vehicles.values()].map((c) => c.vin) };
  });
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
) {
  const sessionId = (req.body as AuthBody)?.session ?? "";
  if (isDemo(sessionId)) {
    // 模拟延迟
    await new Promise(r => setTimeout(r, 400));
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
  controlAction(req, res, (c) =>
    c.engineStart(Number(req.body?.duration ?? 15)),
  ),
);
app.post("/api/vehicles/:vin/engine/stop", (req, res) =>
  controlAction(req, res, (c) => c.engineStop()),
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
  app.listen(PORT, HOST, () => {
    console.log(`Volvo proxy listening on http://${HOST}:${PORT}`);
  });
});
