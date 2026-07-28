# English Room 高保真 UI 与真实语音交付计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `test-driven-development`、`systematic-debugging` 和 `verification-before-completion`；本计划在现有用户 worktree 内联执行，不提交、不推送、不部署。

**目标：** 依据已批准的真实语音与高保真规格，完成五个移动端页面、真实媒体状态表达、Web 回归和默认 Real release APK 交付。

**架构：** 保留 `RoomApp` 的 session reducer、RoomClient、RTC 工厂和报告轮询边界；页面只消费真实成员、真实 `MediaUiState` 与后端报告。Web 继续使用 Fake RTC 作为布局测试，Android release 默认创建 `TrtcNativeClient`，Real 模式不回退 Fake。

**技术栈：** Expo SDK 57 / React Native 0.86、React Native Web、TypeScript、Jest、Testing Library、Android Gradle、腾讯 TRTC 原生模块。

---

### 任务 1：用失败测试锁定本轮设计行为

**文件：**
- 修改：`apps/mobile/__tests__/room-app.test.tsx`
- 修改：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 修改：`apps/mobile/__tests__/story-screens-waiting-media.test.tsx`

- [ ] **步骤 1：编写失败测试**
  - 将 Guest 次级按钮断言改为高度约 48px、全宽，并保留唯一 `Demo guest` 入口。
  - 增加注册页无 Guest、等待页无 `Test microphone`、Live 页无 `More` 且只有 `Mute`/`Speaker`/`End room` 的断言。
  - 增加等待横幅最多两行、标题单行、空位显示 `Open seat`/`Waiting to join`、Live 单人只渲染真实成员的断言。
  - 增加 Real RTC 未收到语音活动时不显示 `Your voice is being received`，收到回调后才显示的断言。

- [ ] **步骤 2：运行测试确认红灯**
  - 运行：`cd apps/mobile && npx jest __tests__/room-app.test.tsx __tests__/story-screens-safe-area.test.tsx __tests__/story-screens-waiting-media.test.tsx --runInBand`
  - 预期：旧 Guest 高度、旧等待按钮和旧 Live 控件相关断言失败，失败原因必须指向目标行为而非测试配置。

### 任务 2：接入独立头像素材并完成登录/大厅

**文件：**
- 新增：`apps/mobile/assets/design/avatar-harbor-woman.png`
- 新增：`apps/mobile/assets/design/avatar-harbor-man.png`
- 新增：`apps/mobile/assets/design/avatar-harbor-curly.png`
- 新增：`apps/mobile/assets/design/avatar-harbor-elder.png`
- 新增：`apps/mobile/assets/design/avatar-harbor-scarf.png`
- 修改：`apps/mobile/src/features/session/auth-screen.tsx`
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 测试：`apps/mobile/__tests__/room-app.test.tsx`

- [ ] **步骤 1：建立头像资源映射**
  - 使用静态 `require` 资源数组，头像组件按索引读取独立方形图，不再引用 `LOBBY_PORTRAIT_CROPS` 或 `01-room-entry.png` 的头像裁切。

- [ ] **步骤 2：实现最小页面变更**
  - Guest 按钮设为全宽、至少 48px、次级填充与正式图标；注册分支不渲染它。
  - 大厅只显示当前真实用户头像，容量使用 `5 open seats`，不创建虚假玩家。

- [ ] **步骤 3：运行相关测试确认通过**
  - 运行：`npx jest __tests__/room-app.test.tsx --runInBand`
  - 预期：登录、大厅和入口边界测试通过。

### 任务 3：完成等待页 Ready 与响应式布局

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 修改：`apps/mobile/src/features/session/room-app.tsx`
- 测试：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 测试：`apps/mobile/__tests__/story-screens-waiting-media.test.tsx`

- [ ] **步骤 1：实现等待页布局**
  - 删除 `Test microphone`，左侧统一为 `Ready`；Real 模式仅在权限、grant、TRTC joined 后启用并提交 ready。
  - 将 `Harbor Mystery` 设为单行可缩放标题；横幅正文居中且最多两行；席位只表达真实成员与空位。
  - 保留安全区底栏与单人 `Start story` 能力，错误时提供 `Retry voice connection` 内联操作。

- [ ] **步骤 2：运行等待测试确认通过**
  - 运行：`npx jest __tests__/story-screens-safe-area.test.tsx __tests__/story-screens-waiting-media.test.tsx --runInBand`
  - 预期：安全区、Real 媒体错误、Ready/Start 行为全部通过。

### 任务 4：完成 Live 与 Report 的真实状态呈现

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 修改：`apps/mobile/src/features/session/room-app.tsx`
- 修改：`apps/mobile/src/services/trtc-native-client.ts`
- 修改：`apps/mobile/src/services/rtc-client.ts`
- 测试：`apps/mobile/__tests__/room-app.test.tsx`
- 测试：`apps/mobile/__tests__/room-app-realtime.test.tsx`
- 测试：`apps/mobile/__tests__/trtc-native-client.test.ts`

- [ ] **步骤 1：定义真实音量活动状态**
  - 在 `RtcClient` 回调边界传递本地音量是否非零；只有 Native TRTC volume callback 触发后才让 Live 显示 `Your voice is being received`。

- [ ] **步骤 2：实现 Live 页面**
  - 顶部按返回、标题/连接状态、计时分层；按真实成员数量使用 1 人居中、2 人双列、3–6 人网格；删除 `More`。
  - 底部只保留 `Mute`、`Speaker`、`End room`，断线/静音状态来自真实媒体状态。

- [ ] **步骤 3：保持 Report 真实**
  - Real 模式只显示后端报告数据；Completeness/Vocabulary 缺失显示 `—`；录音或评分未完成时不显示成功评价。

- [ ] **步骤 4：运行相关测试确认通过**
  - 运行：`npx jest __tests__/room-app.test.tsx __tests__/room-app-realtime.test.tsx __tests__/trtc-native-client.test.ts --runInBand`
  - 预期：Live 控件、真实成员、语音活动和报告门控测试通过。

### 任务 5：全量验证、Web 截图和 release APK

**文件：**
- 生成：`/tmp/english-room-audit/web/` 下逐状态截图
- 生成：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- 不提交或修改无关文件。

- [ ] **步骤 1：运行全量静态与单元验证**
  - 运行：`npm test -- --runInBand`、`npm run typecheck`、`npm run lint`、`git diff --check`。
  - 记录每条命令的退出码和通过数量；失败时按 `systematic-debugging` 先定位根因再修复。

- [ ] **步骤 2：Web 手机视口回归**
  - 在 360、390、393、430 宽度逐页操作登录、注册、大厅、等待、Live、报告状态，并将截图保存到 `/tmp/english-room-audit/web/`；检查安全区、换行、遮挡、截断和无操作按钮。

- [ ] **步骤 3：构建并安装 Real release APK**
  - 将构建环境设为 `EXPO_PUBLIC_MEDIA_MODE=real`，构建 release，确认 APK 包名与默认 Real 配置；安装到 `XSHIEYHMLRZDT8NJ`。

- [ ] **步骤 4：真机主链路取证**
  - 通过正常 UI 完成授权、RTC grant、TRTC 入房、Ready、单人开始、英文说话、非零本地音量、静音/扬声器、结束、录音/评分和报告识别文本非空；截图和日志分别记录证据。
  - 若外部后端/TRTC/SOE 条件阻塞，报告精确阻塞证据，不用 Fake 或 QA 路由替代。

- [ ] **步骤 5：完成前逐项核对**
  - 依据规格逐项检查 UI、真实媒体、报告、Web 截图和 APK；最终只报告有新鲜命令输出或设备日志支持的结论。
