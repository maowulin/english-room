# English Room 小屏布局适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 让认证、大厅、等待、Live 和报告页面在小屏 iOS/Android 上可滚动、可点击，且内容不被底部安全区、底部导航或操作栏遮挡。

**架构：** 保持 React Native 原生尺寸，不引入 CSS `vm` 或全局比例缩放。页面主体采用 `ScrollView` 或可压缩的 flex 布局；固定底部元素保留真实占位高度，并将 `useSafeAreaInsets().bottom` 加入内容底部留白。仅在高度紧张时使用命名的 compact breakpoint 调整间距/头像尺寸。

**技术栈：** Expo SDK 57、React Native、`react-native-safe-area-context`、Jest、`@testing-library/react-native`。

---

### 任务 1：锁定小屏滚动与安全区回归

**文件：**
- 修改：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 修改：`apps/mobile/__tests__/room-app.test.tsx`

- [ ] **步骤 1：编写失败测试**

  为大厅断言存在 `lobby-scroll` 且内容底部留白包含底部导航；为报告断言存在 `report-scroll` 且内容留白包含底部安全区；为等待断言底部留白大于实际 footer 基线并包含安全区。

- [ ] **步骤 2：运行测试验证失败**

  运行：`npm test -- --runInBand __tests__/story-screens-safe-area.test.tsx __tests__/room-app.test.tsx`

  预期：FAIL，当前大厅没有滚动容器和 `lobby-scroll`，报告没有安全区底部留白。

---

### 任务 2：实现页面滚动壳层和底部占位

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 修改：`apps/mobile/src/features/session/auth-screen.tsx`

- [ ] **步骤 1：实现大厅 ScrollView**

  将大厅内容移入 `ScrollView`，使用命名的底部导航占位常量和安全区 inset，保留底部导航作为独立布局兄弟节点。

- [ ] **步骤 2：修复等待 footer 占位**

  使用 footer 的固定最小高度常量加 inset 计算滚动内容的 `paddingBottom`，继续允许 footer 固定在安全区上方。

- [ ] **步骤 3：修复报告滚动留白**

  为报告 ScrollView 增加 testID 和 `paddingBottom = reportSpacing + insets.bottom`，确保最后的 Back to lobby 按钮可滚到安全区上方。

- [ ] **步骤 4：补齐认证页滚动行为**

  为认证内容增加可滚动的 `flexGrow` 和安全区底部留白，避免注册页在小屏被系统手势区域截断。

---

### 任务 3：验证压缩视口和原生质量门禁

**文件：**
- 修改：如需调整，仅限上述页面和测试

- [ ] **步骤 1：运行页面回归测试**

  运行：`npm test -- --runInBand __tests__/story-screens-safe-area.test.tsx __tests__/room-app.test.tsx`

- [ ] **步骤 2：运行全量质量检查**

  运行：`npm test -- --runInBand`、`npm run typecheck`、`npm run lint`、`git diff --check`。

- [ ] **步骤 3：运行 Web 小屏回归**

  使用 320×568、375×667、390×844 三个手机视口，逐页确认大厅/等待/Live/报告最后一个操作控件可见且能通过纵向滚动到达；截图保存到外置盘输出目录。

