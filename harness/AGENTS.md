# Harness

最小 harness 控制面放在这个目录。

项目清单：

- `knowledge-base`: `/Users/zhangqilong/Desktop/知识库`
- `agent-os`: `/Users/zhangqilong/github代码仓库/longclaw-agent-os`
- `weclaw`: `/Users/zhangqilong/github代码仓库/weclaw`
- `signals`: `/Users/zhangqilong/github代码仓库/Signals`
- `watchdog`: 远端占位，当前仅登记接口

常用命令：

- `node harness/bin/harness list`
- `node harness/bin/harness doctor`
- `node harness/bin/harness eval knowledge-base`
- `node harness/bin/harness eval agent-os`
- `node harness/bin/harness eval weclaw`
- `node harness/bin/harness eval signals`
- `node harness/bin/harness fix-plan signals`
- `node harness/bin/harness autofix signals`
- `node harness/bin/harness autorefactor knowledge-base`
- `node harness/bin/harness hold weclaw`
- `node harness/bin/harness tick`
- `node harness/bin/harness notify <failure_id>`
- `node harness/bin/harness resolve <failure_id>`
- `node harness/bin/harness report knowledge-base`

规则导航：

- 项目注册表：`harness/projects/projects.yaml`
- 硬规则：`harness/policies/golden-principles.md`
- 报告目录：`~/.longclaw/runtime-v2/state/harness/generated/`
