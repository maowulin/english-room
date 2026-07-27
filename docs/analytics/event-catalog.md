# English Room 第一版业务事件目录

状态：V1 设计契约

本文是公开 App、FastAPI 第一方事件表和 Sentry 两路采集共用的业务事件目录。事件名称、字段语义、隐私等级和版本只在本文维护一份；两个 Sink 可以有不同的保留期和采样率，但不能各自改写事件含义。

## 1. 设计边界

- FastAPI 是玩家身份、房间生命周期、成员状态、录制状态和评分任务的业务真相源。
- TRTC 只提供媒体面。客户端产生的媒体连接状态不能直接改变业务房间状态。
- 客户端事件用于 Sentry 的近实时观测和第一方事件接收端的补充上报；服务端拥有业务状态变更的最终裁决权。
- 第一方事件表用于 DAU、留存和长期漏斗；Sentry 用于错误、性能、Replay、功能采用率和近实时转化。两者不应重复计数。
- V1 事件目录版本为 `1.0.0`。事件的 `schema_version` 使用 `1.0`；兼容性变更规则见第 5 节。

## 2. 统一事件信封

所有事件都必须带有以下必填字段。字段值只能来自允许的枚举、稳定的业务 ID 或客户端生成的随机 ID。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_id` | string | 单次事件的 UUID 或 ULID。客户端事件在入队时生成，服务端权威事件在事务提交后生成。重试必须复用原值。 |
| `event_name` | string | 本目录中的事件名，不得自定义别名。 |
| `schema_version` | string | 当前固定为 `1.0`。 |
| `occurred_at` | string | 事件发生时间，ISO 8601 UTC；不得用发送时间替代。 |
| `user_id` | string | 伪匿名分析 ID，由客户端随机生成，不由邮箱、手机号、设备序列号或广告 ID 推导。 |
| `app_session_id` | string | 本次 App 前台会话的随机 ID。服务端权威事件没有客户端上下文时可省略。 |
| `app_version` | string | App 版本，例如 `1.0.0`。 |
| `platform` | enum | `ios` 或 `android`。 |
| `environment` | enum | `development`、`staging` 或 `production`。禁止把测试事件标成 `production`。 |
| `producer` | enum | `client` 或 `server`，表示事件的产生方。 |

通用可选字段如下；未列入目录的自由文本字段不得上报。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `room_id` | string | 不可逆推导用户身份的业务房间 ID。不得使用房间码替代。 |
| `player_id` | string | 服务端分配的稳定业务 ID；只用于受控的第一方关联。 |
| `correlation_id` | string | API 请求、WebSocket 状态变更或客户端操作的关联 ID；不得放入访问凭证。 |
| `room_version` | integer | 触发状态变更时客户端已确认的房间版本。 |
| `failure_reason_code` | enum | 预先定义的短错误码，例如 `network_timeout`、`permission_denied`、`provider_failed`；不传错误原文。 |
| `latency_ms` | integer | 客户端测量的粗粒度耗时，取值范围为 `0` 到 `600000`。 |

## 3. 事件目录

下表中的“通用必填”指第 2 节的必填信封字段；事件专属字段必须与通用字段同时存在。

### 3.1 `app_opened`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | App 进程进入前台并完成一次新的 App 会话初始化时触发。每个 `app_session_id` 只触发一次，不因页面挂载、路由切换或热重载重复触发。 |
| 必填属性 | 通用必填；`app_session_id`。 |
| 可选属性 | `entry_point`：`cold_start`、`warm_resume`、`push`、`deep_link`；`previous_app_session_gap_ms`。 |
| 隐私等级 | P0：仅运行上下文和伪匿名指标。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `app_opened + app_session_id`；网络重试复用 `event_id`。同一 App 会话不重复计入 DAU。 |
| 客户端 / 服务端责任 | 客户端在初始化成功后调用 `AnalyticsClient.track`。服务端只负责接收、校验和按 `user_id + UTC 日期` 聚合，不把它当作房间状态。 |

### 3.2 `guest_session_created`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | `POST /v1/guest-sessions` 成功创建访客身份并返回成功响应后触发；请求开始、失败或重试中不得触发。 |
| 必填属性 | 通用必填；`guest_session_id`、`session_type=guest`、`player_id`。 |
| 可选属性 | `entry_point`：`app_open`、`room_create`、`room_join`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P1：伪匿名身份和会话元数据。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 服务端以 `guest_session_id` 去重；客户端重试复用同一个 `event_id` 和 `correlation_id`。服务端创建操作必须使用幂等键。 |
| 客户端 / 服务端责任 | 服务端负责创建身份、校验幂等并写入权威记录；客户端仅在成功响应后上报。事件中禁止出现返回给客户端的访问凭证。 |

### 3.3 `room_created`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端成功提交房间创建事务，客户端收到成功响应后触发；按钮点击但创建失败不得触发。 |
| 必填属性 | 通用必填；`room_id`、`player_id`（房主）、`room_version`、`room_role=host`。 |
| 可选属性 | `story_id`；`creation_mode`：`quick_create`、`story_select`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P1：伪匿名房间和业务流程元数据。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `room_created + room_id`；服务端以房间创建幂等键和 `room_id` 兜底，客户端只重试原事件。 |
| 客户端 / 服务端责任 | 服务端负责权限、幂等和房间状态落库；客户端负责记录用户实际看到的成功结果，不根据按钮点击自行推断成功。 |

### 3.4 `room_joined`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端将玩家加入 `RoomMember` 并分配席位后触发；查询房间、输入房间码或加入失败不触发。 |
| 必填属性 | 通用必填；`room_id`、`player_id`、`room_version`、`join_method`：`room_code`、`recent_room`、`deep_link`、`invite`。 |
| 可选属性 | `seat_index`；`room_role`：`host`、`member`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P1：伪匿名房间成员关系。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `room_joined + room_id + player_id`；同一玩家离开后再次加入才产生新的事件，需使用新的 `membership_id` 作为可选服务端关联值。 |
| 客户端 / 服务端责任 | 服务端负责确认成员关系、席位和版本；客户端只在成功响应或权威 WebSocket 事件后上报。不得使用 TRTC 上线事件代替业务入房。 |

### 3.5 `room_ready_changed`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端接受玩家准备状态写入并产生新的房间版本后触发。重复提交相同状态不产生新事件。 |
| 必填属性 | 通用必填；`room_id`、`player_id`、`ready_state`：`ready`、`not_ready`、`blocked`、`room_version`。 |
| 可选属性 | `change_source`：`user`、`system`；`mic_check_state`：`not_checked`、`passed`、`failed`；`correlation_id`。 |
| 隐私等级 | P1：伪匿名准备状态和设备能力结果。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `room_ready_changed + room_id + player_id + room_version`；服务端按状态迁移幂等，客户端不得按每次渲染上报。 |
| 客户端 / 服务端责任 | 客户端提交用户操作并上报服务端确认结果；服务端校验权限、状态机和版本，并写入权威事件。 |

### 3.6 `room_started`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端将房间从 `waiting` 原子切换到 `live` 后触发；点击开始、预检失败或状态冲突不触发。 |
| 必填属性 | 通用必填；`room_id`、`room_version`、`member_count`、`ready_member_count`、`started_by_player_id`。 |
| 可选属性 | `start_mode`：`host_action`、`system_resume`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P1：伪匿名房间规模和状态。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `room_started + room_id + room_version`；房间只允许一次 `waiting -> live` 转换。 |
| 客户端 / 服务端责任 | 服务端负责成员规则、房主权限、版本迁移和权威事件；客户端收到成功响应或 `room.started` 后只上报一次。 |

### 3.7 `rtc_connection_changed`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 客户端将 TRTC SDK 的连接状态归一化为新状态时触发。只记录状态迁移，不记录音量、原始网络包或每次 SDK 回调。 |
| 必填属性 | 通用必填；`room_id`、`player_id`、`connection_state`：`connecting`、`connected`、`reconnecting`、`disconnected`、`failed`。 |
| 可选属性 | `previous_state`；`reason_code`：`network_lost`、`network_recovered`、`permission_denied`、`provider_error`；`duration_ms`；`attempt_number`。 |
| 隐私等级 | P1：伪匿名媒体连接状态。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `rtc_connection_changed + room_id + player_id + client_sequence`；相同状态连续回调丢弃，断线重试不能改写原事件。 |
| 客户端 / 服务端责任 | 客户端是媒体状态的产生方并负责节流、归一化和上报；服务端可接收状态用于观测，但不得据此创建、删除业务成员或改变房间状态。禁止上报 `trtc_user_id`。 |

### 3.8 `room_ended`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端接受结束命令并将房间从 `live` 切换到 `ending` 后触发；结束请求失败、重复点击或客户端本地离开不触发。 |
| 必填属性 | 通用必填；`room_id`、`room_version`、`ended_by_player_id`、`end_reason`：`host_action`、`timeout`、`system_failure`。 |
| 可选属性 | `live_duration_ms`；`member_count`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P1：伪匿名房间生命周期元数据。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `room_ended + room_id + room_version`；服务端结束命令使用幂等键，客户端重试复用 `event_id`。 |
| 客户端 / 服务端责任 | 服务端负责授权、状态迁移和录制收尾编排；客户端只报告服务端确认的结束结果，不根据 TRTC 离线事件伪造结束。 |

### 3.9 `recording_status_changed`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 服务端确认录制状态发生有效迁移时触发，例如 `requested -> recording`、`recording -> stopping`、`stopping -> ready` 或迁移到 `failed`。 |
| 必填属性 | 通用必填；`room_id`、`recording_status`：`requested`、`recording`、`stopping`、`ready`、`failed`、`expired`、`status_sequence`。 |
| 可选属性 | `failure_reason_code`；`participant_count`；`latency_ms`；`correlation_id`。 |
| 隐私等级 | P1：录制流程状态；不包含录音内容。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `recording_status_changed + room_id + status_sequence`；服务端以状态机版本和供应商回调幂等键去重。客户端只转发已确认状态。 |
| 客户端 / 服务端责任 | 服务端负责录制启动、停止、回调验签、状态机和权威事件；客户端可上报用户看到的状态，但不得上传录音地址、音频 ID 或供应商原始回调。 |

### 3.10 `score_report_viewed`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 报告页完成首屏渲染，且客户端已拿到该玩家的报告状态后触发。仅导航到路由、请求失败或后台预取不触发。 |
| 必填属性 | 通用必填；`room_id`、`player_id`、`report_state`：`waiting`、`processing`、`success`、`failed`。 |
| 可选属性 | `entry_point`：`room_end`、`history`、`notification`；`latency_ms`；`report_version`。 |
| 隐私等级 | P2：评分报告访问行为；只记录状态，不记录分数或内容。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `score_report_viewed + room_id + player_id + report_version`；同一报告版本在同一 App 会话最多计一次，跨会话再次实际查看可计一次。 |
| 客户端 / 服务端责任 | 客户端负责确认用户实际看到首屏并上报；服务端负责报告访问权限和状态真相。禁止上报分数明细、转写文本、音频 URL 或原始音频。 |

### 3.11 `score_retry_requested`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 玩家点击重试且服务端接受 `POST /v1/score-jobs/{jobId}/retry` 后触发；点击未发出请求、权限失败或任务不可重试不触发。 |
| 必填属性 | 通用必填；`room_id`、`player_id`、`score_job_id`、`attempt_number`、`retry_reason=user_action`。 |
| 可选属性 | `failure_reason_code`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P2：评分任务操作元数据。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `score_retry_requested + score_job_id + attempt_number`；服务端以同一评分任务的 `attempt` 和幂等键去重，客户端只重试原事件。 |
| 客户端 / 服务端责任 | 服务端负责鉴权、失败状态校验、尝试次数递增和任务排队；客户端只上报服务端接受的重试。不得携带音频对象、签名 URL 或供应商凭证。 |

### 3.12 `ops_handoff_started`

| 项目 | 契约 |
| --- | --- |
| 触发时机 | 仅 `internal-ops` 构建在服务端认证通过后，App 开始打开白名单 HTTPS 运营 WebView 时触发。生产包不应主动产生此事件。 |
| 必填属性 | 通用必填；`build_variant=internal_ops`、`handoff_surface=ops_webview`、`entry_point`：`admin_menu`、`deep_link`。 |
| 可选属性 | `destination_host`（仅白名单主机名）；`webview_version`；`correlation_id`；`latency_ms`。 |
| 隐私等级 | P2：受限的运营入口审计元数据。 |
| 版本 | `1.0.0`。 |
| 去重策略 | 业务键为 `ops_handoff_started + correlation_id`；同一交接尝试只计一次，失败重试必须生成新的服务端交接尝试 ID。 |
| 客户端 / 服务端责任 | 服务端负责账号、MFA、RBAC、单用途短期交接码和审计；客户端只记录 WebView 启动事实。事件中禁止出现交接码、Cookie、长期 Token、完整 URL 或管理员身份资料。 |

## 4. 明确禁止采集的字段

以下内容无论是事件属性、Sentry breadcrumb、错误上下文、日志还是重试队列，都禁止采集、持久化或转发：

- 邮箱、手机号、姓名、昵称、头像原图、联系人和任何可直接识别身份的资料。
- 原始音频、音频片段、转写文本、语音识别结果、音频 URL、签名 URL、录制文件内容和音频供应商回调原文。
- `UserSig`、`SDKSecretKey`、`SecretKey`、访问 Token、刷新 Token、Bearer Token、Cookie、`ops_handoff_code`、Sentry 管理 Token 和任何签名密钥。
- 密码、验证码、完整请求头、完整 API 响应、设备序列号、广告 ID、精确 IP、精确地理位置和未裁剪的异常堆栈中的请求数据。
- 房间码、邀请链接和任何可直接作为入房凭证使用的字符串。`room_id` 只能使用服务端不可猜测的业务 ID。

错误、状态和来源字段只能使用本目录定义的枚举或短错误码。未知字段、超长字段、疑似密钥格式和自由文本在入队前丢弃；丢弃诊断只记录 `drop_reason_code`，不记录原始值。

## 5. 版本与去重规则

- `event_id` 只标识一次发送对象，不能作为业务次数统计的唯一口径；统计必须使用各事件定义的业务键。
- 事件名、触发时机、必填字段、字段语义、隐私等级或去重键变化时，发布新主版本，例如 `2.0.0`，并保留旧版本的兼容接收窗口。
- 仅增加可选字段或增加枚举值时，更新目录次版本，并要求旧消费者忽略未知可选字段；必填字段只能在主版本中增加。
- 修正文案、示例或不改变契约的排版时更新修订版本。
- 第一方接收端按 `event_id` 做幂等去重，再按业务键做业务去重；Sentry Sink 只接受允许字段，不能因为网络重试创建新的事件 ID。
- 服务端权威事件和客户端观测事件若同时存在，必须带相同的 `correlation_id`；第一方漏斗只统计服务端权威事件，Sentry 近实时观测可以统计客户端观测事件，禁止把两者相加。

## 6. `AnalyticsClient` 最小接口

以下是 App 侧的最小 TypeScript 契约。具体 Sink、队列和传输实现不属于本目录；调用方只依赖 `track`、`flush` 和 `reset`。

```ts
type AnalyticsEventName =
  | "app_opened"
  | "guest_session_created"
  | "room_created"
  | "room_joined"
  | "room_ready_changed"
  | "room_started"
  | "rtc_connection_changed"
  | "room_ended"
  | "recording_status_changed"
  | "score_report_viewed"
  | "score_retry_requested"
  | "ops_handoff_started";

type AnalyticsClient = {
  track<E extends AnalyticsEventName>(
    eventName: E,
    properties: EventProperties[E],
    options?: {
      eventId?: string;
      occurredAt?: string;
      correlationId?: string;
    },
  ): void;
  flush(reason?: "background" | "manual" | "shutdown"): Promise<void>;
  reset(): void;
};
```

实现约束：

- `track` 必须是非阻塞调用；校验、补齐信封、入队和发送失败不得抛错到页面或房间状态机。
- `track` 只接受类型安全的事件属性和允许字段；客户端不得提供 `producer=server` 或覆盖 `user_id`、`app_version`、`environment`。
- `flush` 只用于生命周期机会窗口，不得阻塞退出、导航、入房、结束房间或评分重试等主流程。`reset` 用于切换匿名身份或清理会话上下文。
- `EventProperties` 必须由本目录生成或手工映射；禁止使用 `Record<string, unknown>` 绕过必填字段和禁止字段校验。

## 7. 失败、批量与重试策略

V1 默认使用内存队列，不把事件落盘；这样 App 被系统杀死时可能丢失未发送事件，但不会在设备上长期保存房间、评分或运营上下文。

| 配置常量 | V1 边界 | 目的 |
| --- | --- | --- |
| `MAX_BATCH_SIZE` | `20` 条 | 控制单次请求大小，降低弱网下整批失败成本。 |
| `FLUSH_INTERVAL_MS` | `10000` ms | 满足近实时指标，同时避免每个事件单独请求。 |
| `MAX_QUEUE_SIZE` | `200` 条 | 防止离线或服务端故障导致内存无界增长。达到上限时优先丢弃 `P0` 的媒体/会话观测，保留较新的 P1/P2 业务事件。 |
| `REQUEST_TIMEOUT_MS` | `3000` ms | Analytics 请求超时必须快速返回，不能拖慢主流程。 |
| `MAX_RETRY_ATTEMPTS` | `3` 次 | 只对网络错误、HTTP `408`、`429` 和 `5xx` 重试；复用原 `event_id`。 |
| `MAX_EVENT_AGE_MS` | `86400000` ms | 若未来启用受控持久化，超过 24 小时的事件直接丢弃，避免过期漏斗数据。V1 内存队列通常先因进程退出而清空。 |

重试使用 `1 s / 5 s / 30 s` 的指数退避并加入随机抖动；达到上限后丢弃事件，不影响 UI、API、WebSocket、TRTC 或评分流程。HTTP `400`、`401`、`403`、`413` 和字段校验失败不得重试，应丢弃并只上报短错误码。

Sentry Sink 和第一方 Sink 必须独立排队、独立重试：一个 Sink 不可等待或阻塞另一个 Sink。客户端离线时只在内存中保留队列；网络恢复、进入后台和显式 `flush` 都可触发批量发送。任何 Sink 都不得为了补偿失败而生成新的 `event_id`，也不得把完整事件写入普通应用日志。

### 7.1 重试耗尽后的处理

当事件达到 `MAX_RETRY_ATTEMPTS`，或遇到不可重试的 HTTP `400`、`401`、`403`、`413` 和字段校验失败时：

1. 该事件从对应 Sink 的队列移除，不再进入第一方业务事件表，也不继续重试。失败不改变原事件的业务去重结果。
2. 客户端只在内存诊断计数器中记录 `original_event_name`、`drop_reason_code`、`sink_type` 和 `attempt_count`。允许的 `drop_reason_code` 包括 `max_retries_exceeded`、`validation_failed`、`rate_limited`、`request_too_large` 和 `transport_failed`。
3. 诊断计数器不是第 3 节的业务事件，不使用 `AnalyticsClient.track`，不携带 `event_id`、`user_id`、`room_id`、`player_id`、原事件属性、失败响应体或任何敏感字段，也不写入持久化日志。
4. 若 Sentry SDK 本身可用，可将上述字段作为聚合指标 `analytics_event_dropped` 上报 Sentry；该指标只用于监控采集丢失，不进入第一方事件表、不参与 DAU 或业务漏斗，也不得为诊断失败再次阻塞或重试主流程。
5. 记录诊断失败、队列清理和事件丢弃都必须是非阻塞操作，不得延迟 UI、API、WebSocket、TRTC 或评分任务。
