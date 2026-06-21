# TODO - SPA2 平台支持

当前项目已对齐 SPA1 平台（`cepmobtoken.prod.c3.volvocars.com.cn` 后端，2023 XC60 等油车）。
SPA2 平台（新款纯电 EX30/EX90/EM90/C40/XC40 Recharge + 新款油车 SPA2 架构）走 `cnepmob.volvocars.com.cn` 后端，需单独对接。

参考文档：`apk/PROTOCOL_INVENTORY.md`
APK 提取的 SPA2 proto 源文件：`apk/extracted_protos/`

---

## 一、SPA2 后端基础设施

### 1. gRPC host 切换
- [ ] `server/src/volvo/grpc.ts` 增加 `SPA2_HOST = "cnepmob.volvocars.com.cn:443"`
- [ ] 按车型平台路由：根据 `BoundVehicle.modelYear` + 车系判断走哪个 host
  - 简单规则：`modelYear >= 2024 && 电动车系` → SPA2，否则 SPA1
  - 更准确：调用 REST `/app/account/vehicles/api/v1/owner/getCarModel` 获取平台标识
- [ ] 2023 XC60 等 SPA1 车型继续走 `cepmobtoken.prod.c3`，不动

### 2. gRPC metadata 变化
SPA2 调用需额外传：
- [ ] `uuid` metadata：车辆 UUID（来自 `car_mdapi/preferences` 或车辆绑定接口）
- [ ] `client-version` metadata：`5.67.0`
- [ ] `deviceid` metadata：设备 ID（可生成一次性 UUID 持久化）

### 3. 特性授权查询
- [ ] 新建 `featureauthorization.proto`（SPA1 风格，参考 `apk/extracted_protos/entities/featureauthorization/FeatureAuthorizationSettings.proto`）
- [ ] `grpc.ts` 加 `getFeatureAuthorization(vin)` 方法
- [ ] 调用任何 SPA2 服务前先查 FAS，未授权的特性禁用对应按钮

---

## 二、SPA2 状态查询服务（新增 proto + grpc 方法）

参考 `apk/extracted_protos/` 下的源 proto，按 SPA1 风格（`vin` 在 req field 2、resp field 1 + data field 3）改写。

### 1. BatteryService（电车核心）
- [ ] 新建 `battery.proto`
  - 状态消息：`BatteryChargeStatus`（PHEV）+ `BatteryChargingInfo`（BEV，22 种充电状态、12 种告警）
  - 参考：`apk/extracted_protos/entities/batterycharge/BatteryChargeStatus.proto`
  - 参考：`apk/extracted_protos/entities/batterycharge/spa2/BatteryChargingInfoTypes.proto`
- [ ] `grpc.ts` 加 `getBattery(vin)` 方法
- [ ] `vehicle.ts` `getStatus()` 加 `battery` 字段（soc / 续航 / 充电状态 / 充电时间 / 充电功率 / 端口状态 / 锁状态 / 通知告警）
- [ ] 前端 `api.ts` 加 `BatteryStatus` 类型
- [ ] 前端 `status-tab.tsx` 加电池/充电状态卡片
- [ ] 前端 `control-tab.tsx` 加充电控制（仅电车显示）

### 2. ParkingClimatizationService（SPA2 详细版）
- [ ] 扩展 `parkingclimatization.proto` 增加 SPA2 字段
  - 参考：`apk/extracted_protos/entities/parkingclimatization/spa2/ClimatizationTypes.proto`
  - 新增字段：座椅加热强度（4 座椅）、方向盘加热、车厢目标温度、电池预处理、当前车厢温度
- [ ] `InvocationService.ClimatizationStart` 的 SPA2 请求体支持温控参数（座椅/方向盘/温度）
- [ ] 前端 `control-tab.tsx` 停车温控卡片增加温度滑块、座椅加热档位选择

### 3. PreCleaningService（SPA2 详细版）
- [ ] 扩展 `precleaning.proto` 增加 SPA2 字段
  - 参考：`apk/extracted_protos/entities/precleaning/` 目录
  - 新增字段：空气质量传感器详细状态、净化历史记录

### 4. DashboardService（SPA2 统一仪表盘）
- [ ] 新建 `dashboard.proto`（合并 fuel/odometer/health 为统一查询）
  - 参考：`apk/extracted_protos/entities/dashboard/DashboardStatus.proto`
  - 21 字段含油车所有指标 + 21 项车灯报警 + 4 类液位 + 4 胎压
- [ ] SPA2 车型用 `DashboardService` 替代分散的 fuel/odometer/health 查询

### 5. ConnectivityInfo（车辆连接状态）
- [ ] 新建 `connectivity.proto`
  - 参考：`apk/extracted_protos/entities/connectivityinfo/ConnectivityInfo.proto`
  - 字段：4G 信号强度、网络类型（LTE/WCDMA/GSM）、连接状态
- [ ] 前端展示车辆网络状态

### 6. CarAccessState（车辆使用模式）
- [ ] 新建 `caraccessstate.proto`
  - 参考：`apk/extracted_protos/entities/caraccessstate/CarAccessStateStatus.proto`
  - 字段：`CarUsageMode`（ABANDONED/INACTIVE/CONVENIENCE/ACTIVE/DRIVING）
- [ ] 替代当前用 `availability + CarInUse` 推断发动机运行的黑科技

---

## 三、SPA2 远程控制服务

### 1. InvocationService 扩展
SPA2 InvocationService 新增方法（部分 SPA2 车型）：
- [ ] `WindowControlOpen` / `WindowControlClose`（拆分的开/关方法）
- [ ] `TailgateControlOpen` / `TailgateControlClose`
- [ ] `HonkFlashAndHonk`（替代 `HonkFlash` 的 HONK_AND_FLASH）
- [ ] 锁车请求体增加 `uuid` 字段（SPA2 必填）

### 2. 充电控制（chronos 服务，**电车专属**）

**注意**：chronos 服务的 .proto 没在 APK 里，被 Dart AOT 编译进 `libapp.so`，字段定义需通过以下方式获取：
1. **抓包**（推荐）：用绑定电车的账号 + mitmproxy + Frida 绕 SSL pinning，捕获 gRPC 流量后用 `protoc --decode_raw` 反推字段
2. **blutter 反编译**：用 [blutter](https://github.com/aspect-build/aspect-cli) 反编译 `libapp.so` 拿 Dart 类结构（libapp.so 59MB，AOT 编译）
3. **参考已有项目**：HA 官方 `volvooncall` 国际版 / `volvo2mqtt` 德国版有完整 EV 字段命名可参考

需要补的 service：
- [ ] `TargetSocService/GetTargetSoc` + `SetTargetSoc` — 目标电量百分比
- [ ] `AmpLimitService/GetAmpLimit` + `SetAmpLimit` — 充电电流限制
- [ ] `ChargeLocationService` 全套（10 个 RPC）— 充电位置 CRUD + 定时器
- [ ] `ParkingClimateTimerService` 全套（5 个 RPC）— 温控定时器
- [ ] `GlobalChargeTimerService` 全套（2 个 RPC）— 全局充电定时器

### 3. SPA2 充电控制（remote_control.spa2 包）
这些 proto 源文件已在 `apk/extracted_protos/messages/batterycharge/spa2/`，可直接用：
- [ ] `ChargeNowRequest` — 立即充电
- [ ] `SetPlugAndChargeEnabledRequest` — 即插即充开关
- [ ] `StopResumeChargingRequest` — 停止/恢复充电
- [ ] `CreateChargingLocationRequest` / `ModifyChargingLocationRequest` / `DeleteChargingLocationRequest` — 充电位置 CRUD

---

## 四、其他 SPA2 服务（按需实现）

### 1. OTA 升级
- [ ] `/ota_mobcache.OtaDiscoveryService/GetSoftwareInfo` — 查询车辆软件信息
- [ ] `/ota_mobcache.SchedulerService/GetSchedule` / `InstallNow` / `Schedule` / `CancelSchedule` — OTA 安装计划

### 2. 数字钥匙（Digital Key）
- [ ] `/services.DeviceFacadeService/GetOwnerAndTrackedKeys` — 查询车主钥匙 + 跟踪钥匙
- [ ] `/services.DeviceFacadeService/IsCarReadyForDigitalKey` — 车辆是否支持数字钥匙
- [ ] `/services.DeviceFacadeService/GetOwnerPairingPassword` — 车主配对密码
- [ ] `/services.DeviceFacadeService/KeyTermination` — 终止钥匙

### 3. 家人共享
- [ ] `/car_usermanagement.AccountLinkInvitationService/*` — 邀请生成/接受/查询/撤销
- [ ] `/car_usermanagement.UserRelationService/*` — 用户关系管理
- [ ] `/car_usermanagement.EndOwnershipService/EndOwnership` — 解绑车辆

### 4. 车辆位置增强
- [ ] `/dtlinternet.DtlInternetService/GetLastParkedLocation` — 上次停车位置
- [ ] `/dtlinternet.DtlInternetService/StreamLastParkedLocations` — 流式订阅（新版命名，旧版 `StreamLastKnownLocations` 仍兼容）

### 5. 天气
- [ ] `/weather.WeatherService/GetWeatherReport` — 天气预报

### 6. POI 发送
- [ ] `/senpai.SenpaiService/SendPoi` — 发送兴趣点到车机

---

## 五、前端适配

### 1. 车型平台判断
- [ ] `App.tsx` / `auth.tsx` 根据车辆信息判断 SPA1 / SPA2
- [ ] 不同平台显示不同的控制卡片（电车显示充电控制、油车显示远程启动）

### 2. 电车专属 UI
- [ ] 电池/充电状态卡片（SOC 圆环图、充电进度条、剩余时间）
- [ ] 充电控制面板（目标 SOC 滑块、电流限制、立即充电/停止、定时器）
- [ ] 充电位置管理（地图 + 位置列表 + CRUD）

### 3. 通用 UI 优化
- [ ] 停车温控加温度滑块 + 座椅加热档位（SPA2）
- [ ] 仪表盘统一卡片（SPA2 用 DashboardService 数据）
- [ ] 车辆连接状态指示（4G 信号强度图标）

---

## 六、抓包计划（实施 SPA2 前必须完成）

### 准备
- [ ] 获取绑定电车的沃尔沃 App 账号（XC40 Recharge / C40 / EX30 / EX90 / EM90）
- [ ] 准备 rooted Android 设备（Android 7+ 不信任用户 CA）
- [ ] 安装 Frida + frida-server
- [ ] 安装 mitmproxy（支持 gRPC over HTTP/2 解码）

### 步骤
- [ ] 把 mitmproxy CA 证书装到 `/system/etc/security/cacerts/`
- [ ] 启动 frida-server，运行 SSL pinning 绕过脚本
- [ ] 启动 mitmproxy 抓包
- [ ] 打开沃尔沃 App，操作电车功能（充电控制、温控定时器等）
- [ ] 保存 gRPC 流量为 `.proto` 二进制
- [ ] 用 `protoc --decode_raw` 反推 chronos 服务字段定义
- [ ] 整理出完整 SPA2 .proto 文件放进 `server/src/proto/`

### Frida SSL pinning 绕过脚本模板
```javascript
Java.perform(() => {
  const SSLContext = Java.use('javax.net.ssl.SSLContext')
  SSLContext.init.overload(
    '[Ljavax.net.ssl.TrustManager;',
    'java.security.SecureRandom'
  ).implementation = (tms, sr) => {
    const TrustManager = Java.registerClass({
      name: 'org.wooyun.TrustAllManager',
      implements: [Java.use('javax.net.ssl.X509TrustManager')],
      methods: {
        checkClientTrusted: () => {},
        checkServerTrusted: () => {},
        getAcceptedIssuers: () => []
      }
    })
    return this.init([TrustManager.$new()], sr)
  }
})
```

注意：Flutter 应用使用 Dart 的 `HttpClient`，SSL pinning 可能在 Dart 层实现，需用 `frida-dexdump` 或 hook `ssl_verify_peer_cert` 函数。

---

## 七、风险与注意事项

1. **后端 host 风控**：SPA2 后端 `cnepmob.volvocars.com.cn` 可能检查 `client-version` / `deviceid` / `uuid` 的一致性，需精确模拟
2. **SSL pinning**：沃尔沃 App 是 Flutter 应用，SSL pinning 可能在 Dart AOT 层实现，绕过比原生 App 复杂
3. **proto 字段准确性**：chronos 服务的字段定义只能通过抓包反推，可能与实际有偏差
4. **特性授权**：不同车型/年款/region 支持的功能不同，必须查 FAS 后再调用，避免 502 报错
5. **2023 XC60 不受影响**：本次 SPA1 补充不影响 SPA1 车型，2023 XC60 继续走老协议
