# 原生 DeepSeek Harness 预设与执行流程

> 本文仅保留原始 1.0.0 的历史流程与行号。当前 **1.1.1** 改为行为判规，写入范围、AE 规则及旧配置均不适用，不能只替换下方安装包名。当前安装和凭据配置见 [README](README.md) 与[插件说明](dsh-anti-overengineering/README.md)。本轮未重跑运行时验证。

本包在文件修改执行前调用 Jev。规则分数达到阈值、且冷却和会话预算允许干预时，默认拒绝当前原生工具批次中的受监控写入，并把对应修改提示注入下一轮。规则、提示和频率策略均随包提供；用户只需安装、配置凭据并选择预设。

目标为官方 DeepSeek Harness **0.2.1-rc.2**，核对提交为 `687f282e8625c6b8d11ff58211a90524be2e4317`。[package.json](dsh-anti-overengineering/package.json) 的 `engines.dsh` 固定这一版本，Node 要求为 `^22.19.0 || >=24.0.0`。本次交付面向标准 Web/Desktop 组合，其已有 tools、credentials、storageDomain、agentPresets 和 sessionProjections 服务；不把本包当作裸 headless 的完整启动配置。

## 1. 安装与凭据

在原生插件安装入口选择 `dsh-anti-overengineering-1.0.0.tgz`，或执行：

```bash
dsh plugin --profile web add /absolute/path/dsh-anti-overengineering-1.0.0.tgz
```

桌面配置使用 `--profile desktop`。安装完成后重启对应应用，创建会话并选择 **anti-overengineering**。该操作增加一个可选预设，不改变全局默认选择。安装操作以归档包为入口，无需另做构建。

默认凭据引用名为 `JEV_API_KEY`，由 Harness 原生 credentials 服务解析。Linux/macOS 可在启动前设置：

```bash
read -rsp 'Jev API key: ' JEV_API_KEY
export JEV_API_KEY
dsh web
```

也可在原生凭据存储中设置这个引用。默认文件为 `~/.dsh/.credentials.yaml`；自定义 DSH_HOME 时，位于对应目录。已有文件只需在 `refs` 中补入键值；最小结构为：

```yaml
version: 1
refs:
  JEV_API_KEY: "替换为实际 Jev API key"
```

手工创建文件时，POSIX 权限需为 `600`，否则原生服务拒绝加载。存储中的同名值优先于启动环境；启动后的新环境变量不会被已有进程重新读取。从图标启动的桌面程序应使用原生存储，或从已配置环境的进程启动。凭据不要写入预设补丁、源码或修改提示。文件格式与优先级依据官方 [credentials-local 文档](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/credentials/credentials-local/README.md)。

## 2. Bundle 如何形成原生预设

[cordis.patch.yml](dsh-anti-overengineering/cordis.patch.yml) 是完整可加载补丁。package.json 的 `dsh.bundle.patch` 指向它；补丁用原生 `insert` 增加两项：Host 插件 `anti-overengineering-runtime`，以及 `@deepseek-ai/dsh-agent-preset` 注册的 `anti-overengineering` 预设。后者携带完整插件列表，保留原生 standard 的文件、搜索、技能、规划、压缩、子代理等能力，并加入使用 write/edit 和遵从纠偏提示的 persona。

这里的 preset 是实际 Cordis 配置，未依赖 `extends: standard` 之类不存在的继承字段。Host 插件只挂载一次，再依据 `composedPreset(agent.ctx)` 判断目标会话，避免每个预设修订重复打开同一持久化域。原生结构依据 [Agent preset registry](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/preset/agent-preset-registry/README.md)。

## 3. 从本轮写入到下一轮提示

插件在 `tools/pre-execute` 先取得下游决定。已有 `deny` 或 `cancel` 原样保留；受监控写操作的 `allow` 和 `ask` 均接受判规，因为 ask 的实际审批发生在 pre-execute 流水线之后。未干预时继续返回原决定，Jev 不会把 ask 改成 allow。

第一条待审写调用从 `deriveMessages()` 的最新 assistant 消息聚合本批全部受监控写操作。一次 Jev 请求共享这份批次状态，对每条启用规则提出一个 `noul` 问题；读取 `answers.AE01.noul` 等数值，没有额外的 confidence 字段。修改文本由本地 [rules.json](dsh-anti-overengineering/rules.json) 按规则 ID 选择，Jev 不负责生成提示或文件行号证据。

达到干预条件时，默认 `mode: revise` 在 pre-execute 返回 deny，文件修改尚未执行。原生拒绝路径仍经过 `tools/post-execute`，插件在此保留下游反馈和已有 additionalContexts，再追加一条 `source.kind: anti-overengineering` 的 notice；模型下一轮按提示调整并重提修改。`mode: remind` 只追加建议，是否实际执行仍取决于原生权限与工具结果。该时序依据 [Tool execution pipeline](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/tool-execution-pipeline.md)。

同一原生批次以 assistant.id 缓存判定 Promise。第一条写入命中后，其余写入继续复用同一 deny，仅注入一次提示，不会因刚更新的冷却计数而被放行。无法匹配原生批次的直接调用，以当前调用为审查单位。

## 4. 阈值、冷却与会话频率

**一轮指一次模型 step 及其工具批次。** 插件使用 `sessionStats.steps + 1`，所以只读轮也推进冷却；一个用户输入触发多个模型 step 时，会计为多轮。下面参数已写入补丁，也可在原生插件配置中修改。

| 参数 | 默认值 | 生效含义 |
|---|---:|---|
| `threshold` | 0.85 | Noul 大于或等于阈值时命中 |
| `cadence.checkEveryWriteRounds` | 1 | 每个含受监控写入的模型轮检查；设为 3 时检查第 1、4、7 个写入轮 |
| `cadence.globalCooldownRounds` | 2 | 一次干预后的两个模型轮不再干预 |
| `cadence.sameRuleCooldownRounds` | 6 | 同规则干预后的六个模型轮不再重复提示 |
| `cadence.windowRounds` | 20 | 滚动频率窗口宽度 |
| `cadence.maxInterventionsPerWindow` | 4 | 一个窗口内最多干预四次 |
| `cadence.maxInterventionsPerSession` | 12 | 会话累计达到上限后停止本插件判规 |
| `cadence.maxJevCallsPerSession` | 0 | Jev 尝试次数上限，失败也计数 |
| `cadence.maxRulesPerIntervention` | 3 | 每次最多提示三条规则，优先分数较高者 |

三个次数上限 `maxInterventionsPerWindow`、`maxInterventionsPerSession`、`maxJevCallsPerSession` 均以 0 表示不设上限。阈值和默认频率是本包初始配置，尚未通过真实任务校准。

例如第 10 轮触发后，全局冷却抑制第 11、12 轮，第 13 轮可提示其他规则；同规则到第 17 轮才可再次提示。默认冷却期间仍检查写批次并记录分数，但不重复干预，写入继续遵循原生决定。因此冷却约束的是纠偏频率；它允许下一轮处于冷却时继续写入。

单规则配置可覆盖开关、阈值、冷却和修改提示。例如放入自己的 profile patch：

```yaml
- id: anti-overengineering-runtime
  config:
    enabled: true
    presetIds: [anti-overengineering]
    mode: revise
    threshold: 0.85
    rules:
      AE03:
        threshold: 0.90
        cooldownRounds: 10
      AE08:
        correction: "只验证本次改动的可观察行为，删除实现镜像测试和重复覆盖。"
```

原生 patch 的 `config` 整项替换，不做深合并。此例中未写的字段恢复插件默认值；已有自定义 Jev 地址或频率时，应一并保留。未知规则 ID 会在加载时报告错误。判规与提示规则的完整说明见 [02-rules-and-prompts.zh.md](02-rules-and-prompts.zh.md)。

将某条规则设为 `enabled: false` 后，该规则不再进入 Jev 请求；修改 `correction` 只替换命中后注入的文本，不改变判定问题。阈值范围为 0 至 1，冷却轮数为非负整数。一次提示包含多条规则时，会话干预次数只增加一次，各条被选中规则分别更新自己的冷却轮。

## 5. 持久化与服务失败

原生 storageDomain 的 `anti_overengineering_v1` 域保存 sessions 表，以 Session ID 为键记录写入轮数、Jev 尝试次数、干预次数、最近触发轮和最近判定。状态写入完成后才继续流程；同一数据目录正常重启后延续计数。不同会话和子会话分别计数，旁表不会随单独导出的会话日志自动迁移。

旁表的最近判定分别记录命中规则与本次选择注入的规则。处于冷却或窗口上限时，可以有命中分数而没有实际干预；据此可区分“Jev 没有判中”和“频率策略抑制了提醒”。调用次数在发出请求前写入，服务失败后也不会返还这次预算。

默认服务配置为 endpoint `https://api.typesafe.ai/v1/systemone`、model `jev-latest`、timeoutMs `15000`、onError `allow`。endpoint、model 与凭据需属于同一 Jev 线路。超时、缺凭据、HTTP 错误或无效答案会记录失败，并按 onError 保留原生决定或返回 deny；失败不等于规则通过，也不会生成伪造命中提示。

## 6. 检查覆盖与源码对照

原生 standard 当前实际文件修改工具是 `write` 和 `edit`。配置列出的 `apply_patch`、`multi_edit` 供已安装这些工具的环境使用，本包不创建它们；`str_replace_editor` 仅检查 create、str_replace、insert，排除 view。Bash、PowerShell、Python 或其他工具的任意文件副作用不在自动识别范围，纯 shell 反复跑测试也不受拦截；AE08 审查的是准备新增或修改的测试代码。

Jev 接收当前可见用户要求、最近文本证据及完整待写参数。历史文本按 contextChars 限制并标记遗漏，待写参数不截断；不发送系统提示或 reasoning 块。上下文不足时，规则要求避免肯定误报；超大请求若被服务拒绝，进入前述失败策略。

| 实现文件 | 可复核入口与起始行 |
|---|---|
| [index.js](dsh-anti-overengineering/index.js) | 配置第 15 行；批次第 85 行；Host 挂载第 129 行；Jev 请求第 144 行；pre 第 210 行；post 第 235 行 |
| [policy.js](dsh-anti-overengineering/policy.js) | 采样与会话上限第 11 行；阈值、冷却与窗口第 25 行；写工具识别第 49 行；Noul 读取第 57 行 |
| [cordis.patch.yml](dsh-anti-overengineering/cordis.patch.yml) | Host 与默认配置第 4 行；完整 preset 第 33 行 |
| [package.json](dsh-anti-overengineering/package.json) | Bundle 入口第 15 行；版本约束第 16 行 |

实际安装与运行验证记录由资料包的验证文档单列。本说明不以模拟 Jev 返回推断真实判规准确率。
