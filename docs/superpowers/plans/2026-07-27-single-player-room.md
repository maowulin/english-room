# 单人可开始多人房间实现计划

> **面向 AI 代理的工作者：** 本计划在当前 worktree 内执行；不提交、不推送。实现必须遵循 TDD：先让行为测试失败，再修改生产代码。

**目标：** 保留 6 人多人房间形态，但 Demo 只展示当前用户和空席，当前用户 Ready 后即可单人开始故事。

**架构：** Demo 等待页不再使用假玩家数组，统一由当前用户席位加空席组成；真实模式继续由后端成员列表驱动。房间容量保持 6，开始条件只要求当前用户已准备且媒体状态可用，Live 页不渲染虚构成员。

**技术栈：** React Native、Expo、TypeScript、Jest、React Native Testing Library、FakeRoomClient。

---

### 任务 1：锁定单人房间行为的失败测试

**文件：**
- 修改：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 修改：`apps/mobile/__tests__/room-app.test.tsx`

- [ ] **步骤 1：编写失败测试**

在等待页测试中断言 Demo 只渲染一个已命名席位和五个空席，人数文案为 `Players 1 / 6`；断言 `Ready` 后 `Start story` 可用。删除依赖 Liam/Mia/Alex/Suki 的假玩家视觉断言。

在房间应用测试中断言真实 Demo 流程首屏不出现 `4 / 6 players`，而出现 `1 / 6 players`；单人 Ready 后触发开始回调。

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- --runInBand __tests__/story-screens-safe-area.test.tsx __tests__/room-app.test.tsx
```

预期：FAIL，当前实现仍渲染四个假玩家，并将大厅/等待人数固定为 4。

### 任务 2：移除 Demo 假玩家并允许单人开始

**文件：**
- 修改：`apps/mobile/src/features/session/story-screens.tsx:34-135`
- 修改：`apps/mobile/src/features/session/room-app.tsx`（仅在测试暴露出状态文案或回调不一致时调整）

- [ ] **步骤 1：实现最小 Demo 席位模型**

将 Demo 等待席位从假玩家数组改为当前用户一张席位卡和五张空席卡；当前用户名称使用既有 Demo 用户名，状态只由 `ready` 决定。等待人数使用 `1`，容量继续使用 `WAITING_ROOM_CAPACITY = 6`。

大厅房间卡人数文案改为 `1 / 6 players`，不再用 `4 / 6`。保留多人房间容量和多人入口语义。

- [ ] **步骤 2：确保开始条件仍只依赖当前用户状态**

保持以下开始条件，不增加“等待其他玩家”的门槛：

```ts
const canStart = ready && !busy && (mediaState.mode === "demo" || mediaReady(mediaState));
```

真实模式仍由后端 `members` 提供成员；Demo 模式不创建虚构远端成员。

- [ ] **步骤 3：运行目标测试确认通过**

运行：

```bash
npm test -- --runInBand __tests__/story-screens-safe-area.test.tsx __tests__/room-app.test.tsx
```

预期：新增单人房间断言通过，相关旧断言同步通过。

### 任务 3：全量验证和真机回归

**文件：**
- 验证：`apps/mobile/src/features/session/story-screens.tsx`
- 验证：`apps/mobile/__tests__/story-screens-safe-area.test.tsx`
- 验证：`apps/mobile/__tests__/room-app.test.tsx`
- 产物：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

- [ ] **步骤 1：运行全量工程检查**

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
git diff --check
```

预期：23 suites / 177 tests（或随新增测试增加）全部通过，typecheck、lint、diff check 退出码为 0。

- [ ] **步骤 2：构建并安装 Release APK**

```bash
cd apps/mobile/android
./gradlew assembleRelease
adb install -r ../build/outputs/apk/release/app-release.apk
```

预期：`BUILD SUCCESSFUL`，安装到 `899L59XWGYTCYDLZ` 成功。

- [ ] **步骤 3：执行真实 UI 流程并截图**

清理 App 状态后通过真实登录和创建房间操作进入等待页，检查并截图：

1. 大厅显示 `1 / 6 players`；
2. 等待页显示当前用户一张卡片和五个空席；
3. 未 Ready 时 `Start story` 禁用；
4. Ready 后可直接单人 Start；
5. Live 页没有虚构远端玩家；
6. Report 页仍可正常返回。

记录截图路径、设备 ID、APK 时间戳和最终工作树状态；不提交或推送。
