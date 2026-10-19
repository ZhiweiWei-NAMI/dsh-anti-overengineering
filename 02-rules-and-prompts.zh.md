# AE 规则与修改提示词

本文保留原版十条规则的解释与提示词，对应当前 [rules.json](dsh-anti-overengineering/rules.json)。规则中的写入、补丁措辞保留原文；当前插件仅采集决策与行为记录作为评审依据，运行方式见[插件说明](dsh-anti-overengineering/README.md)。

本规则库用于检查当前准备写入的代码是否增加了任务用不到的复杂性，并在需要时提示代理收敛实现。用户已经要求的功能、必要调用方、真实故障处理和验收要求都应保留。AE01—AE09 覆盖常见扩张，AE10 保留任务完整性和可读性。

本文对应 [rules.json](dsh-anti-overengineering/rules.json)。每条规则的中文判定依据、具体例子和豁免在下文解释；中英文修正提示与 JSON 中的 `correction_zh`、`correction_en` 逐字一致。

## 如何理解一条命中

Jev 对每条规则返回 noul 分数。本版本没有从 Jev 返回文件位置、行号或具体违规片段，因此命中表示“本批写入值得按该规则重新检查”，不能直接当作已定位并证明的缺陷。下面的修正提示要求代理核对并精简，没有填入虚构的证据或定位。

判断应结合当前用户需求、准备写入的内容和已知接口约束。缺少信息不等于某项需求不存在；类、接口、try/catch、配置、测试和依赖也不应仅凭形式被判违规。用户明确要求的阈值、冷却与会话频率属于当前需求。

## 规则总览

| 编号 | 规则 | 核心判断 |
|---|---|---|
| AE01 | 任务范围扩张 | 新增工作与当前任务是否有必要联系？ |
| AE02 | 假想未来需求与配置膨胀 | 新增选项是否现在就有真实用途？ |
| AE03 | 一次性抽象与多层包装 | 新封装是否带来当前可说明的收益？ |
| AE04 | 假设性防御与重复校验 | 新增防御是否对应真实可到达的失败路径？ |
| AE05 | 无依据兼容层与双路径 | 兼容路径是否服务于受支持的消费者？ |
| AE06 | 无依据的性能机制 | 性能机制是否有当前目标或复杂度依据？ |
| AE07 | 无关重构、格式与说明扩散 | 整理和说明是否只覆盖实际受影响的部分？ |
| AE08 | 低价值测试与验证扩张 | 新写的测试是否增加有效的行为证据？ |
| AE09 | 多余脚手架、产物与依赖 | 额外工具、产物和依赖是否降低总复杂度？ |
| AE10 | 精简损伤行为或可读性 | 精简后是否完整、可读且保留必要处理？ |

## AE01　任务范围扩张

### 中文判定

这批写入是否增加了当前任务之外的行为，或修改了与任务没有必要依赖的部分？判断单位是需求与改动的关系，文件数量和补丁长度只是线索。用户要求完整功能时，完成端到端链路仍在范围内。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 用户只要求修复列表滚动后位置跳动，却在同批补丁中增加主题选择器，并重构其他页面的全局状态。 |
| 不应触发 | 修复参数类型后，同步调整实际调用方及显示结果的组件，使原来的业务流程继续工作。 |

### 豁免与边界

用户要求的完整实现、直接依赖、必要的调用方同步、随行为变化必须更新的说明。

依赖改动必须说明它与本次目标的实际联系。不要为追求小补丁留下未接通的接口或缺失的调用方。

### 修改提示词（中文）

> 将本批补丁收敛到当前任务与直接受影响的调用方，撤去不能说明与需求关系的额外功能和无关修复。保留原任务所需的完整行为，随后继续实施。

### 修改提示词（英文）

> Keep this patch focused on the requested behavior and its directly affected callers. Remove unrelated features and fixes. Preserve the complete requested result, then continue implementation.

### 来源与归纳关系

直接支持。相关原文明确要求改动围绕当前任务，并保留必要调用方与配套说明。不能把“聚焦”解释成只做局部代码、放弃用户要求的完整结果。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S03 · 小改动](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/developer/small-cls.md)；[S06 · Codex](https://github.com/openai/codex/blob/d28be12577cf5e267c97d3018a490d76da4d28e7/codex-rs/core/gpt_5_2_prompt.md)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[DSH · 项目规范](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/AGENTS.md)。

## AE02　假想未来需求与配置膨胀

### 中文判定

新增配置、策略分支或扩展点是否只服务于尚未出现的未来场景？需要结合当前需求判断它是否现在就有用途；不能只因为出现了配置对象就认定过度工程化。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 当前只导出 CSV，也没有扩展需求，却加入格式插件注册中心、动态加载器和三个未使用的导出接口。 |
| 不应触发 | 用户要求“同一规则连续六轮内不重复触发”，因此把六轮写成可调配置，同时提供全会话触发次数上限。 |

### 豁免与边界

已明确的部署差异与当前功能；用户要求的阈值、冷却、频率配置。

本用户明确要求的规则阈值、全局冷却、同规则冷却与会话频率控制必须保留。部署环境确实不同而需要变化的参数，也属于当前需求。

### 修改提示词（中文）

> 删除仅服务于假设未来需求的开关、策略分支和扩展点，采用满足当前场景的直接实现。保留用户明确要求的配置，尤其是阈值、冷却与会话频率，不能借精简省略它们。

### 修改提示词（英文）

> Remove options, branches and extension points that serve only hypothetical future needs. Implement the current use case directly. Keep explicitly requested configuration, including thresholds, cooldowns and session frequency controls.

### 来源与归纳关系

直接支持。YAGNI 与 AI 编程指令均反对为假想用途先增加复杂性。把这些原则具体用于配置项时，必须区分“未经要求的灵活性”和“用户已经要求的可调行为”。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S02 · Google 审查](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/looking-for.md)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[S13 · YAGNI](https://martinfowler.com/bliki/Yagni.html)；[DSH · 精简规则](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/skills/dsh-find-simplifications/SKILL.md)。

## AE03　一次性抽象与多层包装

### 中文判定

新增抽象是否减少了当前理解成本，隔离了真实职责，满足现有接口，或服务于具体消费者？如果它只是增加传参、跳转和包装层，应考虑直接表达。只有一个调用方并不能单独证明它多余。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 为把对象数组映射成名称列表，新增抽象基类、工厂、唯一策略实现和一层代理，而实际逻辑只有一次 map 调用。 |
| 不应触发 | 把独立且复杂的概率计算提取为命名清楚的函数。即使现在只有一个调用方，它也能降低主流程的阅读成本。 |

### 豁免与边界

单一调用也可封装真实复杂性；已有接口、真实隔离需求或实际复用。

不要按“一处调用就必须内联”机械执行，也不要因两段代码看起来相似就强制统一。保留承担真实业务差异、资源隔离或稳定接口职责的封装。

### 修改提示词（中文）

> 检查本批新增的抽象和包装，把没有当前复用、隔离或可读性收益的部分改为清晰的局部逻辑或直接调用。保留已有接口和确有作用的封装，只调整本次新增的多余结构。

### 修改提示词（英文）

> Replace new abstractions and wrappers that provide no current reuse, isolation or readability benefit with clear local logic or direct calls. Keep required interfaces and useful encapsulation; limit changes to unnecessary structure introduced by this patch.

### 来源与归纳关系

直接支持。原文支持移除无收益的包装和错误抽象，同时要求保留有助于理解的封装。S09 为社区整理的 Karpathy-inspired 指南，不是 Karpathy 本人发布的官方规范。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S02 · Google 审查](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/looking-for.md)；[S08 · Code Simplifier](https://github.com/anthropics/claude-plugins-official/blob/ea10b213686c90bb1984b2016937310e05336cf3/plugins/code-simplifier/agents/code-simplifier.md)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[S14 · 错误抽象](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)。

## AE04　假设性防御与重复校验

### 中文判定

这段新增防御是否有实际可到达的失败路径？同进程已受静态类型和调用约定约束的值，不需要为假设中的任意输入重复建立校验与回退。外部数据进入程序的检查仍可能是必需的。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 一个同进程函数只接收类型明确的已解析配置，却新增十种不可能输入的分支；任何异常都被替换成看似成功的默认结果。 |
| 不应触发 | 检查外部 Jev 返回的 noul 是否为 0 到 1 的有限数值，或在读取持久化配置时校验字段类型。 |

### 豁免与边界

真实外部输入、API 返回、持久文件、已知并发风险、必要鉴权、已观测故障。

模型响应、文件内容、队列消息、跨进程值和网络返回都可能越过静态类型的保证范围。看到 try/catch、可选参数或校验代码本身，不足以判定违规；已有故障证据要求的处理应保留。

### 修改提示词（中文）

> 去掉内部已保证条件的重复校验，以及没有可发生路径依据的重试、默认结果和兜底分支。按现有接口实现；保留真实外部输入校验、明确安全要求与已知故障处理。

### 修改提示词（英文）

> Remove redundant checks for conditions already guaranteed internally, and retries or fallback branches without a reachable failure case. Keep validation of actual external inputs, explicit security requirements and handling of observed failures.

### 来源与归纳关系

直接支持，并保留原文的边界例外。Anthropic 与 DeepSeek Harness 项目规范均区分内部可信接口和真实外部输入；本规则不把“防御性代码”整体视为坏代码。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[DSH · 项目规范](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/AGENTS.md)；[DSH · 防御模式](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/defensive-patterns/general.md)。

## AE05　无依据兼容层与双路径

### 中文判定

新增旧入口、别名、双写或降级路径，是否有受支持的消费者或明确迁移要求？应根据真实支持范围判断，不能仅因本轮上下文没出现旧调用方就断定它不存在。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 项目已明确只支持新版接口，旧调用方也已迁移完成，却又为三个历史版本增加适配层和双写逻辑。 |
| 不应触发 | 已有部署仍读取旧字段，用户承诺在迁移期保持兼容，因此保留旧字段并按计划完成迁移。 |

### 豁免与边界

已确认的旧消费者、用户兼容承诺、真实迁移与发布接口要求。

先服从已经确认的支持范围、迁移窗口与兼容承诺。没有足够上下文时，不得让代理自行删除可能仍在使用的接口。

### 修改提示词（中文）

> 对照当前受支持的消费者，删除没有兼容承诺或迁移需求的旧入口、别名、双写与降级分支，收敛到当前约定的实现。保留已有明确兼容要求，不擅自破坏旧调用方。

### 修改提示词（英文）

> Remove legacy entry points, aliases, dual writes and downgrade branches that no supported consumer or migration requires. Keep one current implementation where appropriate, while preserving confirmed compatibility obligations.

### 来源与归纳关系

由范围和当前消费者原则推导。YAGNI、Google 审查规范及 DSH 精简规则支持检查真实需求，但“无依据兼容层”是本规则库归纳出的具体类别，不是所有来源共有的独立原句。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S02 · Google 审查](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/looking-for.md)；[S13 · YAGNI](https://martinfowler.com/bliki/Yagni.html)；[DSH · 精简规则](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/skills/dsh-find-simplifications/SKILL.md)。

## AE06　无依据的性能机制

### 中文判定

新增缓存、并发、批处理或状态管理是否服务于当前性能目标？明确规模要求、算法复杂度已经显示的问题、实际瓶颈和用户直接要求，都可以构成依据；不必每次先搭一套基准测试。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 只是读取一个很小的本地配置文件，却为“以后配置可能变大”新增分布式缓存、后台刷新线程和失效广播。 |
| 不应触发 | 十条规则可以通过一次 Jev 批量请求完成判断，因此合并请求以减少明确存在的远程调用开销。 |

### 豁免与边界

明确性能任务、复杂度已不可接受、规模约束、已观测瓶颈或用户直接要求。

用户已要求的并发、批处理或持久化不能因这条规则被省略。判断收益时也要计算机制带来的状态管理与维护成本。

### 修改提示词（中文）

> 移除没有当前性能目标或瓶颈依据的缓存、并发和状态管理，采用满足现有规模的直接实现。若用户指标或复杂度已说明其必要性，保留最小有效机制并说明它服务的具体目标。

### 修改提示词（英文）

> Remove caches, concurrency and state management without a present performance requirement or bottleneck. Use a direct implementation that meets current scale. Retain the smallest mechanism justified by explicit targets or algorithmic complexity.

### 来源与归纳关系

工程推导。来源支持以当前需求、事实与复杂度判断方案；本规则将其用于性能机制。这里没有声称缓存或并发天然多余，也没有把基准测试设为所有优化的前提。

[S02 · Google 审查](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/looking-for.md)；[S04 · 审查标准](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/standard.md)；[S13 · YAGNI](https://martinfowler.com/bliki/Yagni.html)；[DSH · 精简规则](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/skills/dsh-find-simplifications/SKILL.md)。

## AE07　无关重构、格式与说明扩散

### 中文判定

这批写入是否把局部任务扩展成无关重构、格式统一或说明补写？必要说明应跟随行为变化更新，但不应顺手整理未受影响的代码或到处重复同一段解释。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 修复一个按钮后格式化整个仓库，为未改动的函数批量补注释，并新增多份重复说明。 |
| 不应触发 | 新增配置能力时，更新 README 中的配置字段、实际默认值和使用步骤。 |

### 豁免与边界

改动导致旧说明失效、必要用户文档、清理本轮新产生的无用符号。

本次改动新造成的未使用符号可以清理。公开行为、失败方式、使用条件发生变化时，该补的文档仍要补，不能以减少文字为理由留下过时说明。

### 修改提示词（中文）

> 保留本次行为变化必须涉及的代码、格式与说明更新，撤回无关整理、批量注释和重复文档。清理本轮新增的无用符号即可，沿用周边现有风格。

### 修改提示词（英文）

> Keep code, formatting and documentation changes required by this behavior change. Revert unrelated cleanup, bulk comments and duplicated documentation. Remove unused symbols introduced by this patch and follow the surrounding style.

### 来源与归纳关系

直接支持。原文强调局部改动、必要说明和既有风格；DSH 说明规范同时要求保留使用者真正依赖的行为、失败和时序事实。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S03 · 小改动](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/developer/small-cls.md)；[S07 · Codex 编辑约束](https://github.com/openai/codex/blob/d28be12577cf5e267c97d3018a490d76da4d28e7/codex-rs/core/gpt-5.2-codex_prompt.md)；[S08 · Code Simplifier](https://github.com/anthropics/claude-plugins-official/blob/ea10b213686c90bb1984b2016937310e05336cf3/plugins/code-simplifier/agents/code-simplifier.md)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[DSH · 说明规范](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/skills/dsh-prose-standard/SKILL.md)。

## AE08　低价值测试与验证扩张

### 中文判定

待写入的测试内容是否只复刻实现、固定无关内部细节，或为已被充分验证的行为增加重复负担？评价的是测试带来的新增证据，不能按测试数量、文件后缀或断言数量直接定罪。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 仅调整一处可逆样式，却新增测试框架；测试只逐步断言私有 helper 如何调用另一个 helper，用户可观察到的结果没有被验证。 |
| 不应触发 | 针对真实工具行为，验证写入前被拒绝时文件没有变化，并检查修正提示确实进入后续上下文。 |

### 豁免与边界

错误复现、真实行为回归、必要接口与失败路径、现有必需 gate、用户要求。

本规则只评估纳入本批候选写入的测试文件或测试内容。它不能检测、阻止或限频“没有文件写入、只是反复执行测试命令”的纯 Bash 调用。同一行为的不同输入、故障条件或平台若覆盖不同风险，仍可保留；用户指定测试与现有必需检查也应保留。

### 修改提示词（中文）

> 让测试直接验证本次变化的可观察行为，删除复刻实现、锁定无关内部细节或重复已有证据的测试。只补能消除具体剩余风险的验证；满足当前验收与必要检查后继续交付，不因本提醒扩建测试体系。

### 修改提示词（英文）

> Test the observable behavior changed by this patch. Remove implementation-mirroring, irrelevant internal assertions and redundant coverage. Add only verification that resolves a concrete remaining risk; complete the required checks and proceed to delivery.

### 来源与归纳关系

测试质量有直接依据；验证规模的取舍同时体现用户偏好。Google 要求必要测试，Testing Library 提倡验证实际使用行为，Codex 与 DSH 支持选择受影响范围的检查。原文不能被概括为“不要测试”或“只要测试少”。

[S02 · Google 审查](https://github.com/google/eng-practices/blob/3bb3ec25b3b0199f4940b1aa75f0ac5c5753301c/review/reviewer/looking-for.md)；[S06 · Codex](https://github.com/openai/codex/blob/d28be12577cf5e267c97d3018a490d76da4d28e7/codex-rs/core/gpt_5_2_prompt.md)；[S11 · 测试原则](https://github.com/testing-library/testing-library-docs/blob/7c49d046b100e657c64bae78270a5813c1c02eb6/docs/guiding-principles.mdx)；[S12 · 测试行为](https://github.com/testing-library/testing-library-docs/blob/7c49d046b100e657c64bae78270a5813c1c02eb6/docs/intro.mdx)；[DSH · 项目规范](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/AGENTS.md)；[DSH · 定向检查](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/skills/dsh-pre-push-checks/SKILL.md)。

## AE09　多余脚手架、产物与依赖

### 中文判定

新增工具链、脚本、产物或依赖是否降低了当前任务的总复杂度？已有能力已经足够时，不应再建立一套平行体系；成熟依赖若能替换大量自有实现，也可能是合理精简。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 为了发送一次已有 HTTP 客户端能够完成的请求，另建 provider 框架、专用配置格式和管理界面。 |
| 不应触发 | 复用 Harness 原生 storageDomain 保存用户要求的会话冷却计数；或用维护良好的协议解析库替换项目中重复手写的解析与专门测试。 |

### 豁免与边界

能实际减少维护代码的成熟依赖、当前功能必需的状态、用户要求的可复用文件。

必要持久状态、用户要求的可复用文件和真正减少维护代码的成熟依赖均应保留。不能按依赖个数判断，也不能在“避免依赖”的名义下重新手写成熟基础能力。

### 修改提示词（中文）

> 优先使用现有项目和 Harness 能力，移除本任务不需要的工具链、脚手架、临时产物与依赖。保留用户要求复用的文件、必要持久状态，以及确实减少自有代码的成熟依赖。

### 修改提示词（英文）

> Use existing project and Harness capabilities where they already meet the need. Remove unnecessary tooling, scaffolding, temporary artifacts and dependencies. Keep requested reusable artifacts, required persistent state and maintained dependencies that reduce owned code.

### 来源与归纳关系

部分直接支持，部分按当前总复杂度推导。AI 编程指令支持控制额外文件与脚手架；DSH 依赖策略明确承认引入成熟依赖可以是精简，只要它实际减少项目要维护的代码和接口。

[S01 · Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#overeagerness)；[S06 · Codex](https://github.com/openai/codex/blob/d28be12577cf5e267c97d3018a490d76da4d28e7/codex-rs/core/gpt_5_2_prompt.md)；[S09 · Karpathy-inspired](https://github.com/multica-ai/andrej-karpathy-skills/blob/2c606141936f1eeef17fa3043a72095b4765b9c2/CLAUDE.md)；[DSH · 依赖策略](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/.agents/notes/implemented/process/2026-07-26-dependencies-over-hand-rolling.md)。

## AE10　精简损伤行为或可读性

### 中文判定

这次所谓精简是否删掉已要求的行为或必要处理，或者让代码明显更难阅读？这一条用于保留任务完整性，防止前九条被机械执行成删功能、删必要判断或追逐最少行数。

### 具体例子

| 情形 | 例子 |
|---|---|
| 应触发 | 为减少代码行数而删掉用户要求的同规则冷却，或把原本清楚的多分支处理压成难读的嵌套三元表达式。 |
| 不应触发 | 移除没有作用的工厂层，保留全部功能、必要处理和清楚的函数调用。 |

### 豁免与边界

保留行为与可读性的局部内联、删除真正冗余结构。

精简应对准冗余结构；已经要求的能力、实际必要的检查和有效封装应继续存在。遇到这条提醒，也不应另起一轮大范围重构。

### 修改提示词（中文）

> 恢复用户已要求的行为与必要处理，使用容易理解的局部逻辑保持完整效果。精简冗余结构即可，不以行数最少为目标，也不要因此另起大范围重构。

### 修改提示词（英文）

> Restore required behavior and necessary handling. Keep the implementation readable and complete. Simplify redundant structure rather than minimizing line count, and do not launch an unrelated refactor in response.

### 来源与归纳关系

直接支持。Anthropic Code Simplifier 明确要求保持完整行为，并避免为了短小损害可读性；PEP 20 提供简单、清晰和可读的原则。

[S08 · Code Simplifier](https://github.com/anthropics/claude-plugins-official/blob/ea10b213686c90bb1984b2016937310e05336cf3/plugins/code-simplifier/agents/code-simplifier.md)；[S10 · PEP 20](https://github.com/python/peps/blob/6068058b896441388bbf22f2607ab681193f6a3d/peps/pep-0020.rst)。

## 来源说明

S01—S15 对应资料包的 [source-manifest.json](research/source-manifest.json)；本文件只引用实际用于规则的条目。DSH 前缀对应原生 Harness 的 [native-source-manifest.json](research/native-originals/native-source-manifest.json)。仓库文件均链接到本次核对的固定 commit，网页链接则对应检索日期 2026-10-19 的阅读内容。

“直接支持”表示来源明确支持相关工程原则，并不表示规则提问或修改提示是原文翻译。“推导”表示本包把一般原则具体化到某类写入。所有规则问句和修改提示都是本包整理的内容，noul 阈值也不是这些文档给出的官方或已校准数值。

公开工程资料中，11 份有开放许可声明的正文按原始内容收录，另附许可证与归属信息。未确认整篇开放许可的 4 个网页只提供链接、短摘录或摘要，不能称为已经收录全文。S09 的上游 README 声明 MIT，但没有独立 LICENSE，资料包保留了这一事实；它属于社区整理的 Karpathy-inspired 指南。

本文没有把原文中的所有工作流直接搬进规则库。Google 对必要测试的要求、各项目的实际检查门槛和本用户对精简验证的偏好，都需要按当前任务一起判断。AE08 对纯测试命令没有拦截能力；AE10 则始终要求保留用户已经提出的完整目标。
