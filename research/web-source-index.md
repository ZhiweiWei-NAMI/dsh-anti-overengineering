# 在线原文索引与短摘录

以下页面已阅读。没有确认到允许整篇再分发的开放许可证，因此本包提供直达原文的链接、短摘录及编者概括，不包含整页副本。内容检索日期为 2026-10-19。

## S01 — Anthropic：Prompting best practices

- [原文](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)
- 原作者/发布者：Anthropic。
- 核对章节：Overeagerness；Reduce file creation in agentic coding；Overthinking and excessive thoroughness；Avoid focusing on passing tests and hardcoding。
- 极短摘录：`Avoid over-engineering.`
- 编者概括：范围应贴近当前需求；避免臆想未来用途的包装、配置和防御分支；只保留必要说明，并清理自己的临时文件。通用实现不能以硬编码通过已有测试来替代。
- 适用限制：文中部分行为观察特指 Claude 型号，不能据此声称 DeepSeek 已表现相同，或这些提示词在 Jev 上已经有效。

## S13 — Martin Fowler：Yagni

- [原文](https://martinfowler.com/bliki/Yagni.html)
- 原作者：Martin Fowler，2015-05-26。
- 极短摘录：`You Aren't Gonna Need It`。
- 编者概括：为猜测中的将来需求提前增加功能和扩展点，会带来建设、延迟交付与持续维护成本。判断重点是现在增加了什么复杂度、现在是否使用。文章明确保留改善可修改性的重构及必要测试，并未倡导放弃代码质量。

## S14 — Sandi Metz：The Wrong Abstraction

- [原文](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
- 原作者：Sandi Metz，2016-01-20。
- 极短摘录：`duplication is far cheaper than the wrong abstraction`。
- 编者概括：当所谓通用层依赖越来越多参数和条件分支才能照顾不同调用方时，原来的抽象可能已经失真。适度展开、保留真正不同的逻辑，有时比继续增加共享层的条件更清楚。它没有要求消灭所有抽象或无条件复制代码。

## S15 — Anthropic：Prompting Claude Opus 5

- [原文](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5#task-scope-and-over-verification)
- 原作者/发布者：Anthropic。
- 核对章节：Task scope and over-verification；Controlling subagent spawning；Self-correction。
- 本条不提供逐字摘录。
- 编者概括：官方针对该型号建议去除重复叠加的验证指令，并用确定性限制约束无必要的代理扩张。本文只用于说明“额外审查步骤也有成本”这一设计动机；不能把其关于特定型号的效果直接外推为 DeepSeek 或 Jev 的效果。

## 未计入完整原文的候选

- [oThTJx/dsh-skill-karpathy-guidelines](https://github.com/oThTJx/dsh-skill-karpathy-guidelines)：搜索索引仍有记录，但本次 GitHub API 对仓库返回 404，无法确认当前原文与许可证，不作为实现依据，也不称已下载。
- 《A Philosophy of Software Design》等书籍：有相关思想，但没有取得允许打包全文的许可，未收录书籍或扫描件。
- 多个 Karpathy guidelines 镜像、博客转载和提示词聚合：同义内容多、归属及许可证不一致，选择可追踪的上游仓库并保留来源限制。
