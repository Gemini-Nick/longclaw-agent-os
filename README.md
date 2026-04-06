# 隆小虾 Agent OS

当前阶段先收敛为一套 runtime-first 的 Agent OS：优先提供微信 `weclaw` 桥接与常驻服务的一键安装、卸载和运维能力。GUI 与其他桌面功能后续再继续补齐。

## 当前交付范围

- 单包安装入口：仓库根目录 `install.sh` / `uninstall.sh`
- runtime 安装/卸载：`scripts/guardian/install-v2.sh` / `uninstall-v2.sh`
- `weclaw` wrapper：统一 `status` / `stop` / `restart` 与真实二进制透传
- `weclaw.bridge` 前台托管：由 launchd 托管 bridge 进程
- guardian / scheduler：统一状态检查、重启和定时任务协调

当前不作为本轮重点：

- GUI 体验与桌面端产品化
- 非 runtime 相关的上游同步整理
- 其他未并入这套 runtime 的子系统

## 一键安装微信与常驻服务

### 前置条件

- macOS，且可使用 `launchctl`
- 可选 Go 环境：用于构建 `weclaw-guardian`
- `weclaw-real` 来源按以下顺序自动回退：
  1. `bundle/weclaw-real`
  2. 环境变量 `WECLAW_REPO_DIR` 指向的本地 `weclaw` 源码仓库
  3. 已存在的 `~/.weclaw/bin/weclaw-real`
  4. 旧的 `~/.weclaw/bin/weclaw`

### 安装

```bash
bash install.sh
```

如需混合模式额外渲染 daemon plist：

```bash
bash install.sh --mixed
```

安装过程会自动完成：

- 清理旧版 watchdog / guardian 残留
- 尝试构建 `weclaw-guardian`
- 安装 runtime scripts 到 `~/.longclaw/runtime-v2/`
- 安装 `~/.weclaw/bin/weclaw` 与 `~/.weclaw/bin/weguard`
- 写入 `~/.weclaw/services.json`
- 渲染 `~/Library/LaunchAgents/com.zhangqilong.ai.*.plist`
- 拉起 `codex` / `claude` / `weclaw.bridge` / `repo-scheduler` / `guardian.monitor`

首次安装后仍需手工登录微信：

```bash
~/.weclaw/bin/weclaw login
```

如果本机没有 Go，安装会继续执行，但会跳过 `guardian.monitor` 的自动装载；后续安装 Go 后可补跑：

```bash
bash scripts/guardian/build-core.sh
bash scripts/guardian/install-v2.sh
```

### 卸载

```bash
bash uninstall.sh
```

卸载会删除 runtime 文件、wrapper 和 launch agents，但保留：

- `~/.weclaw` 下的账号与配置
- `~/.weclaw/bin/weclaw-real`

## 常用运维命令

```bash
~/.weclaw/bin/weclaw status
~/.weclaw/bin/weclaw restart
~/.weclaw/bin/weguard status
~/.weclaw/bin/weguard restart --service weclaw
bash scripts/guardian/verify-v2.sh
```

## 服务清单

- `com.zhangqilong.ai.weclaw.bridge`
  `weclaw` 微信桥，前台模式运行，由 launchd 托管
- `com.zhangqilong.ai.repo.scheduler`
  仓库相关定时任务调度，并在必要时补拉起 `weclaw`
- `com.zhangqilong.ai.guardian.monitor`
  `weclaw-guardian` 监控入口，统一检查服务状态与重启
- `com.zhangqilong.ai.codex.appserver`
  Codex 常驻服务入口
- `com.zhangqilong.ai.claude.worker`
  Claude worker 常驻服务入口

## 目录说明

```text
apps/runtime/       runtime 脚本、launchd 模板与 guardian 源码
scripts/guardian/   构建、安装、验证、卸载脚本
install.sh          仓库内正式安装入口
uninstall.sh        仓库内正式卸载入口
```

## GUI 说明

这个仓库后续仍会继续承载 Agent OS GUI 与其他桌面能力，但当前 README 和安装入口以 runtime 能力为主。GUI 开发与运行流程等 runtime 稳定后再单独整理。
