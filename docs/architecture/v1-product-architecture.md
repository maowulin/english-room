# V1 前后端架构设计

日期：2026-07-25

状态：待用户审查

## 1. 设计目标

本架构服务于原始实作题和已确认的四个页面：

1. 大厅与加入房间。
2. 房间等待与玩家准备。
3. 多人实时语音房间。
4. 局后英语评分报告。

V1 需要在短周期内形成可录屏的完整闭环，同时保留替换内存状态、进程内任务和 Fake 云服务的边界。

## 2. 核心决策

| 主题 | 决策 | 理由 |
| --- | --- | --- |
| 客户端 | Expo Development Build + Expo Router | 支持 React Native 快速开发和 TRTC 原生模块 |
| 业务后端 | FastAPI 模块化单体 | 便于快速交付、测试和后续音频处理 |
| 房间状态 | FastAPI 是业务状态真相源 | 避免将 TRTC 媒体事件误当作完整业务状态 |
| 实时媒体 | 客户端直连 TRTC | 业务后端不承担音频转发成本和延迟 |
| 房间事件 | REST 快照 + WebSocket 增量事件 | 支持重连、版本校验和多人状态同步 |
| 玩家音频 | TRTC 纯音频单流录制 | 每位玩家生成独立音频，避免评分错配 |
| 评分执行 | FastAPI 异步任务调用口语评测 | 密钥不下发客户端，集中处理重试和聚合 |
| Demo 存储 | 内存 Repository + 本地任务运行器 | 缩短开发时间，但接口允许替换 |

## 3. 系统边界

```mermaid
flowchart LR
    AppA["Expo 客户端 A"]
    AppB["Expo 客户端 B"]
    API["FastAPI 控制面"]
    WS["房间 WebSocket"]
    TRTC["腾讯云 TRTC"]
    Record["TRTC 单流录制"]
    Storage["COS / VOD"]
    Worker["评分任务运行器"]
    SOE["腾讯云口语评测"]

    AppA -->|"REST：房间命令、RTC 凭证、报告"| API
    AppB -->|"REST：房间命令、RTC 凭证、报告"| API
    AppA <-->|"成员、房间、评分事件"| WS
    AppB <-->|"成员、房间、评分事件"| WS
    WS --- API
    AppA <-->|"实时音频"| TRTC
    AppB <-->|"实时音频"| TRTC
    API -->|"开始/结束录制"| Record
    TRTC --> Record
    Record --> Storage
    Storage -->|"每位玩家独立音频"| Worker
    API --> Worker
    Worker <-->|"WSS 流式评测"| SOE
    Worker -->|"结果与状态"| API
```

控制面和媒体面必须分离：

- FastAPI 管理玩家身份、房间生命周期、席位、准备状态、评分任务和最终报告。
- TRTC 管理入房、推流、订阅、实时音量和网络质量。
- TRTC 的远端用户上线事件只更新媒体状态，不能直接创建或删除业务玩家。

## 4. 页面与能力映射

| 路由 | 设计图 | 读取数据 | 用户命令 | 必须展示的异常 |
| --- | --- | --- | --- | --- |
| `/` | `01-room-entry.png` | 推荐剧本、最近房间、当前玩家 | 创建房间、按房间码加入 | 房间不存在、房间已满 |
| `/rooms/[roomId]/lobby` | `02-waiting-room.png` | 房间快照、席位、准备状态 | 麦克风检查、准备、开始房间 | 麦克风拒绝、成员连接中 |
| `/rooms/[roomId]/live` | `03-live-voice-room.png` | 房间进度、媒体状态、当前线索 | 静音、扬声器、结束房间 | 玩家重连、弱网、服务端断线 |
| `/rooms/[roomId]/report` | `04-score-report.png` | 每位玩家的任务和结果 | 重试失败任务、查看详情 | 等待、处理中、成功、失败 |

导航不依赖客户端猜测。客户端读取房间快照后，根据服务端状态决定目标页面：

```text
waiting -> lobby
live -> live
ending | scoring | completed | failed -> report
```

## 5. 客户端架构

### 5.1 分层

```mermaid
flowchart TD
    Routes["Expo Router 页面"]
    Features["功能组件与 ViewModel"]
    Session["RoomSessionProvider + reducer"]
    APIClient["ApiClient"]
    Realtime["RealtimeClient"]
    RTCClient["RtcClient 接口"]
    NativeRTC["TRTC 原生适配器"]
    FakeRTC["FakeRtcClient"]

    Routes --> Features
    Features --> Session
    Session --> APIClient
    Session --> Realtime
    Features --> RTCClient
    RTCClient --> NativeRTC
    RTCClient --> FakeRTC
```

页面只负责布局、导航和用户交互，不能直接调用 TRTC SDK 或解析 WebSocket 消息。

### 5.2 推荐目录

```text
apps/mobile/src/
├── app/
│   ├── index.tsx
│   └── rooms/[roomId]/
│       ├── lobby.tsx
│       ├── live.tsx
│       └── report.tsx
├── features/
│   ├── entry/
│   ├── lobby/
│   ├── live-room/
│   └── score-report/
├── room-session/
│   ├── room-session-provider.tsx
│   ├── room-session-reducer.ts
│   ├── room-session-selectors.ts
│   └── room-session-types.ts
├── services/
│   ├── api-client.ts
│   ├── realtime-client.ts
│   └── rtc/
│       ├── rtc-client.ts
│       ├── trtc-rtc-client.ts
│       └── fake-rtc-client.ts
└── theme/
```

### 5.3 客户端状态分类

| 状态 | 真相源 | 示例 |
| --- | --- | --- |
| 业务状态 | FastAPI | 房主、席位、准备状态、房间阶段、评分状态 |
| 媒体状态 | TRTC SDK | 正在说话、静音、网络质量、远端音频可用 |
| 本地 UI 状态 | 客户端 | 按钮加载、弹窗、麦克风检查进度 |

`RoomSessionProvider` 维护服务端快照和版本化事件。音量值等高频媒体数据保留在 `RtcClient` 或局部组件内，不写入全局业务状态。

### 5.4 客户端事件处理

```text
打开房间页面
  -> GET 房间快照
  -> 保存 snapshot.version
  -> 建立 WebSocket
  -> 只接受 version > currentVersion 的事件
  -> 发现版本跳跃时重新获取快照
```

客户端断线重连后必须先恢复业务快照，再恢复 TRTC 入房。这样可以避免先看到远端音频用户，却没有对应业务玩家资料。

### 5.5 RtcClient 接口

```ts
type RtcClient = {
  enterRoom(grant: RtcGrant): Promise<void>;
  leaveRoom(): Promise<void>;
  setMicrophoneMuted(muted: boolean): Promise<void>;
  subscribe(listener: (event: RtcEvent) => void): () => void;
};
```

`FakeRtcClient` 提供确定性的玩家发言、静音、弱网和重连事件，用于页面开发、Jest 和录屏兜底。真实适配器只负责把 TRTC 原生事件转换成统一的 `RtcEvent`。

## 6. 后端架构

### 6.1 模块化单体

```text
apps/api/src/english_room_api/
├── app.py
├── config.py
├── auth/
│   ├── router.py
│   ├── schemas.py
│   └── service.py
├── rooms/
│   ├── router.py
│   ├── schemas.py
│   ├── models.py
│   ├── repository.py
│   └── service.py
├── realtime/
│   ├── router.py
│   └── broadcaster.py
├── rtc/
│   ├── credentials.py
│   ├── recording.py
│   └── tencent.py
└── scoring/
    ├── router.py
    ├── schemas.py
    ├── models.py
    ├── repository.py
    ├── runner.py
    ├── service.py
    └── tencent_soe.py
```

每个业务模块包含自己的输入模型、领域行为和 Repository 接口。腾讯云 SDK 只能出现在 `rtc` 和 `scoring` 适配器中，不能进入路由或领域模型。

### 6.2 运行时组件

| 组件 | Demo 实现 | 正式产品替换 |
| --- | --- | --- |
| RoomRepository | 进程内内存 | PostgreSQL |
| Presence / 广播 | 单进程 WebSocket | Redis Presence + Pub/Sub |
| ScoreJobRepository | 进程内内存 | PostgreSQL |
| JobRunner | `asyncio` 进程内任务 | 独立 Worker + Redis 队列 |
| AudioAssetStore | 云端 URL 元数据 | PostgreSQL + COS 生命周期策略 |

路由只完成鉴权、参数解析和响应转换。房间规则、幂等性和状态迁移由 Service 承担。

## 7. 领域模型

### 7.1 核心实体

```text
Player
  player_id
  display_name
  avatar_key

Room
  room_id
  room_code
  trtc_room_id
  story_id
  host_player_id
  status
  version
  created_at
  started_at
  ended_at

RoomMember
  room_id
  player_id
  trtc_user_id
  seat_index
  ready_state
  connection_state

AudioAsset
  audio_asset_id
  room_id
  player_id
  trtc_user_id
  storage_uri
  duration_ms
  format
  status

RecordingSession
  recording_id
  room_id
  provider_task_id
  status
  started_at
  stopped_at

ScoreJob
  score_job_id
  room_id
  player_id
  audio_asset_id
  status
  attempt
  error_code

ScoreResult
  overall
  pronunciation
  fluency
  task_completion
  vocabulary
  speaking_seconds
  utterance_count
```

`player_id`、`trtc_user_id`、`audio_asset_id` 和 `score_job_id` 必须显式存储，不能依赖文件名或数组下标推断玩家。

### 7.2 房间状态机

```mermaid
stateDiagram-v2
    [*] --> waiting
    waiting --> live: 房主开始且成员满足规则
    live --> ending: 房主结束
    ending --> scoring: 录制资产已确认
    scoring --> completed: 所有任务进入终态（允许部分失败）
    ending --> failed: 录制启动或收尾失败
```

房间的 `completed` 表示所有玩家任务都进入终态，不表示所有评分都成功。单个玩家的评分状态独立维护。

### 7.3 评分状态机

```mermaid
stateDiagram-v2
    [*] --> waiting
    waiting --> processing: Worker 领取
    processing --> success: 结果校验通过
    processing --> failed: 云服务或音频失败
    failed --> waiting: 用户或系统重试
```

同一 `room_id + player_id + audio_asset_id` 只允许一个有效任务。重试递增 `attempt`，不创建无法追踪的新玩家结果。

## 8. API 与实时事件

### 8.1 REST API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/v1/guest-sessions` | 创建 Demo 玩家身份和短期访问令牌 |
| `POST` | `/v1/rooms` | 创建房间 |
| `GET` | `/v1/rooms/by-code/{roomCode}` | 查询可加入房间 |
| `POST` | `/v1/rooms/{roomId}/members` | 加入房间并分配席位 |
| `GET` | `/v1/rooms/{roomId}` | 获取完整房间快照 |
| `PUT` | `/v1/rooms/{roomId}/members/me/ready` | 更新准备状态 |
| `POST` | `/v1/rooms/{roomId}/start` | 房主开始房间 |
| `POST` | `/v1/rooms/{roomId}/rtc-grants` | 获取短期 TRTC 入房凭证 |
| `POST` | `/v1/rooms/{roomId}/end` | 房主结束并触发录制收尾 |
| `GET` | `/v1/rooms/{roomId}/report` | 获取所有玩家评分状态和结果 |
| `POST` | `/v1/score-jobs/{jobId}/retry` | 重试失败任务 |

写操作携带 `Idempotency-Key`。房主命令还需要提交客户端看到的 `room_version`，版本不匹配时返回 `409` 并要求客户端刷新快照。

### 8.2 WebSocket

```text
GET /v1/rooms/{roomId}/events
Authorization: Bearer <access-token>
```

事件信封：

```json
{
  "event_id": "evt_01",
  "room_id": "room_01",
  "version": 12,
  "type": "member.ready_changed",
  "occurred_at": "2026-07-25T12:00:00Z",
  "payload": {}
}
```

V1 事件类型：

- `member.joined`
- `member.left`
- `member.ready_changed`
- `room.started`
- `room.ending`
- `room.scoring_started`
- `score.updated`
- `room.completed`
- `room.failed`

## 9. 关键数据流

### 9.1 创建或加入房间

```mermaid
sequenceDiagram
    participant App as Expo
    participant API as FastAPI
    participant WS as WebSocket

    App->>API: 创建 Guest Session
    App->>API: 创建或按房间码查询
    App->>API: 加入房间
    API-->>App: 房间快照 + player_id
    App->>WS: 连接房间事件
    WS-->>App: 后续成员和准备状态
```

### 9.2 开始实时语音

```mermaid
sequenceDiagram
    participant Host as 房主客户端
    participant API as FastAPI
    participant Record as TRTC 单流录制
    participant TRTC as TRTC
    participant Member as 成员客户端

    Host->>API: 开始房间(room_version)
    API->>API: 校验房主和准备状态
    API->>Record: 启动纯音频单流录制
    API-->>Host: room.started
    API-->>Member: room.started
    Host->>API: 获取短期 RTC Grant
    Member->>API: 获取短期 RTC Grant
    Host->>TRTC: enterRoom + publish audio
    Member->>TRTC: enterRoom + publish audio
    TRTC-->>Host: 订阅成员音频
    TRTC-->>Member: 订阅成员音频
```

UserSig 必须由 FastAPI 签发。腾讯云明确建议正式环境将 UserSig 计算放在服务端，客户端不能包含 `SDKSecretKey`。

### 9.3 结束房间与评分

```mermaid
sequenceDiagram
    participant Host as 房主客户端
    participant API as FastAPI
    participant Rec as TRTC 单流录制
    participant Store as COS / VOD
    participant Worker as 评分 Worker
    participant SOE as 口语评测
    participant Apps as 所有客户端

    Host->>API: 结束房间
    API->>Rec: 停止录制
    API-->>Apps: room.ending
    Rec-->>API: 每路录制完成回调
    API->>API: 按 trtc_user_id 绑定 AudioAsset
    API->>Worker: 每名玩家创建 ScoreJob
    API-->>Apps: room.scoring_started
    Worker->>Store: 读取独立音频
    Worker->>Worker: 转为 16kHz / 16bit / mono 并分段
    Worker->>SOE: WSS 流式提交
    SOE-->>Worker: 评分结果
    Worker->>API: 保存并聚合
    API-->>Apps: score.updated
```

## 10. 独立音频与评分策略

### 10.1 推荐方案

使用 TRTC 纯音频单流录制：

- 单流录制会按用户分别生成媒体文件。
- 后端使用录制白名单订阅房间成员的 `trtc_user_id`。
- 录制回调携带的用户标识必须映射到既有 `RoomMember`。
- 混流录制只能用于回放，不能作为逐玩家评分输入。

腾讯云官方资料：

- [开始云端录制](https://cloud.tencent.com/document/product/647/73786)
- [云端录制与回放](https://cloud.tencent.com/document/product/647/76497)

### 10.2 音频规范

口语评测输入统一转换为：

- 16kHz
- 16bit
- 单声道
- PCM、WAV 或服务支持的压缩格式

自由说模式单次最长支持 300 秒，因此不能把 25 分钟整段音频作为一次请求提交。

V1 策略：

- Demo 房间控制在 2—5 分钟。
- 每名玩家选择一个不超过 300 秒的有效发言片段。
- 评分任务异步执行，报告页实时显示状态变化。

正式产品策略：

- 游戏过程中按语音活动和剧情回合切出短片段。
- 逐段评测并在局后完成加权聚合。
- 原始录音、片段和评测结果都保留稳定 ID 关联。

官方资料：

- [智聆口语评测接口](https://cloud.tencent.com/document/product/1774/107497)
- [自由说评测模式](https://cloud.tencent.com/document/product/1774/107389)
- [音频与时长限制](https://cloud.tencent.com/document/product/1774/107339)

### 10.3 报告字段来源

设计图中的维度不能全部标记为腾讯云原生分数：

| UI 字段 | 数据来源 |
| --- | --- |
| 总分 | 可解释的加权聚合 |
| 发音 | `PronAccuracy` |
| 流利度 | `PronFluency` 标准化为百分制 |
| 任务完成度 | 已完成剧情提示、目标关键词或情景评测结果 |
| 词汇表现 | 识别文本中的词汇多样性和目标词覆盖率 |
| 发言次数 | 客户端或服务端语音活动片段统计 |
| 英语时长 | 玩家独立音频中的有效语音时长 |

自由说模式主要返回精准度和流利度，因此正式页面建议把设计图中的“完整度”命名为“任务完成度”，避免误导。

## 11. 安全设计

- 腾讯云 `SecretKey`、SOE 签名密钥和录制存储凭证只存在于 FastAPI 或 Worker 环境。
- UserSig 使用短有效期，并与唯一 `trtc_user_id` 绑定。
- 客户端日志不得输出完整 UserSig、访问令牌或录制 URL 签名。
- WebSocket 使用与 REST 相同的玩家访问令牌。
- 房主开始、结束和重试评分都在服务端校验权限。
- 录制回调必须校验签名和幂等处理。
- 音频对象默认私有，报告只返回短期访问地址或不返回原始音频。

## 12. 错误与恢复

| 场景 | 客户端表现 | 后端处理 |
| --- | --- | --- |
| API 暂时离线 | 保留最后快照并显示重连 | 无状态变更 |
| WebSocket 断线 | 显示连接中，退避重连 | 重连后允许重新拉取快照 |
| TRTC 弱网 | 玩家席位显示弱网 | 仅更新本地媒体状态 |
| 玩家离开后回来 | 席位显示重连中 | 保留成员身份和席位宽限期 |
| 录制文件延迟 | 报告页显示等待评分 | 等待回调，不重复创建任务 |
| SOE 调用失败 | 对应玩家显示评分失败 | 保存错误码并允许幂等重试 |
| 部分玩家评分失败 | 成功玩家结果可查看 | 房间仍可进入 completed |

## 13. 测试架构

### 客户端

- reducer 测试事件版本、乱序、重复事件和快照恢复。
- 页面测试四种评分状态和玩家映射。
- `FakeRtcClient` 测试发言、静音、弱网和重连。
- Maestro 覆盖加入、等待、实时房间和报告主路径。

### 后端

- Service 单元测试房间状态机和权限规则。
- Repository 合约测试保证内存与正式实现行为一致。
- API 测试状态码、幂等键和版本冲突。
- WebSocket 测试事件顺序和重连后的快照恢复。
- Fake 腾讯云适配器测试录制回调、玩家音频映射和评分重试。

### 真实云服务验收

- 两台设备使用不同 `player_id` 和 `trtc_user_id` 入房。
- 双方能互相听到语音并看到正确发言状态。
- 结束后得到两份独立音频。
- 每份音频只生成对应玩家的评分任务。
- 至少演示一次处理中和一次失败重试。

## 14. V1 实施顺序

1. 房间领域模型、内存 Repository 和 REST 快照。
2. 大厅与等待房页面，完成双设备成员同步。
3. `RtcClient` Fake 和真实 TRTC 适配器。
4. 实时语音页，验证双设备音频、静音和重连。
5. 录制适配器和每玩家 `AudioAsset` 映射。
6. 评分状态机、Fake SOE 和报告页。
7. 真实 SOE 接入、失败重试和录屏脚本。

该顺序先验证最高风险的多人实时语音和独立音频，再投入评分展示细节。

## 15. 明确不做

V1 不引入以下能力：

- 微服务拆分。
- 多实例部署。
- 完整注册登录和购买流程。
- 通用聊天系统。
- 视频通话。
- 实时逐字字幕。
- 自定义推荐算法。
- 复杂排行榜。

这些能力不会提升本次试题核心闭环的可信度。

## 16. 架构验收标准

架构进入实现计划前必须确认：

- 四个页面都能映射到明确的后端数据和用户命令。
- 业务房间状态与 TRTC 媒体状态没有混用。
- 每位玩家、TRTC 用户、独立音频和评分任务存在稳定关联。
- 评分指标能说明哪些来自腾讯云，哪些由业务计算。
- Demo 组件都有 Fake 实现，真实云服务不可用时仍可开发和测试。
- 从 Demo 内存实现升级到数据库、Redis 和任务队列时不需要重写页面。
