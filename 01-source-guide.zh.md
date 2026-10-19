# 原始资料与来源导读

这份资料包收录了与反过度工程化规则和原生 DeepSeek Harness 接入直接相关的原文，并保留了用户提供的 AutoCTX 1.2.2 报告。规则的最终解释及中英文修改提示见 [02-rules-and-prompts.zh.md](02-rules-and-prompts.zh.md)。原始文档用于核对来源，运行时规则以该文档及其对应的 [rules.json](dsh-anti-overengineering/rules.json) 为准。

## 1. 收录范围与准确数量

`research/` 共 **111 个文件**。其中 **103 个原始文件保持原始字节**，另有 8 个编者整理的报告、索引、许可说明或清单。原始正文按文件计数为 **71 份**：DeepSeek Harness 的 59 份 Markdown 文档、外部工程来源的 11 份正文，以及用户提供的 1 份报告。中英文版本各计一个文件，源码、配置和许可证不混入正文数量。

| 资料组 | 原始文件数 | 文件组成 |
|---|---:|---|
| 原生 DeepSeek Harness | 85 | 59 份 Markdown 文档、21 份 TypeScript 源码、4 份 YAML 配置、1 份 LICENSE |
| 外部工程资料 | 17 | 11 份原始正文，另附 6 份原始许可证、NOTICE 或 README 归属说明 |
| 用户资料 | 1 | AutoCTX 1.2.2 的 Jev 提示词与上下文机制报告 |
| 原始文件合计 | **103** | 合计 **1,504,297 字节**，逐文件核对 SHA-256 |
| 编者整理文件 | 8 | 来源报告、网页索引、检索记录、来源清单、许可事实说明和完整性清单 |

外部工程检索组有 **15 个来源条目（S01—S15）**。其中 11 个来源附完整正文，4 个网页未确认整篇开放许可，保留链接、短摘录或摘要。15 不是整个资料包所有文件的数量，也不是“已经穷尽互联网”的声明；它不包含另列的原生 DSH 资料组和用户资料组。

## 2. 如何找到原文与来源信息

| 文件或目录 | 内容 |
|---|---|
| [source-report.md](research/source-report.md) | 外部来源检索结论、规则候选及其适用边界；其中 C 前缀是研究阶段候选，最终规则采用 AE01—AE10 |
| [source-manifest.json](research/source-manifest.json) | S01—S15 的 URL、原始路径、固定 commit、许可、字节数与哈希 |
| [web-source-index.md](research/web-source-index.md) | 4 个仅保留在线索引的原文及摘要，另记未纳入的候选 |
| [search-log.json](research/search-log.json) | 检索词、检索方法、覆盖与排除项 |
| [native-source-manifest.json](research/native-originals/native-source-manifest.json) | 官方 DSH 的 85 个原始文件及固定来源 |
| [user-source-manifest.json](research/user-originals/user-source-manifest.json) | 用户原文的版本、采样时间与完整性信息 |
| [originals-integrity.json](research/originals-integrity.json) | 103 个原始文件的 SHA-256 核对结果与包内路径 |

正文放在 `research/external-originals/`、`research/native-originals/deepseek-harness/` 和 `research/user-originals/`。官方文件保留原来的目录结构，包括 10 个位于 `.agents/` 下的已选原文。资料包没有复制完整 Git 仓库、`.git` 或 `node_modules`。

## 3. 外部 15 个来源及许可

表中的完整正文链接指向包内文件；网页条目的链接指向原作者页面。各仓库正文对应的固定 commit URL 均在来源清单中，方便核对所用版本。

| ID | 来源 | 发布者 | 许可记录 | 本包内容 |
|---|---|---|---|---|
| S01 | [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness) | Anthropic | 未确认整篇开放许可 | 原文链接、短摘录或摘要 |
| S02 | [What to look for in a code review](research/external-originals/google-eng-practices/looking-for.md) | Google | CC-BY-3.0 | 原始正文完整收录 |
| S03 | [Small CLs](research/external-originals/google-eng-practices/small-cls.md) | Google | CC-BY-3.0 | 原始正文完整收录 |
| S04 | [The Standard of Code Review](research/external-originals/google-eng-practices/standard.md) | Google | CC-BY-3.0 | 原始正文完整收录 |
| S05 | [Speed of Code Reviews](research/external-originals/google-eng-practices/speed.md) | Google | CC-BY-3.0 | 原始正文完整收录 |
| S06 | [Codex GPT-5.2 general coding prompt](research/external-originals/openai-codex/gpt_5_2_prompt.md) | OpenAI | Apache-2.0 | 原始正文完整收录 |
| S07 | [Codex GPT-5.2-Codex prompt](research/external-originals/openai-codex/gpt-5.2-codex_prompt.md) | OpenAI | Apache-2.0 | 原始正文完整收录 |
| S08 | [Anthropic Code Simplifier agent](research/external-originals/anthropic-code-simplifier/code-simplifier.md) | Anthropic | Apache-2.0 | 原始正文完整收录 |
| S09 | [Karpathy-inspired behavioral guidelines](research/external-originals/karpathy-inspired/CLAUDE.md) | multica-ai 社区项目 | 上游 README 声明 MIT；无独立 LICENSE | 原始正文完整收录 |
| S10 | [PEP 20 — The Zen of Python](research/external-originals/python-peps/pep-0020.rst) | Tim Peters / Python | 文中声明 Public domain | 原始正文完整收录 |
| S11 | [Testing Library Guiding Principles](research/external-originals/testing-library/guiding-principles.mdx) | Testing Library | MIT | 原始正文完整收录 |
| S12 | [Testing Library Introduction](research/external-originals/testing-library/intro.mdx) | Testing Library | MIT | 原始正文完整收录 |
| S13 | [Yagni](https://martinfowler.com/bliki/Yagni.html) | Martin Fowler | 未确认整篇开放许可 | 原文链接、短摘录或摘要 |
| S14 | [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) | Sandi Metz | 未确认整篇开放许可 | 原文链接、短摘录或摘要 |
| S15 | [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5#task-scope-and-over-verification) | Anthropic | 未确认整篇开放许可 | 原文链接、短摘录或摘要 |

Google 的 CC-BY-3.0、OpenAI 和 Anthropic 的 Apache-2.0、Testing Library 的 MIT 文本及有关 NOTICE 已随原文保留。PEP 20 在原文中声明 Public domain。

S09 是社区对 Karpathy 观察的整理，不应标为“Karpathy 官方规范”。其 README 声明 MIT，但没有独立 LICENSE 文件；本包通过 [LICENSE-EVIDENCE.md](research/external-originals/karpathy-inspired/LICENSE-EVIDENCE.md) 记录这一事实，不补造上游未提供的版权主体或年份。

S01、S13、S14、S15 没有确认到允许整篇再分发的开放许可，因此未附整页副本。它们的原始链接与摘要都在网页索引中。S15 包含特定 Claude 型号的行为建议，只用于了解额外验证的成本，不能直接作为 DeepSeek 或 Jev 已取得相同效果的证据。

## 4. 官方 DeepSeek Harness 原文分类

官方资料固定在 [deepseek-ai/deepseek-harness 的 687f282e8625c6b8d11ff58211a90524be2e4317](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317)，默认分支为 `master`，版本为 `0.2.1-rc.2`，核查日期为 2026-10-19。原文按项目的 [MIT LICENSE](research/native-originals/deepseek-harness/LICENSE) 收录。

| 类别 | 主要原文 | 在本资料包中的作用 |
|---|---|---|
| 工程原则与精简 | [AGENTS.md](research/native-originals/deepseek-harness/AGENTS.md)、[dsh-find-simplifications](research/native-originals/deepseek-harness/.agents/skills/dsh-find-simplifications/SKILL.md)、[依赖策略](research/native-originals/deepseek-harness/.agents/notes/implemented/process/2026-07-26-dependencies-over-hand-rolling.zh.md) | 区分真实消费者与假想能力，评估包装、配置和依赖的实际收益 |
| 审查、验证与说明 | [定向检查](research/native-originals/deepseek-harness/.agents/skills/dsh-pre-push-checks/SKILL.md)、[说明规范](research/native-originals/deepseek-harness/.agents/skills/dsh-prose-standard/SKILL.md)、[代码审查](research/native-originals/deepseek-harness/.agents/skills/dsh-code-review/SKILL.md)、[测试说明](research/native-originals/deepseek-harness/docs/testing.zh.md) | 选择与改动有关的证据，控制无关整理和重复说明，保留必要检查 |
| 真实故障与必要处理 | [防御模式总览](research/native-originals/deepseek-harness/docs/defensive-patterns/README.zh.md)、[通用模式](research/native-originals/deepseek-harness/docs/defensive-patterns/general.zh.md) 及同目录的 package、remote、client、session 文档 | 说明哪些边界、并发和生命周期处理由真实故障产生，避免反过度工程规则误删它们 |
| 原生组合与预设 | [Cordis 入门](research/native-originals/deepseek-harness/docs/cordis-primer.zh.md)、[Preset](research/native-originals/deepseek-harness/packages/preset/agent-preset/README.zh.md)、[Preset registry](research/native-originals/deepseek-harness/packages/preset/agent-preset-registry/README.zh.md) 及官方 bundle/preset YAML | 核对 profile、bundle、preset、patch 的真实结构 |
| 工具与消息注入 | [工具说明](research/native-originals/deepseek-harness/packages/core/tools/README.zh.md)、[tools/index.ts](research/native-originals/deepseek-harness/packages/core/tools/src/index.ts)、[原生重复工具提醒](research/native-originals/deepseek-harness/packages/guard/repeat-tool-reminder/src/index.ts) 及文件工具源码 | 核对写入前判断、拒绝结果和后续上下文的接入点 |
| 会话与持久状态 | [Session](research/native-originals/deepseek-harness/packages/core/session/README.zh.md)、[Session projection](research/native-originals/deepseek-harness/packages/session/session-projection/README.zh.md)、[storageDomain](research/native-originals/deepseek-harness/packages/storage/storage-domain/README.zh.md)、[旧事件读取接口弃用说明](research/native-originals/deepseek-harness/.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.zh.md) | 核对会话轮次、恢复和原生存储能力 |

这些资料按主题有交叉，表格不另行累计文件数。85 个具体文件以原生来源清单为准。`defensive-patterns` 记录的是实际故障与处理原则，不能整体理解成“不要防御”；仓库贡献流程也不能不加区别地变成用户所有项目的额外步骤。

## 5. 用户原文版本与当前接口的区分

用户提供的 [Jev-Prompt-Templates-and-Context-Mechanisms.md](research/user-originals/Jev-Prompt-Templates-and-Context-Mechanisms.md) 已原样保留。该文档的标题和开头明确限定为 **AutoCTX 1.2.2**，采样时间为 **2026-10-17 13:47:39—13:49:10 UTC**，即上海时间 **21:47:39—21:49:10**；对照对象是 **AutoCTX 1.2.0 / 9bb23b5**。它记录静态模板与上下文构造，不是实际运行效果或跑分报告。

| 资料 | 本次应如何使用 |
|---|---|
| 用户的 AutoCTX 1.2.2 报告 | 理解原来的任务、策略、路由、筛选与学习问题如何组织 state/questions；保留其历史版本和服务器行号 |
| 本次核对的 [AutoCTX 1.2.6 源码](https://github.com/ZhiweiWei-NAMI/dsh-autoctx/tree/f6f71eccadb3cbd1ce94bc14e08154c4735366c3) | 作为较新插件实现的旁证；不能把旧报告的行号、预算或模型选择策略直接标成新版行为 |
| [TypeSafe 官方 OpenAPI](https://api.typesafe.ai/openapi.json) | 本次核对的 API 描述版本为 0.2.0；它定义 HTTP 请求与响应字段，而非某个第三方插件的 service 返回值 |
| 官方 DSH 固定源码 | 核对宿主可用的工具事件、Preset 与存储接口；它没有内置 `ctx.jev` 服务 |

当前接口核查采用 `model`、`state`、`questions` 的判断请求；规则使用 `noul`，原始 HTTP 响应读取 `answers[ruleId].noul`。这与第三方插件把结果转换成数组或改名为 `probability` 的 service 返回值需要区分。接口来源见 [TypeSafe OpenAPI](https://api.typesafe.ai/openapi.json) 和已核对的 [Jev plugin wire.ts](https://github.com/luobosibing2/dsh-jev-plugin/blob/c983390d307f2228ff4d2a88d9709adcb3b2a806/packages/jev/src/wire.ts)；这里不把它们作为原生 Harness 内置 API，也没有将第三方完整仓库一并打包。

本资料目录没有整份附带未确认再分发许可的 TypeSafe OpenAPI 快照或 OpenRouter 网页。用户原文内的 `/mnt/data2/...` 服务器路径和动态占位符保持原样，供追溯当时的核查范围；它们不代表本包包含该服务器上的全部代码。

## 6. 原文完整性与链接核对

复制时使用保留目录结构的方式，包含已经收集到的隐藏目录文件。108 个准备好的 research 文件与复制前的文件逐字节一致；加入用户原文后，103 个原始文件的长度和 SHA-256 均与对应来源记录或用户原文件一致。完整清单见 [originals-integrity.json](research/originals-integrity.json)。编者的来源报告、索引、最终规则和本导读均单独保存，没有写入原始正文。

用户原文的 SHA-256 为：

```text
92766a931809cdcdc23a701af888be9da5b11fa62f3b97dd971f889b0480a8e6
```

[规则文档](02-rules-and-prompts.zh.md) 的 3 个包内相对链接已经逐一核对目标存在，45 处来源链接与已核实的 manifest URL 对应。这项核对确认包内路径与来源归属，没有重新请求每个网页，也不等于验证 Jev 的判断准确率或用户环境中的安装结果。
