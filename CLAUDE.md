# 项目准则

## 范围限定

本项目仅分析 **SPA1 平台**（`vehicle_type=vcar`）。SPA2（`hf_` 前缀）不在本项目范围内。

## 决策依据

任何流程、逻辑、字段含义的判断，**必须以官方 APK 为准**，禁止猜测。

- **`tools/apk/沃尔沃汽车_5.67.0.apk`** — 唯一权威来源。libapp.so 字符串、Flutter assets、proto 定义等直接提取的证据才可作为决策依据。
- **`tools/volvo-tool/`**、**`server/src/proto/`**、**`docs/spa1-api-reference.md`** 等均系本项目自写工具/文档，暂时可用但不具权威性，不可作为最终裁决依据。

## 辅助来源

其他项目（Home Assistant 集成、第三方库等）仅做辅助参考，不得覆盖 APK 直接证据。
