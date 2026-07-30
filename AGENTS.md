# Project Rules

- 本项目拥有隆小侠 Agent OS 的 Electron UI、运行时、安装包、第二屏、服务编排和跨能力集成。
- Signals 数据、信号、三池、回测和 MCP 进入 `Signals｜A股信号引擎`。
- 市场解释和报告审阅进入 `市场研究｜A股与 WorkBuddy`。
- WorkBuddy Replay 工程进入 `WorkBuddy｜复盘工程`。
- 服务调整前先只读检查用途、依赖、KeepAlive、影响和回滚；不要先卸载。
- 健康检查必须同时核对进程、API、关键 lane、`session.ready` 和 Git 阻塞状态。
- 构建、打包或安装前明确目标环境；不得把开发成功等同于已发布。
- 保留用户未提交修改；不要用破坏性 Git 命令清理工作树。
