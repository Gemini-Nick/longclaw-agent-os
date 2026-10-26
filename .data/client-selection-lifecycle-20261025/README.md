# 标的切换生命周期与来源显示补丁

源码冻结，待root一次构建/安装/实机验收。仅改StrategyChartTerminal.tsx和其test。

实际React挂载/延迟API回归覆盖：旧A迟成功/迟503、旧A finally不清新B加载、语言/连接变化保留B、刷新等待期间选B后不再发旧A。旧源码隔离副本中4失败/1对照通过，当前127/127通过，保留原109。另2个SSR反例证实auto查池未命中会被旧面板错误显示池外/忽略。

用户intent/epoch加请求ownership防覆盖；未确认标的只显示正在读取/判断待确认，不借光标或旧图。明确SZ股票码不走auto，SH000300保留指数路径。东财报价已验证仅适用于显式成功证明的push2delay.ulist.quote/stock.get，最高partial，其他接口分别核验，不凭HTTP或旧status洗绿。

root lint通过；renderer全项目类型检查既存79个诊断，内存覆盖baseline比较仍79且新增0，不修无关错误。

source哈希：
- electron/src/renderer/workspaces/StrategyChartTerminal.tsx：bfd89bed4eb75310800fc95e04a769f65cc58a791da9130c68c6f4d1dea55b25
- electron/src/renderer/workspaces/StrategyChartTerminal.test.tsx：27f1fb8799b11115d8f85f9b321cf63556b4171fc3f2719670a1ad4106137673

详见final-review.json、before-lifecycle-results.json、renderer-typecheck-comparison.json。0真实UI/网络/provider/业务/服务动作，无依赖变更。
