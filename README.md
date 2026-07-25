# English Room Demo

一个面向候选人实作题的多人英语实时语音房间 Demo。

本仓库是公开交付的 React Native Expo 客户端。私有 FastAPI 后端和私有运营平台分别维护在独立仓库。

## 当前目标

- 支持多名玩家进入同一房间并保持成员状态一致。
- 使用腾讯云实时音视频（TRTC）实现实时语音。
- 在房间结束后处理玩家英语语音并生成口语评分。
- 正确关联玩家、音频、评分任务和最终结果。
- 展示等待、处理中、成功和失败等关键状态。

## 已确认的技术选择

- 客户端：React Native Expo
- 客户端运行方式：Expo Development Build
- 后端：Python FastAPI
- 运营平台：React Web 管理站，通过 App 的通用 WebView 容器加载
- 监控与基础业务分析：Sentry
- 长期留存分析：FastAPI 第一方业务事件
- 实时音频：腾讯云 TRTC
- 口语评分：腾讯云口语评测（新版）

## 三仓边界

| 仓库 | 可见性 | 职责 | 是否交付 |
| --- | --- | --- | --- |
| `english-room` | Public | Expo App、公开 API 合约、Fake 适配器和交付文档 | 是 |
| `english-room-backend` | Private | FastAPI、房间控制面、RTC/评分编排、业务事件和管理 API | 否 |
| `english-room-op` | Private | 运营 Web、WebView 对接和管理工具 | 否 |

正式 App 包含 Sentry SDK 和业务埋点，但不包含运营页面、管理 Token 或 Sentry 查询凭证。MVP 的内部运营入口只提供通用 WebView 容器；运营页面源码通过白名单 HTTPS URL 加载，不进入 App Bundle。

当前仓库中的 `apps/api/` 是分仓前的基础框架迁移来源。后端迁移验证完成后，再用独立提交从公开仓库移除。

## 文档

- [架构讨论记录](./docs/discussions/2026-07-25-architecture-notes.md)
- [需求解读](./docs/requirements/assessment-brief.md)
- [页面设计图](./docs/design/README.md)
- [基础框架架构](./docs/architecture/foundation.md)
- [V1 前后端架构](./docs/architecture/v1-product-architecture.md)
- [基础框架验证记录](./docs/validation/2026-07-25-foundation.md)
- [原始题目副本说明](./docs/source/README.md)

## 本地运行

### 启动 FastAPI

```bash
cd apps/api
uv sync --dev
uv run uvicorn english_room_api.app:app --host 0.0.0.0 --port 8000
```

验证健康检查：

```bash
curl http://127.0.0.1:8000/health
```

### 启动 Expo Development Build

首次安装依赖并生成原生开发构建：

```bash
cd apps/mobile
npm ci
npm run ios -- --device "iPhone 16 Pro" --no-bundler
```

随后设置 Mac 的局域网 IP 并启动 Metro。真机访问 FastAPI 时也使用该地址：

```bash
export ENGLISH_ROOM_DEV_HOST=192.168.3.63

EXPO_PUBLIC_API_BASE_URL="http://${ENGLISH_ROOM_DEV_HOST}:8000" \
REACT_NATIVE_PACKAGER_HOSTNAME="${ENGLISH_ROOM_DEV_HOST}" \
npx expo start --dev-client --lan
```

请将示例 IP 替换为当前 Mac 的实际局域网 IP。若只使用 iOS 模拟器，FastAPI 地址也可使用默认值 `http://127.0.0.1:8000`。

## 当前状态

基础框架已完成：

- FastAPI 健康检查和后续鉴权、房间、评分模块边界已建立。
- Expo Development Build 已在 iOS 模拟器原生构建并打开 Demo 页面。
- 设备端冒烟测试已确认 FastAPI 在线状态和 TRTC 待接入状态。

下一阶段优先接入 TRTC，并验证两名玩家同时进入房间的实时语音链路。
