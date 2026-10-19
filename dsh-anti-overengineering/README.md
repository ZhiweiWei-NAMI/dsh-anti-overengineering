# DeepSeek Harness 行为纠偏预设

版本 **1.1.1**。本版补齐预设选择器中的中文名称与用途描述，不改变判规行为。适配目标：DeepSeek Harness **0.2.1-rc.2**，固定来源提交 `687f282e8625c6b8d11ff58211a90524be2e4317`；Node `^22.19.0 || >=24.0.0`。其他运行时版本未核验。

这是可选的 `anti-overengineering` preset + Host 插件，不是聊天模型 provider，也不依赖 AutoCTX。它把 Agent 的决策说明、模型接口实际返回的 reasoning 文本及工具行为元数据交给 Jev，在有正面证据表明行动多余时注入固定纠偏提示。**不读取文件、不审查代码修改、不发送工具参数或工具原始输出。**

## 安装

```powershell
dsh plugin --profile desktop add /absolute/path/dsh-anti-overengineering-1.1.1.tgz
```

CLI Web 使用 `--profile web`。安装后重启对应应用，创建新会话并选择 **anti-overengineering**。不改变全局默认 preset，主执行模型与账号沿用原配置。仅修改源码目录不会更新已安装的 TGZ。

## Jev 与凭据配置

默认线路是 TypeSafe 官方：`https://api.typesafe.ai/v1/systemone`、`jev-latest`，Key 在 [TypeSafe 控制台](https://console.typesafe.ai/keys)创建。已有 OpenCode 付费 Jev 线路时，使用下面的完整 Host 配置覆盖。普通 OpenAI 聊天接口不能代替 Jev 的 `model/state/questions` 协议；普通聊天模型 Key 也不保证有 Jev 使用权限。

在当前 profile 的 `cordis.patch.yml` 追加（如已有同 ID 配置则编辑原项）：

```yaml
- id: anti-overengineering-runtime
  config:
    enabled: true
    presetIds: [anti-overengineering]
    mode: revise
    threshold: 0.85
    judge:
      endpoint: https://opencode.ai/inference/v1/systemone
      model: jev-1.13
      apiKeyEnv: JEV_API_KEY
      timeoutMs: 15000
      onError: allow
      contextChars: 24000
    cadence:
      checkEveryToolRounds: 1
      globalCooldownRounds: 2
      sameRuleCooldownRounds: 6
      windowRounds: 20
      maxInterventionsPerWindow: 4
      maxInterventionsPerSession: 12
      maxJevCallsPerSession: 0
      maxRulesPerIntervention: 3
    rules: {}
```

OpenCode 地址和模型来自随资料包提供的现有本地接入实现，**未用你的付费账户实测**，可用性以服务当前支持为准。切换官方线路时要同时换 endpoint、model 和对应 Key。原生 patch 的 `config` 是整项替换，不是深合并；保留自己的其他配置。

`apiKeyEnv` 是 **DSH 凭据引用名**，不是密钥值，也不局限于环境变量。默认原生凭据文件为 `~/.dsh/.credentials.yaml`；自定义 `DSH_HOME` 或 credentials provider `path` 时以其配置为准。在已有 `refs` 内补入，不要覆盖其他凭据：

```yaml
version: 1
refs:
  JEV_API_KEY: "只在本机填入对应线路的真实 Key"
```

不要把 Key 发到聊天、写入源码、profile patch 或 Git。凭据文件同名值优先于启动环境；默认文件监听可重载凭据，环境变量修改需要重启进程。桌面图标启动的应用不会继承另一个终端中新设的变量。Linux/macOS 手动创建凭据文件时设为 `600` 权限；这是本地文件，不是阻止同用户进程读取的 OS 密钥库。依据：[官方 credentials-local 说明](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/credentials/credentials-local/README.md)。

## 实际外发的数据

- 当前会话中可见、来自用户的文本要求。
- 最近最多 40 条 assistant/tool 消息：assistant 的文本与 **接口已返回并保存在消息中的 `reasoning` 文本块**；工具调用名称与 ID、工具结果的 `isError` 标记。
- 当前待执行工具批次的工具名称与调用 ID。

代码不访问工具调用参数或结果正文，不解析 shell 命令，不读取文件、diff、系统提示或凭据文件加入判规 state。标准围栏代码块从文本中移除，但这不是可靠脱敏：**普通文字及 reasoning 中仍可能引用代码、秘密或路径。** 启用意味着这些文本会交给配置的第三方 Jev，不接受外发的项目不要启用。

“隐藏思考”仅指模型 API 实际返回、DSH 实际保留的 reasoning 文本；不获取未返回的内部思考，不解密或发送加密/opaque reasoning，也不保证每个模型或会话都有这种文本。

`judge.contextChars` 默认 24000，是用户文本和近期历史各半的保留字符预算；超额保留首尾并标记遗漏。它不是 token 配额，也不是整个请求的硬上限：标记、JSON 编码、问题及待执行工具元数据另计。截断可能遗漏判断依据。输入来自当前会话可见消息视图，不是完整持久化日志；压缩替换后的旧节点、父代理转交文本及系统/AGENTS 指令不在用户要求字段中，不能假设这些约束不存在。

## 触发与纠偏

每个带工具调用的模型轮默认检查一次；同批多工具共享判定。包含只读、shell 和代理工具，不需要知道命令或文件内容。**纯文本回复没有工具执行，不触发检查**；已发生的行动不会撤销。

Jev 对 BH01—BH06 分别返回 `answers.<id>.noul`，没有独立 confidence 字段。只依据明确证据判定；重复工具名、一次失败、缺少说明都不足以命中，工具成功标记也不证明测试已通过。它不推断未见代码的质量、兼容性或必要校验。

| 规则 | 行为 |
|---|---|
| BH01 | 偏离任务的行动 |
| BH02 | 为假想需求扩建计划 |
| BH03 | 没有新目标的重复调查 |
| BH04 | 无新风险的验证循环 |
| BH05 | 假设故障驱动的防御扩张 |
| BH06 | 无独立产出的代理扩张 |

默认阈值 0.85，每次最多提示 3 条。`mode: revise` 拒绝当前批次并要求调整行动；`remind` 只追加提示。原生 deny/cancel 保留，ask 不变成 allow；没有绕过审批。提醒明确禁止仅凭判规结果删除未审查的实现或必要测试。

全局冷却 2 个模型轮，同规则冷却 6 轮；20 轮最多干预 4 次，每会话最多 12 次。冷却期间仍可能付费判规但不拦截，因此下一轮重复行动可能被允许；这是纠偏频率策略，不是强安全门。`checkEveryToolRounds` 是带工具轮采样间隔。`maxJevCallsPerSession: 0` 表示不限次数；失败请求也计次，可设正整数控制费用。达到会话干预上限也停止判规。

计数通过原生 storageDomain 按 Session ID 保存，重启延续，子会话独立；导出会话日志不会自动携带该旁表。1.1.0 使用新行为状态域，不迁移旧版写入判规计数。

`onError: allow` 默认在缺 Key、超时、HTTP 或响应格式错误时记录失败，保留原生执行决策，**不等于判规通过**；`deny` 则拒绝该次执行。没有自动重试或替代模型。默认超时 15000ms。

单规则可在 `rules` 下用 BH01—BH06 覆盖 `enabled`、`threshold`、`cooldownRounds` 或 `correction`；未知 ID 在加载时报错。1.0.x 的 `writeTools`、`checkEveryWriteRounds` 与 AE01—AE10 配置不再适用。

## 源码、审查与限制

运行代码：[index.js](index.js)、[policy.js](policy.js)，实际规则：[rules.json](rules.json)，完整原生 standard 组合：[cordis.patch.yml](cordis.patch.yml)。无需编译；依赖宿主提供的服务与库。插件及衍生 standard 配置许可见 [LICENSE](LICENSE)。

静态阅读未发现需要新增防御或引入复杂重构的依据。外部 JSON 校验、超时取消、批次共享和持久化各有当前用途。仅看文本和元数据会漏判或误判，阈值未校准，不能宣称已证明没有过度工程化。

1.1.0 按用户要求改为行为判规并包含接口返回的 reasoning；本次不运行测试，也未调用真实付费 Jev。外层原始 1.0.0 验证记录及 AE 规则文档属于历史版本，不代表此版本验证结果。完整仓库入口：[README](https://github.com/ZhiweiWei-NAMI/dsh-anti-overengineering)。
