# 单包安装边界

这份仓库承担产品层安装包，不承载 `weclaw` 内核仓库本体。

## 入口

- 安装：`bash install.sh`
- 卸载：`bash uninstall.sh`
- 重新应用当前 repo 到本机 runtime：`bash apply-live.sh`

## 包内结构

- `apps/runtime/`：launchd、guardian、scheduler、桥接脚本与 runtime 配置
- `scripts/guardian/`：安装、验证、回滚、退役脚本
- `bundle/weclaw-real`：`weclaw` fork 构建出来的核心二进制，可选

## 边界

- 产品层负责：`launchd`、guardian、scheduler、runtime 安装升级卸载、残留清理、策略注入
- `weclaw-real` 只负责：微信登录、消息桥接、API server、基础 CLI 能力

## 首次安装

用户执行一次 `bash install.sh` 即可完成：

- 安装或复用 `weclaw-real`
- 安装 runtime
- 注册并启动 launchd 服务

如果包内没有 `bundle/weclaw-real`，安装器会按顺序尝试：

- 使用 `WECLAW_REAL_BUNDLE`
- 从 `~/github代码仓库/weclaw` 构建
- 复用已有 `~/.weclaw/bin/weclaw-real`
- 回退到历史 `~/.weclaw/bin/weclaw`

首次仍需手工执行一次：

```bash
~/.weclaw/bin/weclaw login
```
