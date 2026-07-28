# English Room 启动动画实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将已确认的 Harbor reveal 启动加载动画接入 Expo Router 根布局，在 App 初始化期间展示品牌动效，完成后淡出进入现有首屏。

**架构：** 在 `src/app/_layout.tsx` 保留 Expo Router 的原生 splash 控制，并在根布局中叠加一个纯 React Native 的 `LaunchLoadingOverlay`。动画组件只接收 `visible` 状态，不读取房间、TRTC 或评分状态；根布局在导航根状态准备好后隐藏原生 splash，保持 App 内加载层至少展示 1.2 秒，再以 180ms 淡出。

**技术栈：** Expo SDK 57、Expo Router、`expo-splash-screen`、React Native `Animated`、`react-native-svg`、Jest、React Native Testing Library。

---

### 任务 1：锁定根布局接入点与测试边界

**文件：**
- 读取：`apps/mobile/src/app/_layout.tsx`
- 读取：`apps/mobile/src/app/index.tsx`
- 读取：`apps/mobile/package.json`
- 测试参考：`apps/mobile/__tests__/app-icon.test.tsx`

- [x] **步骤 1：确认根布局拥有 Expo Router Stack，且现有页面无需改造。**

`_layout.tsx` 当前只渲染无 header 的 `Stack` 与深色 `StatusBar`，因此启动层应作为同级 overlay 放在 Stack 后面；`RoomApp` 的房间状态和 API/RTC 初始化不作为启动动画的完成条件。

- [x] **步骤 2：确认 Expo SDK 57 原生 splash 行为。**

官方文档规定通过 `SplashScreen.preventAutoHideAsync()` 延迟隐藏原生 splash，通过 `hideAsync()` 在 React 内容准备后隐藏；自定义 App 内动画应放在原生 splash 隐藏后。实现不新增动画依赖。

### 任务 2：新增启动层失败测试

**文件：**
- 创建：`apps/mobile/src/components/launch-loading-overlay.tsx`
- 测试：`apps/mobile/__tests__/launch-loading-overlay.test.tsx`

- [ ] **步骤 1：编写可观察行为测试。**

测试至少验证：

```tsx
it("shows the branded loading copy while visible", () => {
  const view = render(<LaunchLoadingOverlay visible />);
  view.getByText("A room for your voice");
  view.getByText("English Room");
  view.getByText("Preparing your room");
});

it("renders no loading content when hidden", () => {
  const view = render(<LaunchLoadingOverlay visible={false} />);
  expect(view.queryByText("Preparing your room")).toBeNull();
});

it("exposes a non-interactive accessible brand surface", () => {
  const view = render(<LaunchLoadingOverlay visible />);
  expect(view.getByLabelText("English Room").props.accessible).toBe(true);
  expect(view.getByLabelText("English Room").props.pointerEvents).toBe("none");
});
```

- [ ] **步骤 2：运行定向测试确认红灯。**

运行：`npm test -- --runInBand __tests__/launch-loading-overlay.test.tsx`

预期：FAIL，错误原因是 `launch-loading-overlay.tsx` 尚未导出 `LaunchLoadingOverlay`，而不是 Jest 配置或测试语法错误。

### 任务 3：实现品牌图标与启动加载层

**文件：**
- 创建：`apps/mobile/src/components/brand-mark.tsx`
- 创建：`apps/mobile/src/components/launch-loading-overlay.tsx`

- [ ] **步骤 1：实现最小品牌图标组件。**

组件使用 `react-native-svg` 绘制对话框轮廓和绿色声音波形，提供 `size` 和 `animated` 属性；动画只影响缩放、透明度和装饰性波形，不表达真实麦克风输入。

- [ ] **步骤 2：实现启动层动画。**

启动层使用全屏绝对定位、暖米白背景和 `pointerEvents="none"`。首次可见时依次启动：容器 `scale .78 → 1`、内圈淡入、波形淡入/横向展开、内容上移淡入；最终保持稳定帧。`visible=false` 时用 180ms `Animated.timing` 淡出并在结束后不再渲染可见内容。

- [ ] **步骤 3：实现 reduced-motion 分支。**

通过 `AccessibilityInfo.isReduceMotionEnabled()` 查询系统设置，并订阅变化；减少动态效果时跳过进入动画，仅保留静态品牌层和结束淡出，卸载时移除订阅。

### 任务 4：接入 Expo Router 根生命周期

**文件：**
- 修改：`apps/mobile/src/app/_layout.tsx`
- 测试：`apps/mobile/__tests__/root-layout.test.tsx`

- [ ] **步骤 1：先增加根布局行为测试。**

测试 mock `expo-splash-screen` 和导航根状态，验证根布局渲染启动层，导航 key 准备后调用 `hideAsync`，并在计时器完成后隐藏启动层；测试使用 fake timers，不等待真实时间。

- [ ] **步骤 2：调用 `preventAutoHideAsync` 并等待根导航准备。**

在 `_layout.tsx` 模块级调用 `SplashScreen.preventAutoHideAsync()`，根组件通过 `useRootNavigationState()` 判断导航 key；导航准备后调用 `SplashScreen.hideAsync()`，同时启动最短展示计时器。

- [ ] **步骤 3：把 `LaunchLoadingOverlay` 作为 Stack 同级 overlay。**

确保 overlay 位于 Stack 之后、`StatusBar` 之前，不改变现有路由结构、Android 返回键、真实 TRTC 和报告轮询。

### 任务 5：定向验证与整理

**文件：**
- 修改：`apps/mobile/__tests__/launch-loading-overlay.test.tsx`
- 修改：`apps/mobile/__tests__/root-layout.test.tsx`
- 修改：`apps/mobile/src/components/brand-mark.tsx`
- 修改：`apps/mobile/src/components/launch-loading-overlay.tsx`
- 修改：`apps/mobile/src/app/_layout.tsx`

- [ ] **步骤 1：运行定向测试确认绿灯。**

运行：`npm test -- --runInBand __tests__/launch-loading-overlay.test.tsx __tests__/root-layout.test.tsx`

预期：新增测试全部通过，且无未处理 timer、动画 listener 或 act 警告。

- [ ] **步骤 2：运行类型检查和 lint。**

运行：`npm run typecheck && npm run lint`

预期：退出码为 0，无 TypeScript error 和 ESLint error。

### 任务 6：全量验证、视觉检查与真机 APK

**文件：**
- 产物：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- 截图目录：`/tmp/english-room-audit/startup-animation/`

- [ ] **步骤 1：运行完整质量门禁。**

运行：`npm test -- --runInBand`、`npm run typecheck`、`npm run lint`、`git diff --check`。

- [ ] **步骤 2：运行 Web 手机视口验证。**

启动 Expo Web，在 390×844 和 430×932 视口分别检查启动层、淡出和登录首屏，保存截图到 `/tmp/english-room-audit/startup-animation/`，确认没有文本溢出、遮挡和不可点击区域。

- [ ] **步骤 3：构建并安装 real release APK。**

使用项目现有 release 构建命令生成 APK，安装到设备 `XSHIEYHMLRZDT8NJ`，冷启动验证原生 splash → App 内启动层 → 登录首屏；不得修改 `EXPO_PUBLIC_MEDIA_MODE=real`，不得用 Demo 媒体路径替代验证。

- [ ] **步骤 4：完成前逐项核对。**

确认启动动画不影响麦克风授权、TRTC 入房、语音活动、End room、录音/评分和报告流程；记录 APK 绝对路径、测试输出和截图目录，不提交、不推送、不部署。
