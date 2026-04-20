# WeClaw To Client Validation

这份 runbook 只服务两个验收目标：

- `目标 1`：完成整体设计代码改造
- `目标 2`：完成一次从 `WeClaw` 到客户端的完整验证

产品前提固定为：

- `Chat launches, console governs.`
- `Electron` 是唯一 default home
- `WeClaw` 是 remote cowork companion
- `Hermes` 是唯一 canonical `LaunchIntent -> Task / Run / Work Item` 编排层
- 本轮前门以显式 `@pack / @skill / @plugin` 为主，不以自由文本智能猜路由为验收标准

## 验证矩阵

本轮验证分为两条路径：

1. `模拟闭环 = 自动化`
2. `真实微信闭环 = 手工 runbook + 证据包`

角色分配固定为：

- `模拟闭环`：`Due Diligence`
- `真实微信闭环`：`Signals Review`

这样分配的原因：

- `Due Diligence` 更适合作为可重复、可控的自动化闭环
- `Signals Review` 更适合作为真实微信演示路径

## 模拟闭环

### 目标

验证一条可重复的 `WeClaw -> Hermes -> Electron` 闭环，而不依赖真实微信和真实 pack 运行环境。

### 覆盖范围

- WeClaw 受控 HTTP 入口：`POST /api/agent-os/launch`
- Hermes canonical launch path：`POST /agent-os/launches`
- Hermes canonical task path：`GET /agent-os/tasks`
- Electron control-plane 读取：
  - `overview`
  - `work-items`
  - `pack dashboard`

### 前置条件

- `weclaw`、`hermes-agent`、`longclaw-agent-os` 三个仓都已安装依赖
- `longclaw-agent-os` 已执行过 `bash bootstrap-dev.sh`
- 当前机器可运行：
  - `go`
  - `python3`
  - `npm`

### 运行命令

```bash
cd /Users/zhangqilong/github代码仓库/longclaw-agent-os
bash scripts/validate-weclaw-client-simulated.sh
```

也可以使用 npm script：

```bash
cd /Users/zhangqilong/github代码仓库/longclaw-agent-os
npm run validate:weclaw-client-simulated
```

### 通过标准

- WeClaw API 测试通过
- Hermes Agent OS 相关 pytest 通过
- Electron control-plane client 测试通过

### 自动化证据

自动化命令输出本身就是第一层证据。重点看：

- WeClaw 测试是否验证了 `ingress + launch` 双提交
- Hermes 测试是否验证了 canonical `LaunchIntent -> Task`
- Electron 测试是否验证了客户端能看到：
  - `task`
  - `work item`
  - `adapter health`
  - `due_diligence` dashboard

## 真实微信闭环

### 目标

验证真实微信消息可以通过 `WeClaw -> Hermes -> Electron` 形成一条产品级闭环，并在客户端中可见。

### 主场景

使用 `Signals Review` 作为真实微信闭环场景。

### 前置条件

- Hermes Agent OS 已启动，并暴露 `/agent-os/*`
- Electron 已启动，且连接同一个 Hermes
- WeClaw 已启动，且配置了 Agent OS 转发
- `Signals` pack 已在 Hermes 注册可用

推荐环境变量：

```bash
export WECLAW_AGENT_OS_BASE_URL=http://127.0.0.1:8000
export WECLAW_AGENT_OS_API_KEY=your-token
export LONGCLAW_HERMES_AGENT_OS_BASE_URL=http://127.0.0.1:8000
export LONGCLAW_HERMES_API_KEY=your-token
```

### 操作步骤

1. 启动 Hermes，并确认 `/agent-os/overview` 可访问。
2. 启动 WeClaw，并确认其已读取 `WECLAW_AGENT_OS_BASE_URL`。
3. 启动 Electron 客户端，并确认 `Home` 打开正常。
4. 在真实微信里向 Longclaw 发送一条显式 capability 消息，例如：

```text
@pack signals.review 请给我一份今天的盘前 review
```

5. 观察 WeClaw 日志，确认：
   - 有入站事件
   - 有 `/agent-os/launches` 提交
6. 观察 Hermes，确认：
   - 生成了对应 `launch`
   - `GET /agent-os/tasks?limit=5` 能看到新任务
7. 在 Electron 中确认：
   - `Home` 的最近 launch 可见
   - `Runs` 中能看到对应 run 或下游 run
   - `Work Items` 中若需要 review / follow-up，会出现对应对象
   - `Packs > Signals` 中能看到相应治理状态

### 证据包

真实微信闭环至少要收集以下证据：

- Electron `Home` 截图
- Electron `Runs` 或 `Work Items` 截图
- Hermes 任务列表输出
- WeClaw 日志或 API 调用记录

建议的最小证据命令：

```bash
curl -H "Authorization: Bearer ${LONGCLAW_HERMES_API_KEY}" \
  "${LONGCLAW_HERMES_AGENT_OS_BASE_URL}/agent-os/tasks?limit=5"
```

```bash
curl -H "Authorization: Bearer ${LONGCLAW_HERMES_API_KEY}" \
  "${LONGCLAW_HERMES_AGENT_OS_BASE_URL}/agent-os/overview"
```

### 截图点位

至少拍 3 张图：

1. `Home` 中 `Cowork Launch + Governance Snapshot`
2. `Runs` 中对应任务或 run
3. `Work Items` 或 `Packs > Signals` 中对应治理状态

## 失败排障顺序

出现问题时，按这个顺序排：

1. `WeClaw` 是否配置了 `WECLAW_AGENT_OS_BASE_URL`
2. Hermes `/agent-os/overview` 是否可访问
3. `Signals` pack 是否已在 Hermes 注册
4. Electron 是否连接了正确的 `LONGCLAW_HERMES_AGENT_OS_BASE_URL`
5. 微信消息是否显式带了 `@pack signals.review`

### 常见失败模式

- `微信里有回复，但 Electron 没有任务`
  - 先查 WeClaw 是否只做了 ingress，没有成功提交 `/agent-os/launches`
- `Hermes 有 task，但 Electron 看不到`
  - 先查 Electron 的 Hermes base URL / API key
- `Electron 有 launch/task，但 Signals 没有深页状态`
  - 先查 Hermes pack 注册与 pack dashboard 接口

## 本轮验收结论

本轮只要求验证：

- 两条 ingress 路径中的一条真实路径和一条自动化路径
- 两个 flagship pack 在合并矩阵中都被覆盖
- 至少一次 canonical `Task / Run / Work Item` 在 Electron 中可见

本轮不要求：

- 自由文本智能猜 pack 成为主路径
- 所有 pack 在两条路径都各跑一遍
- 重写 runtime 深层 state file shape 或 guardian 内部契约
