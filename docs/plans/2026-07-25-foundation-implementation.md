# Expo 与 FastAPI 基础框架实现计划

> **面向 AI 代理的工作者：** 在当前仓库内逐任务实现。每个任务使用 TDD，保持小步提交，并在提交前运行该任务对应的完整验证。

**目标：** 建立可测试、可类型检查的 FastAPI 后端和 Expo Development Build 客户端，并在 iOS 模拟器中实际打开 Demo 页面。

**架构：** FastAPI 是业务控制面，当前仅实现健康检查并预留鉴权、房间和评分模块边界。Expo 客户端通过可替换的 `ApiClient` 读取后端状态；后续 TRTC 原生模块由独立 `RtcClient` 封装，音频不经过业务后端。

**技术栈：** Python 3.13、FastAPI、Pydantic、pytest、Ruff、mypy、React Native Expo、Expo Router、TypeScript、Jest、React Native Testing Library。

---

## 文件结构

```text
apps/
├── api/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── src/english_room_api/
│   │   ├── __init__.py
│   │   ├── app.py
│   │   ├── config.py
│   │   ├── health/router.py
│   │   ├── auth/router.py
│   │   ├── rooms/router.py
│   │   └── scoring/router.py
│   └── tests/
│       └── test_health.py
└── mobile/
    ├── app/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── src/
    │   ├── components/demo-status-card.tsx
    │   ├── services/api-client.ts
    │   └── theme/tokens.ts
    ├── __tests__/
    │   ├── api-client.test.ts
    │   └── demo-screen.test.tsx
    ├── app.json
    ├── eas.json
    ├── jest.config.js
    ├── package.json
    └── tsconfig.json
```

## 任务 1：建立 FastAPI 工具链

**文件：**

- 创建：`apps/api/.python-version`
- 创建：`apps/api/pyproject.toml`
- 创建：`apps/api/src/english_room_api/__init__.py`
- 创建：`apps/api/tests/__init__.py`

- [ ] 创建 Python 3.13 `uv` 项目并配置 FastAPI、Uvicorn、pytest、HTTPX、Ruff 和 mypy。
- [ ] 运行 `uv sync --dev`，确认依赖安装成功。
- [ ] 运行 `uv run ruff check .` 和 `uv run mypy src`，确认空包通过。
- [ ] 提交：`chore(后端): 初始化 FastAPI 工具链`

## 任务 2：使用 TDD 实现健康检查

**文件：**

- 创建：`apps/api/tests/test_health.py`
- 创建：`apps/api/src/english_room_api/app.py`
- 创建：`apps/api/src/english_room_api/health/__init__.py`
- 创建：`apps/api/src/english_room_api/health/router.py`

- [ ] 先创建失败测试：

```python
from fastapi.testclient import TestClient

from english_room_api.app import create_app


def test_health_returns_service_status() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "english-room-api",
        "status": "ok",
    }
```

- [ ] 运行 `uv run pytest tests/test_health.py -q`，确认因 `english_room_api.app` 不存在而失败。
- [ ] 实现 `create_app()` 和 `/health`。
- [ ] 运行 `uv run pytest -q`，确认测试通过。
- [ ] 运行 `uv run ruff format --check .`、`uv run ruff check .` 和 `uv run mypy src tests`。
- [ ] 提交：`feat(后端): 添加健康检查接口`

## 任务 3：建立后端业务模块边界

**文件：**

- 创建：`apps/api/tests/test_module_boundaries.py`
- 创建：`apps/api/src/english_room_api/config.py`
- 创建：`apps/api/src/english_room_api/auth/router.py`
- 创建：`apps/api/src/english_room_api/rooms/router.py`
- 创建：`apps/api/src/english_room_api/scoring/router.py`
- 创建：`.env.example`

- [ ] 测试应用 OpenAPI 中存在 `auth`、`rooms` 和 `scoring` 标签，但没有真实腾讯云端点或密钥。
- [ ] 运行测试，确认模块尚未注册而失败。
- [ ] 创建仅包含 Router 与标签的模块边界，并在 `create_app()` 注册。
- [ ] 使用 Pydantic Settings 定义安全的非敏感默认配置。
- [ ] 运行后端测试、Ruff 和 mypy。
- [ ] 提交：`feat(后端): 建立业务模块边界`

## 任务 4：生成 Expo Development Build 客户端

**文件：**

- 创建：`apps/mobile/` 下的 Expo Router TypeScript 脚手架
- 修改：`apps/mobile/app.json`
- 创建：`apps/mobile/eas.json`

- [ ] 使用 `create-expo-app` 生成最小 TypeScript 项目。
- [ ] 安装 `expo-dev-client`，配置唯一的 iOS Bundle Identifier 和 Android Package。
- [ ] 配置 `development` Build Profile。
- [ ] 运行 `npx expo-doctor` 和 `npm run typecheck`。
- [ ] 提交：`chore(客户端): 初始化 Expo Development Build`

## 任务 5：使用 TDD 实现 API Client

**文件：**

- 创建：`apps/mobile/__tests__/api-client.test.ts`
- 创建：`apps/mobile/src/services/api-client.ts`

- [ ] 先测试 `getHealth()` 将 `/health` 响应解析为明确的 `HealthStatus`。
- [ ] 运行 Jest，确认 `api-client` 模块不存在而失败。
- [ ] 实现接收 `fetch` 依赖和 `baseUrl` 的 `ApiClient`。
- [ ] 测试成功响应与网络错误。
- [ ] 运行 Jest 和 TypeScript 类型检查。
- [ ] 提交：`feat(客户端): 添加后端健康检查客户端`

## 任务 6：使用 TDD 实现 Demo 页面

**文件：**

- 创建：`apps/mobile/__tests__/demo-screen.test.tsx`
- 创建：`apps/mobile/src/components/demo-status-card.tsx`
- 创建：`apps/mobile/src/theme/tokens.ts`
- 修改：`apps/mobile/app/index.tsx`

- [ ] 先测试页面展示项目名称、Expo Development Build、FastAPI 和 TRTC 待接入状态。
- [ ] 运行 Jest，确认测试因页面内容缺失而失败。
- [ ] 实现 Demo 页面和状态卡片。
- [ ] 确保 API 不可用时展示离线状态而不白屏。
- [ ] 运行 Jest、ESLint 和 TypeScript 类型检查。
- [ ] 提交：`feat(客户端): 添加基础 Demo 页面`

## 任务 7：完整验证与设备验收

**文件：**

- 修改：`README.md`

- [ ] 启动 FastAPI：`uv run uvicorn english_room_api.app:app --reload`。
- [ ] 请求 `GET /health` 并保存终端证据。
- [ ] 运行后端完整测试、Ruff 和 mypy。
- [ ] 运行客户端 Jest、ESLint、Expo Doctor 和 TypeScript 类型检查。
- [ ] 使用 `npx expo run:ios` 生成并安装 Development Build。
- [ ] 在可用 iOS 模拟器中打开 Demo 页面并检查可见文本。
- [ ] 在 README 中记录本地启动命令。
- [ ] 提交：`docs(运行): 补充本地启动与验证说明`

## 任务 8：安全审计和发布准备

- [ ] 检查 Git 工作区和提交边界。
- [ ] 扫描 `.env`、密钥、令牌和 `UserSig`。
- [ ] 调用 external-brain 审查 diff、验证结果和剩余风险。
- [ ] 确认 GitHub 目标是 `maowulin/english-room-demo` 且可见性为 `PUBLIC`。
- [ ] 只有在个人远端实际存在并可访问时才推送 `main`。
