# 轮流发言与个人评分隔离实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans（推荐在当前会话内执行）。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 将多人房间改为服务端控制的顺序发言，并让报告只返回当前玩家自己的评分。

**架构：** 后端在 `rooms` 表保存当前发言人和完成进度，新增完成回合命令并通过现有实时房间快照广播；App 从快照渲染轮次并调用完成回合接口。报告路由把认证玩家传入报告服务，SQL 层过滤 `player_id`。

**技术栈：** FastAPI、SQLite、Pydantic、React Native/Expo SDK 57、TypeScript、Jest、pytest。

---

### 任务 1：后端轮次状态与报告权限测试

**文件：**
- 修改：`english-room-backend/tests/test_player_rooms_api.py`
- 修改：`english-room-backend/tests/test_recording_scoring_api.py`
- 修改：`english-room-backend/tests/conftest.py`（仅在复用 fixture 需要时）

- [ ] 编写失败测试：两个玩家按加入顺序只能依次完成回合，未完成全部回合前房主结束返回 409，最后一位完成后房主可以结束。
- [ ] 编写失败测试：非当前玩家完成回合返回 409；非房主完成全部回合后尝试结束返回 403。
- [ ] 编写失败测试：两个玩家分别请求报告时，各自响应只包含自己的 `score_jobs`。
- [ ] 运行 `uv run pytest -q tests/test_player_rooms_api.py tests/test_recording_scoring_api.py`，确认新断言因接口/状态字段不存在而失败。

### 任务 2：实现后端轮次状态机和个人报告过滤

**文件：**
- 修改：`english-room-backend/src/english_room_backend/db.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/models.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/service.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/routes.py`
- 修改：`english-room-backend/src/english_room_backend/recording/routes.py`
- 修改：`english-room-backend/src/english_room_backend/recording/service.py`

- [ ] 给 `rooms` 增加 `turn_index`、`completed_turn_count`、`current_speaker_player_id` 及启动迁移默认值。
- [ ] 扩展 `RoomSnapshot`，`start` 初始化最早加入成员为当前发言人，并实现原子 `complete_turn`。
- [ ] 新增 `/turn/complete` 路由；在 `end` 中要求 `completed_turn_count == member_count`。
- [ ] 将当前认证玩家传入 `RecordingService.report(room_id, player_id)`，SQL 只查询该玩家的评分任务。
- [ ] 重跑任务 1 测试至通过。

### 任务 3：App 客户端契约和实时状态测试

**文件：**
- 修改：`english-room-tonight/app/apps/mobile/src/services/room-client.ts`
- 修改：`english-room-tonight/app/apps/mobile/src/services/realtime-client.ts`
- 修改：`english-room-tonight/app/apps/mobile/src/features/session/session-reducer.ts`
- 修改：`english-room-tonight/app/apps/mobile/__tests__/room-client.test.ts`（或现有对应测试文件）
- 修改：`english-room-tonight/app/apps/mobile/__tests__/realtime-client.test.ts`

- [ ] 先写失败测试：Room 映射保留当前发言人和回合计数，`completeTurn` 使用版本化 POST，实时快照能传递轮次字段。
- [ ] 运行对应 Jest 测试确认失败。
- [ ] 实现 `completeTurn`、FakeRoomClient 行为、HTTP 映射和实时类型解析。
- [ ] 重跑对应 Jest 测试至通过。

### 任务 4：Live UI 轮次交互和结束权限

**文件：**
- 修改：`english-room-tonight/app/apps/mobile/src/features/session/room-app.tsx`
- 修改：`english-room-tonight/app/apps/mobile/src/features/session/story-screens.tsx`
- 修改：`english-room-tonight/app/apps/mobile/src/features/session/session-reducer.ts`
- 修改：`english-room-tonight/app/apps/mobile/__tests__/room-app.test.tsx`
- 修改：`english-room-tonight/app/apps/mobile/__tests__/story-screens-waiting-media.test.tsx`（如 Live 控件测试复用）

- [ ] 先写失败测试：当前玩家显示 `Finish turn`，非当前玩家显示等待文案；未完成全部回合时房主结束按钮不可用；最后一位完成后结束按钮可用。
- [ ] 运行对应 Jest 测试确认失败。
- [ ] 实现服务端轮次快照到 Live 页的状态同步、完成回合动作、当前玩家 RTC 静音/发言提示和房主结束权限。
- [ ] 把报告页数据源改成接口返回的单条个人结果，保留处理/失败/完成状态展示。
- [ ] 重跑对应 Jest 测试至通过。

### 任务 5：全量验证与线上双游客回归

**文件：**
- 无新增生产文件；必要时修改上述测试文件。

- [ ] Backend 运行 `uv run pytest -q`、`uv run ruff check src tests scripts`、`uv run mypy src`、`git diff --check`。
- [ ] Mobile 运行 `npm test -- --runInBand`、`npm run typecheck`、`npm run lint`、`git diff --check`。
- [ ] 构建后端线上镜像并部署，执行两游客 API/Web 测试：创建、加入、准备、开始、按顺序完成回合、提前结束被拒、房主结束、两份报告互相隔离。
- [ ] 用手机尺寸 Web 页面检查 `Your turn`、`Finish turn`、禁用/启用 `End room` 和个人报告布局。
- [ ] 提交后端和 App 分开的中文 Conventional Commit，并报告验证证据。
