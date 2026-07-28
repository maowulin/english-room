# UI 严格还原实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans（当前会话内联执行）。

**目标：** 将五个 RN 页面按高保真设计稿重做，并保持现有 Demo/真实后端状态流转。

**架构：** 保留 `RoomApp` 状态机、`AuthScreen`、`story-screens` 的公开组件接口，只在页面内部建立设计 token、装饰组件和状态卡片。所有 API、RTC、评分轮询行为保持原实现。

**技术栈：** React Native、Expo、StyleSheet、Safe Area、Jest、TypeScript、Expo Web。

---

### 任务 1：建立共享视觉 token 与装饰组件

**文件：**
- 修改：`apps/mobile/src/features/session/auth-screen.tsx`
- 修改：`apps/mobile/src/features/session/story-screens.tsx`

- [ ] 提取墨绿、薄荷绿、暖白、金色、危险色、圆角、间距和 serif 标题样式。
- [ ] 添加可访问的分隔线、状态徽章、头像、故事封面和底部操作栏组件。
- [ ] 保持现有 accessibilityLabel、testID 和回调签名。

### 任务 2：还原登录/注册页

**文件：**
- 修改：`apps/mobile/src/features/session/auth-screen.tsx`
- 测试：`apps/mobile/__tests__/room-app.test.tsx`

- [ ] 添加邮箱、密码、密码显隐、忘记密码、Apple/微信和注册切换控件。
- [ ] Demo 模式保留 guest session 提交，但放入辅助说明而不是主标题。
- [ ] 验证登录和注册切换不破坏 guest session 流程。

### 任务 3：还原大厅与等待房间

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 测试：`apps/mobile/__tests__/room-app.test.tsx`
- 测试：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`

- [ ] 重做故事卡、头像组、玩家信息、操作按钮、房间码和底部导航。
- [ ] 重做等待页标题、分享房间码、故事横幅、席位卡、状态徽章和固定底栏。
- [ ] 保证 390×844 下可滚动内容与固定底栏不重叠。

### 任务 4：还原实时房间与报告页

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 测试：`apps/mobile/__tests__/story-screens-waiting-media.test.tsx`
- 测试：`apps/mobile/__tests__/room-app-report-polling.test.ts`

- [ ] 添加深色港口氛围层、发言态头像环、线索卡、信号条和控制栏。
- [ ] 添加报告故事信息、评分环、四项指标、建议卡片和玩家状态行。
- [ ] 保留处理中、失败和重试状态的真实文案与操作。

### 任务 5：验证与浏览器回归

**文件：**
- 无新增生产文件

- [ ] 运行 `npm run typecheck`。
- [ ] 运行 `npm run lint`。
- [ ] 运行 `npm test -- --runInBand`。
- [ ] 使用 390×844 浏览器逐屏走通 guest、房间、实时控制、报告和重试。
