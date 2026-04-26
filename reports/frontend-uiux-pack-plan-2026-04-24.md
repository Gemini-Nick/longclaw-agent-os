# Longclaw Electron UI/UX 方案

日期：2026-04-24

## 0. 本轮使用的前端 skill 包

已安装并校验：

- `frontend-skill`：landing / brand / demo 页节奏与首屏质量。本地兼容 skill，因 OpenAI 当前 main 分支未提供该目录。
- `frontend-design`：高完成度、有辨识度的前端设计实现。
- `figma-implement-design`：Figma 到代码。
- `web-design-guidelines`：UI 审查、可访问性、表单、排版、动效、交互细节。
- `react-best-practices`：React / Next.js 性能与实现质量。
- `playwright`：真实浏览器自动化与截图。
- `webapp-testing`：本地 Web App / Electron 周边验证。
- `canvas-design`：创意视觉探索。
- `brand-guidelines`：品牌一致性。
- `vercel-deploy-claimable`：Vercel 预览部署。本地兼容 skill，路由到 Vercel 当前的 `deploy-to-vercel` skill。
- `frontend-uiux-pack`：本地编排 skill，负责按场景加载上面这些 skill，并把稳定结论写入 MemPalace。

本项目是内部固定工作台，不是营销页，所以本轮主用：

- `frontend-uiux-pack`
- `frontend-design`
- `web-design-guidelines`
- `react-best-practices`
- `webapp-testing`

`frontend-skill` 和 `brand-guidelines` 只用于抽象产品叙事与品牌一致性，不把页面改成 landing page。

## 1. 当前诊断

Longclaw Electron 已经不是空白壳，当前结构是“固定工具区 + 专业工作台”：

- 左侧 rail：固定主导航，策略 / 回测 / 执行 是核心工作面，微信 / 插件 是工具面。
- 中侧 contextual sidebar：按当前页面展示运行态、连接器、最近 flow、能力分组。
- 主工作区：`PackWorkspace` 承载策略、回测、执行、工厂；`WeChatWorkspace` 承载移动入口；`CapabilitiesWorkspace` 承载 runtime / skills / plugins。
- 右侧 drawer：用于记录、payload、任务、artifact 详情。

代码证据：

- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/App.tsx`
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/designSystem.ts`
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/layout.ts`
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/workspaces/TaskWorkspace.tsx`
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/workspaces/CapabilitiesWorkspace.tsx`
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/electron/src/renderer/workspaces/PackWorkspace.tsx`

已验证：

- `npm run lint` 通过。
- `npm run build:electron` 通过。
- `npm run electron:observe -- frontend-uiux-pack-uiux-smoke` 可启动 Electron，renderer `did-finish-load`。
- 最新观察目录：`/Users/zhangqilong/github代码仓库/longclaw-agent-os/reports/product-observations/20260424t134649z-frontend-uiux-pack-uiux-smoke`

暴露的问题：

- 最新 smoke 中 `/api/chart/沪深300?freq=daily` 出现 3 次 404，错误为 `未找到指数: 沪深300`。这不是 UI 崩溃，但说明默认标的、Signals 指数映射、可用数据源状态需要在 UI 前置暴露。
- Electron dev 环境有 CSP warning，日志标记为 dev-only，但打包前仍应设成可审计项。
- 当前信息很丰富，但“用户下一步应该做什么”还不够强，容易变成多个面板并列展示。

## 2. 目标产品姿态

目标不是更炫，而是更像一个专业操作台：

一句话定位：

> Longclaw Electron 是本机多代理操作台：把策略研究、回测验证、执行队列、微信入口、skills/plugins/runtime 管理收束到一个可观察、可恢复、可交接的桌面工作台。

设计原则：

- 工作台优先：首屏不做 hero，不做营销卡片，直接进入可操作状态。
- 状态优先：任何页面都先回答“现在能不能跑、哪里降级、下一步是什么”。
- 证据优先：数据来自哪里、是否缓存、是否 fallback、是否失败必须可见。
- 固定工作流优先：策略 -> 回测 -> 执行 -> 微信反馈 -> 能力工厂，不要让用户在入口之间猜。
- 原始信息收纳：raw id、路径、payload、token、message id 默认进 drawer 或 inspect panel，不出现在主阅读区。
- 中文工作台优先：中文标签应该是主语言，英文只作为可切换或技术标识。

## 3. 信息架构方案

保留现在的 5 个 surface，但重新定义各自职责：

| Surface | 新定位 | 首屏必须回答 |
| --- | --- | --- |
| 策略 | Signals Terminal | 当前市场/标的是否可用？信号是什么？数据新鲜吗？ |
| 回测 | Backtest Lab | 假设是否有效？用的什么数据源？失败能否 fallback？ |
| 执行 | Execution Queue | 哪些工作项在跑、待审、失败、可重试？ |
| 微信 | Mobile Inbox / Dispatch | 哪些移动入口消息需要处理？是否已绑定？是否已转任务？ |
| 工厂 | Capability Factory | 本机/云/WeClaw 哪条执行链可用？哪些 skill/plugin 可调用？ |

建议新增一个全局状态带，放在主工作区顶部，而不是只散落在各页面：

- Runtime：Local / ACP / Cloud / WeClaw
- Data：Signals / Due Diligence / WeChat binding
- Memory：MemPalace loaded / pending / saved
- Capability：当前页面建议 skill 或 plugin

这样用户进入任何页面，都能先看到“当前任务可执行性”。

## 4. 屏幕级 redesign

### 4.1 策略页

当前优点：

- 深色 chart terminal 适合金融工作流。
- 指数列表、买卖点、关键位、周期切换已经有交易工作台感。
- 之前 observation 已验证 30min 切换稳定。

改法：

- 顶部 ticker search 后面加一个 `数据源状态` chip：`live / cache / fallback / missing`。
- 默认标的如果 chart 404，不显示空图或泛化错误，而是显示 `指数映射缺失: 沪深300`，并给出 `切换到深证成指`、`修复映射`、`查看接口响应` 三个动作。
- 周期切换按钮增加 fallback 标识：例如 `15min -> daily fallback` 不要只在日志里出现。
- 右侧买卖点卡片按置信度、动作类型、时间周期分组，不只按列表堆叠。
- 图上提示保留，但关键标签避免遮挡蜡烛主体，低优先级标注进入 hover / drawer。

### 4.2 回测页

当前最需要加强的是数据可信度，而不是图表数量。

改法：

- 回测结果顶部固定三行：`假设`、`数据源`、`可复现命令/参数`。
- `data_source`、`as_of`、`bar_count`、`freshness`、`derived_from`、`partial`、`last_upstream_error` 作为一级 UI 字段展示。
- 当东财失败但缓存或 daily aggregation 成功时，状态应是 `degraded but usable`，而不是隐藏降级。
- 每次回测输出都生成一个可复制的 evidence bundle：参数、数据源、接口耗时、失败源、结论。

### 4.3 执行页

执行页应该成为“工作项控制台”，不只是 pack + console 拼接。

改法：

- 把页面分成三列：`Launch`、`Queue`、`Review/Retry`。
- Queue 默认按行动性排序：failed / needs review / running / scheduled / completed。
- 每个 row 只显示 title、状态、下一步按钮、证据数；详细 payload 进右 drawer。
- 微信跳转上下文保留，但主区只显示 `来自微信会话` + session title + action，不展示 canonical id。
- `local / cloud_sandbox / weclaw_dispatch` 模式选择应和 runtime availability 强绑定，不可用模式直接解释原因。

### 4.4 微信页

已有方向正确：微信是 inbox / dispatch / fallback，不是主工作台。

改法：

- 首屏三块：`绑定状态`、`最近入站`、`待处理/已路由`。
- QR / iLink 绑定流程用 stepper 表达：`生成二维码 -> 等待确认 -> 绑定完成 -> 权限映射`。
- 用户主界面只显示昵称/绑定状态/最近交互，不显示 raw user id、message id、本地路径、token。
- 消息详情内嵌任务转换入口：`转执行任务`、`保存为 review inbox`、`仅标记已读`。
- 附件入口优先预览图/文档类型，路径进入 inspect drawer。

### 4.5 工厂页

工厂页是这次 frontend skill pack 的落点。

改法：

- `Runtime` panel 放第一位：当前本地执行座位、ACP、Local Runtime API、Cloud、WeClaw 是否可用。
- `Skills` panel 新增一个 `Frontend UI/UX Pack` 分组，显示 10 个子 skill 和本地 compatibility aliases。
- 每个 skill row 增加三个动作：`复制调用名`、`加入当前 prompt`、`打开本地路径`。
- 新增 `Memory policy` 小节：显示当前 capability 是否会查 MemPalace、是否会写 MemPalace、Obsidian 是否只收 reviewed。
- 插件开发流水线继续保留，但别和 runtime health 混在一个首屏。

## 5. 视觉系统方案

保留当前“深色专业终端 + 暖色控制台”的方向，但收紧为两套 surface：

- Operational Dark：策略、回测图表、inspect、日志、payload。
- Warm Control Plane：执行、微信、工厂、设置、空状态、配置。

颜色语义：

- teal：live / active / connected。
- copper：primary action / selected / current intent。
- green：success / reviewed / usable。
- yellow：degraded / fallback / needs review。
- red：failed / blocked / repair required。
- slate：navigation / persistent shell。

排版：

- 数据和日志用 mono。
- 标题可以继续用 display serif，但工作台内部标题收小，避免每个 panel 都像 hero。
- 中文标题控制在 2-6 字，说明文字控制在一行到两行。

布局规则：

- 主工作区优先 dense grid，卡片半径控制在 8-12px；当前 `radii.lg=18` 可以只用于外层 section，row 和 buttons 收紧。
- 不再增加嵌套卡片。section 是容器，row/card 是内容单元。
- 按钮尽量使用图标 + tooltip 或短标签；长解释移入 helper text。
- 所有状态 row 固定高度或最小高度，避免刷新时布局跳动。

## 6. 交互与状态模型

统一状态词：

- `ready`
- `running`
- `needs_review`
- `degraded`
- `delivery_failed`
- `repair_required`
- `reviewed`
- `saved_to_mempalace`

统一动作：

- `Run`
- `Review`
- `Retry`
- `Repair`
- `Open Evidence`
- `Save Memory`
- `Dispatch to WeClaw`
- `Copy Mention`

错误处理：

- 数据缺失：显示缺失对象、请求地址、最近成功来源、建议动作。
- runtime 不可用：显示缺失的 seat / script / URL，不让用户点一个必失败动作。
- skill 不可见：显示本地 path、是否需要 Codex restart、是否已在 MemPalace 记录。
- memory 未加载：不阻塞执行，但在结果中标注 `memory not checked`。

## 7. 实施路线

### Phase 1：能力工厂先落地

范围：

- 工厂页新增 `Frontend UI/UX Pack` 分组。
- 识别 `/Users/zhangqilong/.codex/skills/frontend-uiux-pack` 和 10 个子 skill。
- 在 UI 上显示 `MemPalace search/save policy`。

验收：

- 工厂页能看到 10 个前端能力。
- 每个 skill 可复制 mention。
- `frontend-uiux-pack` 能被加到 launcher prompt。

### Phase 2：全局 runtime/data/memory 状态带

范围：

- 在非全屏页面 header 下方加一条 compact status strip。
- 状态源来自 `runtimeStatus`、Signals/Due/WeChat binding、MemPalace policy。
- 策略/回测页额外显示数据源 freshness。

验收：

- 任意页面首屏能看出本地执行是否可用。
- Signals 404 / fallback 不只出现在日志。
- 微信未绑定时，执行入口给出明确原因。

### Phase 3：策略和回测的数据可信度 UI

范围：

- 策略页处理 `沪深300` 映射 404 的可见降级。
- 回测页展示 data_source / derived_from / partial / last_upstream_error。
- 失败接口进入 evidence drawer。

验收：

- `frontend-uiux-pack-uiux-smoke` 不再把 chart 404 变成不可解释失败。
- 404 状态有可点击修复或切换动作。
- 回测 daily/weekly 缓存 fallback 可见。

### Phase 4：执行页重构为 Queue 控制台

范围：

- Launch / Queue / Review-Retry 三列。
- Queue row 标准化。
- 微信 jump context 简化为行动入口。

验收：

- 用户能在 5 秒内知道哪件事要处理。
- failed / needs_review 项优先出现。
- drawer 负责原始 payload，不污染主阅读区。

### Phase 5：微信页收口

范围：

- 绑定流程 stepper。
- 最近入站、待处理、已路由分区。
- 主区隐藏 raw id/path/token，详情 drawer 才展示。

验收：

- 微信页不再像日志浏览器。
- 路由消息到执行页路径清楚。
- 绑定失败有下一步动作。

## 8. 验证计划

每轮 UI 改动必须至少跑：

```bash
cd /Users/zhangqilong/github代码仓库/longclaw-agent-os
npm run lint
npm run build:electron
npm run electron:observe -- <scenario-name>
python3 scripts/product_observation.py finalize --run-dir <run-dir>
```

重点观察：

- renderer 是否 `did-finish-load`。
- `events.jsonl` 是否有页面可见、refresh start/finish、用户动作。
- `api-timings.jsonl` 是否有 failed_api。
- 失败接口是否在 UI 上有同等解释，不只存在 observation。
- 截图覆盖策略、回测、执行、微信、工厂至少各一张。

## 9. MemPalace 保存规则

每次前端 UI/UX 工作结束后，只保存可复用结论：

- 哪些 skill 被使用。
- 哪些 UI 原则已经定为本项目约束。
- 哪个 run_id / observation 证明了当前行为。
- 哪些失败是数据源或 runtime，不是 UI。

不保存：

- 大段原始日志。
- 未确认的临时猜测。
- Obsidian reviewed knowledge 之前的原始聊天过程。

本轮应写入 MemPalace 的稳定结论：

- `frontend-uiux-pack` 是 Longclaw Electron 前端工作的默认编排入口。
- Longclaw Electron 目标形态是固定专业工作台，不走 landing-page/marketing 风格。
- 策略/回测必须把数据源健康、fallback、404 映射问题前置显示。
- 工厂页应成为 skills/plugins/runtime/memory policy 的能力中枢。
