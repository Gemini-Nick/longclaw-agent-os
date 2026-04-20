# Longclaw Agent OS

隆小虾 Agent OS 是面向单人高杠杆操盘手的 Agent OS。它不是纯聊天壳，也不是纯治理台；当前阶段的产品原则固定为：

- `Chat launches, console governs.`
- `Electron` 是唯一 default home
- `WeClaw` 是 remote cowork companion
- `Hermes` 是唯一 canonical `LaunchIntent -> Task / Run / Work Item` 编排层

当前仓库基于 [Open Agent SDK](https://github.com/shipany-ai/open-agent-sdk) fork，承载 `Client Runtime（端侧）`、Electron 产品外壳、可见的 `Capability Substrate`，以及 Longclaw 的本地治理与恢复能力。

## 特性

- `Home / Runs / Work Items / Packs / Studio` 五个一级产品面
- `Home = Cowork Launch + Governance Snapshot`
- 显式 `@pack / @skill / @plugin` 前门启动
- Electron 治理面统一承接 `runs / evidence / review / work items / promotion`
- `Signals` / `due-diligence-core` 作为旗舰 `Professional Grounds`
- WeClaw 作为 remote cowork companion 负责远程发起、轻量追问和状态回看
- Skills / plugins / bundled capabilities 可见化，并通过 `Studio` 做 curated 管理

## 架构定位

`longclaw-agent-os` 当前定位为 `Client Runtime（端侧）` 参考实现，也是 phase 1 的 `default home`。它不是最终可移植的 `Agent Core（云侧）`。

统一术语：

- `Client Runtime（端侧）`：设备侧宿主环境，负责桌面产品外壳、本地 CLI、安装升级、`launchd`、guardian、scheduler 和设备能力集成。
- `Agent Core（云侧）`：由 `hermes-agent` 承担，负责 `session / memory / skills / scheduler / delivery / approvals / eval`。
- `Interaction Adapter Layer（通道侧）`：如 `weclaw`、`Chanless` 这类消息与语音接入层。
- `Capability Substrate`：端侧可见的 `skills / plugins / bundled skills / built-in plugins / cowork runtime`。
- `Professional Grounds`：Longclaw 的旗舰专业训练场。phase 1 主要是 `Signals` 与 `due-diligence-core`。
- `Reviewed Knowledge Plane`：只接 reviewed outputs。phase 1 主要落到 Obsidian。

当前阶段采用 `Local-first Reference Architecture（当前本地参考实现）`：

- `longclaw-agent-os`：`Client Runtime（端侧）` + `default home`
- `weclaw`：`Interaction Adapter Layer（通道侧）` + remote cowork companion
- `Signals` / `due-diligence-core`：flagship `Professional Grounds`
- Obsidian：`Reviewed Knowledge Plane`
- `hermes-agent`：`Agent Core（云侧）`

完整边界、信息架构和设计语言见：

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/PRODUCT_BOUNDARY.md](docs/PRODUCT_BOUNDARY.md)

## 入口与产品结构

Longclaw 的一级产品结构固定为：

- `Home`
- `Runs`
- `Work Items`
- `Packs`
- `Studio`

其中：

- `Home` 取代旧 `Overview`
- `Home` 固定为 `Cowork Launch + Governance Snapshot`
- `Studio` 只做 curated capabilities，不做 marketplace 首页
- `Runs / Work Items / Packs` 共享统一的 row / drawer / artifact preview 语法

## 开发环境初始化

```bash
git clone https://github.com/Gemini-Nick/longxiaoxia-agent-os.git
cd longxiaoxia-agent-os
bash bootstrap-dev.sh
npm run build
npm run electron:start
```

说明：

- 开发环境固定使用 `npm`（见 `packageManager`），默认走 `npm ci`
- 这一步只初始化仓库自身的 Electron / React / TypeScript 依赖
- Node.js 版本要求见 [`package.json`](package.json)，当前下限是 `>=18`

如果你要验证 `WeClaw -> Hermes -> Electron` 的模拟闭环，可直接运行：

```bash
bash scripts/validate-weclaw-client-simulated.sh
```

完整验证说明见 [docs/VALIDATION_WECLAW_TO_CLIENT.md](docs/VALIDATION_WECLAW_TO_CLIENT.md)。

## Runtime 安装

`bash install.sh`、`bash apply-live.sh` 和 guardian 相关脚本只负责 `Client Runtime（端侧）` 的安装/更新：

- 安装 runtime
- 注入 `launchd` / guardian / `~/.weclaw/config.json`
- 管理 `weclaw-real` 等设备侧依赖

它们**不会**自动安装当前仓库的 `node_modules`。如果你要开发 Electron 控制面，先执行：

```bash
bash bootstrap-dev.sh
```

环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | — |
| `AGENT_MODE` | agent 模式 | `acp` |
| `AGENT_CWD` | agent 工作目录 | `$HOME` |

## 项目结构

```
src/          # OAS 核心（尽量不改，保持上游同步）
electron/     # Electron 入口 & 主进程
mcp-servers/  # Python MCP 服务（缠论、PPT、尽调等）
apps/runtime/ # weclaw guardian v2 runtime（launchd + guardian core）
scripts/guardian/ # 迁移、验证、退役脚本
```

## Runtime 重构（Guardian v2）

旧的 `weclaw/watchdog/guardian` 心跳循环已迁移到统一控制面方案：

- `weclaw-guardian`：统一监控与重启控制（Go 核心）
- `weguard`：guardian 运维命令入口（`status/restart/monitor`）
- `codex` / `claude` / `weclaw` / `repo-scheduler`：独立 launchd 服务
- `harness`：one-shot runtime control entry，由 scheduler 驱动，不再单独常驻
- `weclaw` 保留给 remote cowork companion，不接管 Electron 治理面语义
- runtime 只向 `~/.weclaw/config.json` 注入设备侧策略，不接管微信消息语义

常用命令：

```bash
npm run guardian:inventory
npm run guardian:build
npm run guardian:install
npm run guardian:verify
npm run guardian:retire
```

## 单包安装边界

这套后台服务当前按 `Client Runtime（端侧）` 参考实现打包：

- 端侧宿主层：`apps/runtime/` + `scripts/guardian/`
- 通道核心依赖：`weclaw-real`

安装入口已经固定在仓库根目录：

- `bash install.sh`
- `bash uninstall.sh`
- `bash apply-live.sh`

目标是让另一台 Mac 只执行一次安装入口，例如：

```bash
bash install.sh
```

安装包内部负责：

- 安装 `weclaw-real`
- 安装 runtime
- 写入 `LaunchAgents`
- 启动 `guardian/codex/claude/weclaw/repo-scheduler`

首次仍需用户手工执行：

```bash
~/.weclaw/bin/weclaw login
```

边界和打包约束见 [docs/PRODUCT_BOUNDARY.md](docs/PRODUCT_BOUNDARY.md)。未来可移植核心的抽取方向见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 上游同步

本项目 fork 自 Open Agent SDK，定期同步上游更新：

```bash
git fetch upstream
git merge upstream/main
```

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 用于约束 `weclaw` 与 `agent-os` 的长期分层边界。
- [docs/WECLAW_CONSUMPTION.md](docs/WECLAW_CONSUMPTION.md) 约束 `agent-os` 只消费已验证的 `weclaw` fork 构建产物，不直接追 `fastclaw-ai/weclaw`。

## 验证目标

本轮验收聚焦两个目标：

- 完成整体设计代码改造
- 完成一次从 `WeClaw` 到客户端的完整验证

具体闭环拆分为：

- `模拟闭环 = 自动化`
- `真实微信闭环 = 手工 runbook + 证据包`

详见 [docs/VALIDATION_WECLAW_TO_CLIENT.md](docs/VALIDATION_WECLAW_TO_CLIENT.md)。

## License

MIT
