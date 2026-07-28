# 多 tab 多人房间验证实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让多个 Web tab 共享真实 FastAPI 房间控制面，只有创建房间的房主可以结束房间，并用自动化测试和多 tab 浏览器验证成员加入、准备、开始和权限边界。

**架构：** Web 端使用 `HttpRoomClient` 连接真实后端；后端为房间保存 `owner_player_id` 并在 start/end 服务层强制校验房主权限。房间事件通过后端 WebSocket 广播给已连接 tab；Web 只验证控制面和状态同步，真实 TRTC 语音与云端评分仍必须由真机验证。

**技术栈：** React Native Expo Web、TypeScript、FastAPI、SQLite、WebSocket、Jest、pytest。

---

### 任务 1：建立失败测试并确认现有根因

**文件：**
- 修改：`apps/mobile/__tests__/http-room-client.test.ts`
- 修改：`english-room-backend/tests/test_player_rooms_api.py`
- 创建：`english-room-backend/tests/test_room_realtime_api.py`

- [ ] **步骤 1：编写失败测试**
  - 断言后端创建房间响应包含 `owner_player_id`。
  - 断言非房主调用 `/start` 和 `/end` 返回 403。
  - 断言房主可结束房间。
  - 断言 WebSocket 连接能收到初始 `room.snapshot`。
  - 断言 Web 运行时默认使用 `HttpRoomClient` 而不是每 tab 独立的 `FakeRoomClient`。

- [ ] **步骤 2：运行测试确认失败**
  - Backend：`cd /Users/wulin/other/english-room-workspace/english-room-backend && .venv/bin/pytest -q tests/test_player_rooms_api.py tests/test_room_realtime_api.py`
  - Mobile：`cd /Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/work/english-room-tonight/app/apps/mobile && npm test -- --runInBand __tests__/http-room-client.test.ts`
  - 预期失败原因：当前 `rooms` 表没有房主字段，后端未注册 WebSocket 路由，Web 端固定实例化 `FakeRoomClient`。

### 任务 2：补齐后端房主模型和权限

**文件：**
- 修改：`english-room-backend/src/english_room_backend/db.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/models.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/service.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/routes.py`
- 修改：`english-room-backend/tests/test_player_rooms_api.py`

- [ ] **步骤 1：在现有 schema 初始化中增加可迁移的 `owner_player_id` 列**
  - 新建房间时写入创建者 ID；已有 SQLite 数据库通过 `PRAGMA table_info` 检测后补列，不删除现有数据。

- [ ] **步骤 2：把房主 ID 加入 `RoomSnapshot` 和 App 端映射所需的 JSON**
  - `create_room` 接收当前玩家并将其作为房主。
  - `join` 只增加成员，不改变房主。

- [ ] **步骤 3：在 Service 层强制房主权限**
  - `start` 和 `end` 在成员校验后校验 `player.player_id == owner_player_id`。
  - 非房主返回可区分的 `RoomForbidden`，路由转换为 HTTP 403。

- [ ] **步骤 4：运行后端测试确认通过**
  - `cd /Users/wulin/other/english-room-workspace/english-room-backend && .venv/bin/pytest -q tests/test_player_rooms_api.py`

### 任务 3：补齐后端房间 WebSocket 快照和广播

**文件：**
- 创建：`english-room-backend/src/english_room_backend/realtime/routes.py`
- 修改：`english-room-backend/src/english_room_backend/main.py`
- 修改：`english-room-backend/src/english_room_backend/rooms/service.py`
- 创建：`english-room-backend/tests/test_room_realtime_api.py`

- [ ] **步骤 1：实现按房间维护连接的广播器**
  - WebSocket 连接通过 bearer token 鉴权并确认玩家是房间成员。
  - 连接成功立即发送当前版本的 `room.snapshot`。
  - 房间成员加入、ready、start、end 后广播版本递增的 `room.updated`。

- [ ] **步骤 2：在房间路由动作成功后触发广播**
  - 广播失败不能回滚已经提交的房间状态；REST 仍是业务真相源。

- [ ] **步骤 3：运行 realtime 测试**
  - `cd /Users/wulin/other/english-room-workspace/english-room-backend && .venv/bin/pytest -q tests/test_room_realtime_api.py`

### 任务 4：让 Web tab 使用真实房间控制面并显示房主状态

**文件：**
- 修改：`apps/mobile/src/features/session/room-app.tsx`
- 修改：`apps/mobile/src/services/room-client.ts`
- 修改：`apps/mobile/src/features/session/session-reducer.ts`
- 修改：`apps/mobile/src/features/session/story-screens.tsx`
- 修改：`apps/mobile/__tests__/room-app.test.tsx`
- 修改：`apps/mobile/__tests__/http-room-client.test.ts`

- [ ] **步骤 1：把 Web 的默认 RoomClient 改为 HTTP 后端客户端**
  - Web 使用 `HttpRoomClient({ baseUrl: resolveApiBaseUrl() })`。
  - Web 仍使用 Fake media UI；不得把 Web 的 Fake RTC 当作真实语音证据。

- [ ] **步骤 2：在 Room 类型和 session state 中保留 `ownerPlayerId`**
  - 从后端快照映射房主字段。
  - 只有当前玩家是房主时才启用 Start/End；非房主显示不可执行状态。
  - 后端权限仍是最终安全边界，客户端禁用只用于体验。

- [ ] **步骤 3：运行移动端定向测试确认通过**
  - `cd /Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/work/english-room-tonight/app/apps/mobile && npm test -- --runInBand __tests__/room-app.test.tsx __tests__/http-room-client.test.ts`

### 任务 5：多 tab 控制面验证

**文件：**
- 创建：`docs/validation/2026-07-28-multi-tab-room.md`
- 证据目录：`/Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/outputs/english-room-multi-tab/`

- [ ] **步骤 1：启动真实后端和 Web**
  - 确认 Web 使用真实 API URL。
  - 打开 3 个 tab，分别创建游客会话。

- [ ] **步骤 2：验证房间协作**
  - Tab A 创建房间并记录 room code。
  - Tab B、C 使用 room code 加入。
  - 确认 A/B/C 都看到同一成员集合和 ready 状态。
  - 确认 B/C 不能结束房间，A 可以结束房间。

- [ ] **步骤 3：明确 Web 的验证边界**
  - Web 截图只证明真实后端房间控制面、成员同步和房主权限。
  - 语音采集、TRTC 入房、云录音、SOE 识别和评分必须在真机完成，不能用 Web Fake media 或静态报告冒充。

### 任务 6：全量验证

- [ ] `cd /Volumes/SeamlessSSD/MacOffload/wulin/CodexWork/work/english-room-tonight/app/apps/mobile && npm test -- --runInBand`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `git diff --check`
- [ ] `cd /Users/wulin/other/english-room-workspace/english-room-backend && .venv/bin/pytest -q`
- [ ] 检查工作树，保留用户和前序未提交改动，不提交、不推送、不部署。
