# 基础框架验证记录

日期：2026-07-25

## 验证环境

- macOS
- Xcode 26.2
- Swift 6.2.3
- iPhone 16 Pro 模拟器
- iOS 18.6
- Expo SDK 57
- Python 3.13

## 后端验证

在 `apps/api` 运行：

```bash
uv run pytest -q
uv run ruff format --check .
uv run ruff check .
uv run mypy
curl http://127.0.0.1:8000/health
```

验证结果：

- pytest：3 个测试通过。
- Ruff：格式和静态检查通过。
- mypy：严格类型检查通过。
- 健康检查返回 `{"service":"english-room-api","status":"ok"}`。

## 客户端验证

在 `apps/mobile` 运行：

```bash
npm ci
npm test
npm run typecheck
npm run lint
npx expo-doctor
npm run ios -- --device "iPhone 16 Pro"
```

验证结果：

- Jest：2 个测试套件、5 个测试通过。
- TypeScript：类型检查通过。
- ESLint：检查通过。
- Expo Doctor：20 项检查全部通过。
- Xcode：Development Build 构建成功，0 个错误、3 个上游构建警告。

## 设备端验收

使用 `apps/mobile/.maestro/foundation-smoke.yaml` 在 iPhone 16 Pro 模拟器执行冒烟测试。

验收内容：

- 页面显示 `English Room Demo`。
- 页面显示 `Expo Development Build` 和 `已启用`。
- 页面显示 `FastAPI 控制面` 和 `服务在线`。
- 页面显示 `TRTC 实时语音` 和 `下一阶段接入`。

最终结果：Maestro 共执行 11 个命令，全部成功。

## Xcode 26 兼容说明

Expo SDK 57 当前依赖的 `expo-modules-jsi@57.0.4` 在 Swift 6 与 C++ interop 环境下，对全局 `abs` 的调用会产生重载歧义，导致 Xcode 26.2 编译失败。

仓库通过 `patch-package` 将该调用限定为 `Swift.abs`。`npm ci` 会自动应用 `apps/mobile/patches/expo-modules-jsi+57.0.4.patch`，随后两次原生构建均已通过。该补丁只包含一行源码差异；上游版本包含等价修复后应删除本地补丁。

## 已知事项

- 本机 Expo CLI 自动选择的 `198.18.0.1` 地址会被 iOS App Transport Security 拒绝。启动 Metro 时应通过 `REACT_NATIVE_PACKAGER_HOSTNAME` 指定 Mac 的实际局域网 IP。
- `npm audit` 当前报告的风险来自 Expo、React Native 和测试工具的传递依赖。`npm audit fix --force` 会破坏 Expo SDK 版本兼容性，因此当前未执行；进入发布阶段前需要随上游版本继续复核。
- 当前只验证了基础运行链路，尚未接入真实 TRTC、多人房间状态或腾讯云口语评分。
