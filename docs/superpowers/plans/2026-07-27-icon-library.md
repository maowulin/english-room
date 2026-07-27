# English Room 图标库统一替换实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 使用统一的 Lucide 风格矢量图标替换 App 中依赖 Unicode 字符的图标，修复跨平台基线、比例和线宽不一致问题。

**架构：** 安装 `lucide-react-native` 与 Expo 兼容的 `react-native-svg`，新增 `AppIcon` 语义封装集中管理图标名称、尺寸、颜色和描边；登录与故事页面只调用 `AppIcon`，不再直接渲染 Unicode 图标。业务状态、页面布局和 API/RTC 流程保持不变。

**技术栈：** Expo SDK 57、React Native 0.86、TypeScript、lucide-react-native、react-native-svg、Jest、React Native Testing Library。

---

### 任务 1：接入图标依赖并锁定统一组件契约

**文件：**
- 修改：`apps/mobile/package.json`
- 修改：`apps/mobile/package-lock.json`
- 创建：`apps/mobile/src/components/app-icon.tsx`
- 创建：`apps/mobile/__tests__/app-icon.test.tsx`

- [ ] **步骤 1：安装运行时依赖**

运行：

```bash
cd /Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/work/english-room-tonight/app/apps/mobile
npx expo install react-native-svg
npm install lucide-react-native
```

预期：`package.json` 与 `package-lock.json` 新增 `react-native-svg`、`lucide-react-native`，安装命令退出码为 0。

- [ ] **步骤 2：先编写失败测试，定义 `AppIcon` 的映射和默认值**

在 `apps/mobile/__tests__/app-icon.test.tsx` 覆盖：

```tsx
it("renders the semantic microphone icon with the shared defaults", () => {
  const view = render(<AppIcon name="mic" testID="mic-icon" />);
  expect(view.getByTestId("mic-icon")).toBeTruthy();
});

it("supports explicit size and color for dark surfaces", () => {
  const view = render(<AppIcon name="volume" size={22} color="#E8FFF6" testID="volume-icon" />);
  expect(view.getByTestId("volume-icon")).toBeTruthy();
});

it("does not expose decorative icons as accessible controls", () => {
  const view = render(<AppIcon name="sparkles" decorative testID="sparkles-icon" />);
  expect(view.getByTestId("sparkles-icon").props.accessible).not.toBe(true);
});
```

运行：`npm test -- --runInBand __tests__/app-icon.test.tsx`

预期：测试先失败，因为 `AppIcon` 尚未创建。

- [ ] **步骤 3：实现最小 `AppIcon` 封装**

在 `apps/mobile/src/components/app-icon.tsx` 定义以下契约：

```tsx
export type AppIconName =
  | "arrow-left" | "anchor" | "alert-circle" | "book-open" | "check"
  | "chevron-right" | "clock" | "door-open" | "eye" | "eye-off"
  | "grid" | "house" | "lightbulb" | "lock" | "mail" | "mic"
  | "mic-off" | "more" | "refresh" | "share" | "signal" | "sparkles"
  | "user" | "users" | "volume" | "volume-off" | "upload";

export type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  decorative?: boolean;
  testID?: string;
};
```

使用 `Record<AppIconName, LucideIcon>` 完成名称到 Lucide 组件的映射；默认 `size=20`、`color="#174638"`、`strokeWidth=1.75`，并把 `strokeLinecap="round"`、`strokeLinejoin="round"` 传给底层图标。`decorative` 默认为 `true`，交互语义由外层 `Pressable` 的既有 `accessibilityLabel` 提供。

- [ ] **步骤 4：运行组件测试确认通过**

运行：`npm test -- --runInBand __tests__/app-icon.test.tsx`

预期：3 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/src/components/app-icon.tsx apps/mobile/__tests__/app-icon.test.tsx
git commit -m "feat(mobile): 接入统一矢量图标组件"
```

### 任务 2：替换登录页和表单图标

**文件：**
- 修改：`apps/mobile/src/features/session/auth-screen.tsx:1-180`
- 修改：`apps/mobile/__tests__/room-app.test.tsx`

- [ ] **步骤 1：增加登录页图标回归断言**

在登录页测试中断言昵称、邮箱、密码、显示密码和返回登录仍保留原有 `accessibilityLabel`，并断言页面源码/渲染树不再依赖 `♙`、`✉`、`▣`、`◉`、`◌` 作为图标内容。

- [ ] **步骤 2：替换字段、密码、返回和装饰图标**

把 `Field` 的 `icon: string` 改为 `icon: AppIconName`，并将登录页映射为：昵称 `user`、邮箱 `mail`、验证码 `clock`、密码 `lock`、密码显示状态 `eye`/`eye-off`、返回 `arrow-left`、标题装饰 `sparkles`。保持字段高度、边框、placeholder、测试 ID 和登录回调不变。

- [ ] **步骤 3：运行登录相关测试和类型检查**

运行：

```bash
npm test -- --runInBand __tests__/room-app.test.tsx
npm run typecheck
```

预期：登录相关测试通过，TypeScript 无错误。

- [ ] **步骤 4：Commit**

```bash
git add apps/mobile/src/features/session/auth-screen.tsx apps/mobile/__tests__/room-app.test.tsx
git commit -m "refactor(mobile): 统一登录页图标"
```

### 任务 3：替换大厅、等待、实时和报告页图标

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx:1-480`
- 修改：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 修改：`apps/mobile/__tests__/story-screens-waiting-media.test.tsx`
- 修改：`apps/mobile/__tests__/room-app-lifecycle.test.tsx`

- [ ] **步骤 1：先补齐页面状态图标的测试断言**

覆盖大厅创建/加入/房间码、等待准备/分享/重连、实时静音/扬声器/更多/结束、报告刷新/重试/建议等关键操作，断言既有 `accessibilityLabel` 和 `testID` 不变。

- [ ] **步骤 2：替换 `story-screens.tsx` 中所有 Unicode 图标**

使用以下语义映射：返回 `arrow-left`、logo `book-open`、大厅/房间/我的 `house`/`door-open`/`user`、标题装饰 `sparkles`、麦克风 `mic`、房间码 `grid`、分享 `share`、等待准备 `check`、重连 `refresh`、实时状态 `signal`、线索 `anchor`、静音 `mic`/`mic-off`、扬声器 `volume`/`volume-off`、更多 `more`、报告 `lightbulb`、刷新/重试 `refresh`、报告状态 `check`/`alert-circle`。

每个图标都放入固定尺寸的 `iconSlot` 或按钮内部，移除依赖多余空格的字符串布局；深色实时页显式传入浅色颜色。虚拟参与者头像中的首字母和状态文字不是图标，不做替换。

- [ ] **步骤 3：运行页面测试和 lint**

运行：

```bash
npm test -- --runInBand __tests__/story-screens-safe-area.test.tsx __tests__/story-screens-waiting-media.test.tsx __tests__/room-app-lifecycle.test.tsx
npm run lint
npm run typecheck
```

预期：指定测试全部通过、lint 无错误、typecheck 无错误。

- [ ] **步骤 4：Commit**

```bash
git add apps/mobile/src/features/session/story-screens.tsx apps/mobile/__tests__/story-screens-safe-area.test.tsx apps/mobile/__tests__/story-screens-waiting-media.test.tsx apps/mobile/__tests__/room-app-lifecycle.test.tsx
git commit -m "refactor(mobile): 统一房间流程图标"
```

### 任务 4：全量验证和视觉回归

**文件：**
- 修改：无；只生成本地构建产物和截图

- [ ] **步骤 1：运行完整验证**

运行：

```bash
cd /Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/work/english-room-tonight/app/apps/mobile
npm test -- --runInBand
npm run typecheck
npm run lint
git diff --check
```

预期：Jest 全部通过、typecheck/lint/diff check 退出码为 0。

- [ ] **步骤 2：浏览器 390×844 回归五个页面**

启动 `npm run web`，按现有 Demo 入口依次打开登录、大厅、等待、实时和报告页面，检查图标与文字基线、按钮左右间距、输入框垂直居中和底部导航对齐；确认没有 Unicode 图标残留。

- [ ] **步骤 3：Android 真机回归**

运行 `npx expo run:android`，打开 Demo 访客入口，依次创建房间、准备、开始故事，检查登录表单、房间控制栏和报告操作栏；确认图标触控区域可点击，且实时页浅色图标在深色背景上清晰可见。

- [ ] **步骤 4：Commit**

```bash
git add apps/mobile
git commit -m "test(mobile): 验证统一图标视觉回归"
```
