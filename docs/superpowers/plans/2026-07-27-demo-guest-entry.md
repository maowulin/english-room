# Demo 访客入口实现计划

> **面向 AI 代理的工作者：** 本计划采用 TDD，先验证登录页访客入口的可见性和行为，再实现最小 UI 改动。

**目标：** 在登录页提供无需填写账号即可进入体验流程的 `Demo 访客进入` 入口。

**架构：** 访客按钮复用现有 `AuthScreen` 的 `onLogin` 回调和默认昵称逻辑，不新增认证接口、不保存凭据。按钮只在登录模式渲染，并使用现有视觉变量保持与登录页一致。

**技术栈：** React Native、Expo、React Native Testing Library、Jest、TypeScript。

---

### 任务 1：增加访客入口行为测试

**文件：**
- 修改：`apps/mobile/__tests__/room-app.test.tsx`

- [x] **步骤 1：编写失败测试**

在现有认证控件测试中增加断言：登录页显示 `Demo 访客进入`，点击后进入大厅。

- [x] **步骤 2：运行测试验证失败**

运行：`npm test -- --runInBand __tests__/room-app.test.tsx`

预期：FAIL，找不到 `Demo 访客进入`。

### 任务 2：实现登录页访客按钮

**文件：**
- 修改：`apps/mobile/src/features/session/auth-screen.tsx`

- [x] **步骤 1：编写最少实现代码**

在登录模式的主登录按钮下增加：

```tsx
<Pressable
  accessibilityLabel="Demo 访客进入"
  disabled={busy}
  onPress={() => { if (!busy) onLogin(displayName); }}
  style={[styles.guestButton, busy && styles.primaryDisabled]}
>
  <Text style={styles.guestButtonText}>Demo 访客进入</Text>
</Pressable>
```

按钮复用 `displayName` 和 `onLogin`，注册页不渲染。

- [x] **步骤 2：运行测试验证通过**

运行：`npm test -- --runInBand __tests__/room-app.test.tsx`

预期：PASS。

### 任务 3：完整验证与浏览器回归

**文件：**
- 修改：无

- [x] **步骤 1：运行工程校验**

运行：`npm run typecheck && npm run lint && npm test -- --runInBand && git diff --check`

预期：全部成功。

- [x] **步骤 2：运行移动端浏览器回归**

在 390×844 视口打开登录页，点击 `Demo 访客进入`，确认进入大厅且无需填写邮箱和密码。
