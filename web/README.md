# 小沃远控 Web

使用 React、TypeScript、Vite 与 shadcn/ui 构建的沃尔沃中国区车辆状态与远程控制 PWA。

## 高德地图

在高德开放平台创建 Web 端（JS API）Key，将环境变量写入 `.env.local`：

```dotenv
VITE_AMAP_KEY=你的Web端Key
VITE_AMAP_SECURITY_JS_CODE=该Key对应的安全密钥
```

也可以登录应用后，在“设置 > 高德地图”中配置；浏览器本地配置优先于部署环境变量。
车辆接口返回的 GCJ-02 坐标会直接用于地图展示，无需再做 WGS84 转换。

## 开发

```bash
npm install
npm run dev
```
