# 来源与召回

- 本目录 `MEMORY_INDEX.json`：本主题历史卡片与证据类型。
- 同目录 `SESSION_INDEX.json`：实际归属、评估归属、日常入口与源工作区分别记录。
- MemPalace仅作为原文召回层，检索时指定本主题 wing 与 room，再沿source_file返回本地原文包及原聊天。
- 源目录访问若未由应用确认，保留访问限制，不把索引当作授权。

## 现有项目说明

- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/AGENTS.md`。
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/PROJECT.md`。
- `/Users/zhangqilong/github代码仓库/longclaw-agent-os/README.md`。

## 本地检索回退

记忆服务不可用时，只搜索本项目及其已归集的来源主题：

```sh
python3 /Users/zhangqilong/github代码仓库/agent-collab-ops/scripts/search_project_context.py --project fd855365-ec3b-44c2-8393-38a99874558a --query "关键词" --limit 5
```

返回原文片段、角色、性质、原聊天和本地卡片；先核验时间与新决定，再用于当前任务。

`CONTEXT_MAP.json` 列出本入口下各专题的规范目录、MemPalace wing与room位置；只按匹配专题召回。
