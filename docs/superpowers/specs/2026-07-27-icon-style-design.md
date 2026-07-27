# English Room 图标统一设计规格

## 背景

当前登录、房间大厅、等待房间、实时语音和报告页面使用了多种 Unicode 字符作为图标，例如 `♩`、`▣`、`⌂`、`‹` 和 `⇧`。这些字符依赖系统字体渲染，会在 Android 与 iOS 之间产生基线、字面比例、线宽和视觉重量差异。

## 目标

- 使用统一的矢量图标库替换页面中的 Unicode 图标。
- 保持当前 English Room 的深绿、纸张色和文学感，不改变已确认的页面布局与业务流程。
- 统一图标尺寸、描边、颜色、对齐方式和点击区域。
- 保证图标在浏览器移动尺寸和 Android 真机上的视觉比例一致。

## 非目标

- 不重新设计页面布局、颜色系统、字体或背景插画。
- 不修改登录、房间、RTC、评分和游客会话业务逻辑。
- 不在本次改动中接入真实 TRTC/SOE。

## 方案

使用 `lucide-react-native` 作为图标源，配合 `react-native-svg` 渲染矢量图标。页面不直接依赖第三方图标组件，统一通过 `AppIcon` 封装，以便集中控制默认尺寸、描边和颜色。

默认规范：

- 尺寸：输入框和普通按钮 20 px；导航与操作按钮 22 px；装饰图标 18–20 px。
- 描边：`1.75`。
- 线帽与拐角：`round`。
- 默认颜色：`#174638`；深色实时页使用页面指定的浅色 token。
- 点击区域：交互图标外围至少 44×44 px；装饰图标不可单独获得焦点。
- 图标与文字通过布局 `gap` 对齐，禁止使用空格或 Unicode 字符占位。

## 图标目录

| 场景 | 图标 |
| --- | --- |
| 登录表单 | `Mail`、`LockKeyhole`、`Eye`、`EyeOff`、`UserRound` |
| 导航 | `ArrowLeft`、`House`、`DoorOpen`、`UserRound`、`ChevronRight` |
| 房间大厅 | `Mic`、`Share2`、`Grid2X2`、`UsersRound`、`Clock3` |
| 等待房间 | `Mic`、`Check`、`Upload`、`RefreshCw` |
| 实时语音 | `Mic`、`MicOff`、`Volume2`、`VolumeX`、`Signal`、`MoreHorizontal`、`Anchor` |
| 报告 | `Lightbulb`、`Check`、`AlertCircle`、`RotateCcw`、`Clock3` |
| 装饰 | `BookOpen`、`Sparkles` |

## 组件边界

`AppIcon` 接收图标名称、尺寸、颜色、描边宽度和可选的交互属性，负责将库组件转换为项目统一的视觉与无障碍行为。页面组件只传递语义名称，不直接传递 Unicode 字符。

按钮与输入框继续由现有页面组件负责布局；`AppIcon` 不负责文字、背景、点击事件或业务状态。密码显示状态、麦克风静音状态和真实/Mock 模式仍由现有页面状态控制，只切换对应的图标名称。

## 错误与兼容处理

- 图标名称使用 TypeScript 联合类型，非法名称在编译期失败。
- 如果库组件无法在当前平台加载，构建应失败，不回退到 Unicode 字符，避免重新引入跨平台比例问题。
- 深色实时页面必须显式传入浅色颜色，不能依赖默认深绿色。
- 图标加载不参与 API、游客登录或 RTC 请求；图标异常不会改变业务状态机。

## 验证计划

- 新增 `AppIcon` 映射与默认属性测试。
- 更新登录、房间和报告页面测试，确认关键按钮仍有原有 accessibility label 与 testID。
- 运行 `npm run typecheck`、`npm test -- --runInBand` 和 `npm run lint`。
- 使用浏览器移动尺寸 390×844 检查登录、大厅、等待、实时和报告页面。
- 在已连接 Android 真机上检查输入框、底部导航、实时控制栏和报告操作按钮的尺寸、基线与触控区域。
