# 小沃远控

面向沃尔沃中国区 SPA1 燃油车的非官方 Web/PWA 远程控制客户端。通过 Node.js 服务端代理沃尔沃私有 API，浏览器不直连车辆服务。

## 免责声明

- 本项目与 **沃尔沃汽车（Volvo Cars）** 及其关联公司**无任何关系**，未获得其认可、授权或背书。
- 项目使用逆向工程方式分析沃尔沃私有通信协议，仅出于**学习与技术研究**目的。
- 使用者应**自行承担全部风险与责任**。远程控制指令会真实作用于车辆，误操作可能导致人身伤害或财产损失。
- 使用本项目可能违反沃尔沃的服务条款，**账号可能被限制或封禁**。
- 本项目**不提供任何形式的担保**，作者不对因使用本项目造成的任何损失承担责任。
- 请仅用于**自己合法拥有或已获授权的车辆和账号**。

## 截图

| 控制 | 状态 | 设置 |
|------|------|------|
| ![控制页](docs/pictures/control.jpg) | ![状态页](docs/pictures/status.jpg) | ![设置页](docs/pictures/settings.jpg) |

## 快速体验

内置 demo 账号，无需真实车辆即可预览完整界面：

- 手机号：`13800000000`
- 密码：`demo`

演示数据为一台虚拟 XC60，所有控制操作模拟返回成功。

## 功能

**状态查看**
- 车辆概览：油量、续航、里程、平均油耗
- 门窗状态：四门、发动机舱盖、尾门、天窗，支持微开检测
- 车辆健康：保养提醒、制动液、冷却液、机油、清洗液、四轮胎压
- 实时位置（需配置高德地图）
- 车内空气质量（AQI / PM2.5）
- 驾驶统计（TM 累计 / TA 单次）
- 车辆基础信息：车牌、VIN、年款、动力类型、颜色

**远程控制**
- 锁车 / 解锁
- 远程启动 / 停止（联动空调，1–15 分钟）
- 鸣笛 / 闪灯 / 鸣笛并闪灯
- 车窗 / 天窗 / 尾门打开与关闭
- 车内空气净化启停
- 主动刷新车辆状态

控制按钮点击后弹出确认对话框，防止误触。状态更新采用事件驱动（首次进入 / 手动刷新 / 控制操作后），不进行定时轮询。

**能力感知**
- 后端依据 VIN 向沃尔沃能力接口查询车辆支持的远程功能
- 不支持的卡片在前端自动隐藏，未确认时按钮禁用
- 车型与年款仅用于展示，不作为功能开关依据

**其他**
- 深色模式支持
- PWA 可安装到桌面
- 多车辆切换
- 登录状态与最近一次车辆状态持久化

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19、TypeScript、Vite、Tailwind CSS v4、shadcn/ui (Radix) |
| 服务端 | Node.js、Express 5、gRPC (@grpc/grpc-js)、TypeScript |
| 协议 | SPA1 C3 gRPC、DigitalVolvo REST（HMAC-SHA256 签名） |
| 测试 | Vitest |
| 部署 | 多阶段 Docker 镜像 |

当前仅对接 SPA1 平台（沃尔沃中国区 C3 燃油车）。SPA2 协议已通过 APK 5.67.0 反编译完成分析（详见 `apk/PROTOCOL_INVENTORY.md`），但尚未接入。

## 项目结构

```text
.
├── web/                          React 前端与 PWA
│   └── src/
│       ├── components/           页面与 UI 组件
│       │   ├── control-tab.tsx   控制页
│       │   ├── status-tab.tsx    状态页
│       │   └── settings-tab.tsx  设置页
│       ├── hooks/                React hooks（认证、车辆状态）
│       └── lib/                  工具库（API 客户端、认证、地图）
├── server/                       Express API 服务端
│   └── src/
│       ├── index.ts              Express 路由（含 demo 账号）
│       ├── session.ts            会话管理
│       └── volvo/
│           ├── base.ts           DigitalVolvo REST 客户端
│           ├── grpc.ts           SPA1 gRPC 客户端（9 个 status service + InvocationService）
│           ├── signing.ts        HMAC-SHA256 签名
│           ├── vehicle.ts        车辆状态聚合 + 控制指令
│           ├── capabilities.ts   能力查询 / 缓存 / 守卫
│           ├── client-profile.ts 版本与 Header 集中配置
│           └── demo.ts           Demo 数据
├── apk/                          协议分析资料（APK 5.67.0 + 153 个 proto + 协议清单）
├── docs/
│   ├── pictures/                 应用截图
│   └── protocol/
│       └── spa1-header-matrix.md  SPA1 请求 Header 矩阵（脱敏）
├── Dockerfile                    生产镜像构建
└── plans/
    └── PLAN.md                   实施计划与记录
```

## 部署

### 方式一：源码运行

```bash
git clone https://github.com/melosbot/xiaowo-remote.git
cd xiaowo-remote

cd server && npm ci && cd ../web && npm ci
cd ../web && npm run build

cd ../server
npm start
```

打开 <http://localhost:8787>。如需高德地图，构建前复制 `web/.env.example` 为 `web/.env.local` 填入 Key。

### 方式二：Docker 构建

```bash
git clone https://github.com/melosbot/xiaowo-remote.git
cd xiaowo-remote

docker build -t xiaowo-remote \
  --build-arg VITE_AMAP_KEY=你的Key \
  --build-arg VITE_AMAP_SECURITY_JS_CODE=你的安全密钥 \
  .
mkdir -p ./volvo-data && chmod 777 ./volvo-data
docker run -d -p 8787:8787 -v "$(pwd)/volvo-data:/app/data" xiaowo-remote
```

地图参数可省略。挂载前需 `mkdir -p ./volvo-data && chmod 777 ./volvo-data` 确保容器内 node 用户可写。

### 方式三：拉取预构建镜像

```bash
docker pull ghcr.io/melosbot/xiaowo-remote:main
mkdir -p ./volvo-data && chmod 777 ./volvo-data
docker run -d -p 8787:8787 -v "$(pwd)/volvo-data:/app/data" ghcr.io/melosbot/xiaowo-remote:main
```

镜像由 GitHub Actions 自动构建，支持 linux/amd64 与 linux/arm64。

---

## 开发

```bash
cd server && npm ci && cd ../web && npm ci

# 终端 1
cd server && npm run dev     # API → :8787

# 终端 2
cd web && npm run dev        # 前端 → :5173，自动代理 API
```

## 环境变量

### 前端

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | 空 | API 基础地址，同源部署无需设置 |
| `VITE_AMAP_KEY` | 空 | 高德地图 Web 端 JS API Key |
| `VITE_AMAP_SECURITY_JS_CODE` | 空 | 高德地图安全密钥 |

### 服务端

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8787` | 监听端口 |
| `WEB_ROOT` | `web/dist` | 前端静态文件目录 |
| `DATA_DIR` | `./data` | 会话持久化目录 |

## 检查

```bash
cd web
npm run lint && npm run typecheck && npm run build

cd ../server
npm run typecheck && npm test
```

## 安全架构

### 凭证隔离

```
浏览器                           服务端                           Volvo
  │                                │                                │
  │── phone + password ───────────→│  （仅登录时传一次）              │
  │                                │── HMAC 签名 ─────────────────→│
  │←── sessionId ─────────────────│←── accessToken / xToken ──────│
  │                                │   （存入内存，永不下发）         │
  │                                │                                │
  │── /api/...?session=xxx ───────→│                                │
  │                                │── Bearer token ───────────────→│
  │←── 车辆数据 ───────────────────│←── gRPC 响应 ──────────────────│
```

- 服务端**从不将 Volvo 凭证下发到浏览器**，浏览器仅持有无意义的 `sessionId`
- 服务端重启后所有会话丢失，需重新登录
- 浏览器持久化会话与最近车辆状态（localStorage）；启用「记住密码」后凭据也存入本地存储——**请勿在公共或他人设备上启用该选项**
- 服务端可代发任意控制指令，**不应直接暴露到公网**

### 部署建议

公网部署前至少应增加：HTTPS、身份认证、CORS 白名单、速率限制、反向代理隔离。

### 远程控制

- 所有控制操作均需**二次确认**方可发送
- 状态更新采用**事件驱动**（首次进入 / 手动刷新 / 控制后），不进行定时轮询，减少请求量
- 指令会真实作用于车辆，发送前请确认周围环境安全

## 已知限制

- 仅对接 SPA1/C3 平台，SPA2 车辆（新款纯电 / PHEV / EX 系列）暂不支持。
- 功能可用性取决于车型配置、车机软件版本、账号权限与网络状态。项目通过 VIN 能力查询尽可能准确判断，但该接口尚未经抓包验证。
- 沃尔沃私有接口可能随官方 App 更新而变化，届时状态读取或控制功能可能暂时失效。
- 停车温控单独控制当前不可用；SPA1 燃油车通过远程启动联动空调。

## 致谢

- 本项目受到 [hass-volvooncall-cn](https://github.com/idreamshen/hass-volvooncall-cn) 的启发，感谢 [@idreamshen](https://github.com/idreamshen) 的工作。
- 感谢 [LinuxDo](https://linux.do) 社区的讨论、协助与鼓励，推动了这个项目的诞生与完善。
