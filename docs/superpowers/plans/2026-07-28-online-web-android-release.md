# 线上 Web 验收与原生 Android Release 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 使用线上 FastAPI 完成 Web 多人房间验收，并通过 Android Gradle 原生工程产出可安装的正式 release APK。

**架构：** Web 继续复用 React Native Web 页面，但将 API base URL 指向线上 VM；浏览器只验证控制面和 UI 状态，不把浏览器媒体结果作为 TRTC 真实语音证据。Android 使用已有 prebuild 原生工程和 `android/gradlew assembleRelease`，不使用 Expo Go 或开发客户端。

**技术栈：** Expo SDK 57 / React Native 0.86、React Native Web、FastAPI、TRTC Native SDK、Android Gradle、Maestro/浏览器自动化。

---

### 任务 1：线上 Web 环境与验证基线

**文件：**
- 修改：`apps/mobile/.env.local`
- 修改：线上 VM 的运行时环境文件（不进入 Git）
- 验证：`apps/mobile/scripts/` 现有 Web 测试脚本与线上 API

- [x] 将 Web/API base URL 指向 `http://111.230.56.187:8000`，保持 `EXPO_PUBLIC_MEDIA_MODE=real`。
- [x] 为本地 Web origin 配置线上 API CORS，并重启后端容器。
- [x] 用健康检查、游客 session、房间 API smoke 证明线上控制面可用。

### 任务 2：双 Web 页面多人房间验收

**文件：**
- 修改：仅在发现真实缺陷时修改对应 `apps/mobile/src/features/session/` 或 `apps/mobile/src/services/` 文件
- 测试：`apps/mobile/__tests__/` 对应回归测试
- 产物：`/Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/outputs/english-room-online-web-20260728/`

- [x] 启动 Web，使用两个独立浏览器上下文分别创建游客、建房和按房号加入。
- [x] 验证两侧都显示准确的两位成员、身份区分、随机英文名和房主标识。
- [x] 验证只有房主能 start/end，成员端不能结束房间。
- [x] 验证等待、Live、Mute、Speaker、End room、Report processing/完成状态和小手机视口滚动。
- [x] 截图记录每个关键状态，并把浏览器媒体限制明确标注为非真实 TRTC 证据。

### 任务 3：原生 Android release 构建与安装

**文件：**
- 检查：`apps/mobile/android/`
- 检查：`apps/mobile/app.json`、`apps/mobile/.env.local`
- 产物：`/Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/outputs/english-room-android-release-20260728/`

- [x] 保留既有 Android 构建输出与签名配置，不触碰用户已有改动。
- [x] 使用 `./gradlew assembleRelease` 构建，不调用 Expo Go/EAS/开发客户端。
- [x] 检查 APK applicationId、release variant、媒体模式和线上 API 地址。
- [x] 安装到设备 `899L59XWGYTCYDLZ`，启动并验证登录页。

### 任务 4：最终验证与交付核对

- [x] 运行移动端全量 Jest、typecheck、lint、diff check。
- [x] 记录 Web 截图目录、APK 绝对路径、构建日志、线上 API smoke 结果和真机安装结果。
- [x] 明确报告：本轮 Web/单设备启动检查没有冒充真实 TRTC 录音、识别和评分通过。
