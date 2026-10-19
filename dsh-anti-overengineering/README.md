# DeepSeek Harness 反过度工程化预设

通过 Jev 评估 Agent 的决策与行为，按 AE01—AE10 规则给出固定纠偏提示，让工作聚焦当前任务。主执行模型与账号沿用现有配置。

版本 `1.2.1`；适用 DeepSeek Harness `0.2.1-rc.2`，Node `^22.19.0 || >=24.0.0`。

## 安装

```powershell
dsh plugin --profile desktop add dsh-anti-overengineering@1.2.1
```

也可将包名替换为下载的 `dsh-anti-overengineering-1.2.1.tgz` 安装包的绝对路径。

CLI Web 使用 `--profile web`。配置 Jev 后重启应用，在新会话中选择 **反过度工程化**（`anti-overengineering`）。安装不改变全局默认预设。

## Jev 配置

在当前 profile 的 `cordis.patch.yml` 中添加以下配置；已有同 ID 项时替换该项。Desktop 的默认路径为 `~/.dsh/profiles/desktop/cordis.patch.yml`。

下面使用 OpenCode 付费 Jev 线路：

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
      contextChars: 6000
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

使用 TypeSafe 官方线路时，将 `endpoint` 改为 `https://api.typesafe.ai/v1/systemone`，`model` 改为 `jev-latest`，并使用 [TypeSafe Key](https://console.typesafe.ai/keys)。插件内置默认值为该官方线路。Jev 使用 `model/state/questions` 协议，地址、模型和 Key 应属于同一线路。

### 保存 Key

在本机 `~/.dsh/.credentials.yaml` 的 `refs` 中加入：

```yaml
version: 1
refs:
  JEV_API_KEY: "在本机填写对应线路的 Key"
```

保留文件中已有凭据。`apiKeyEnv` 是凭据引用名，真实 Key 不写入 profile 配置或 Git。自定义了 `DSH_HOME` 或凭据 provider 路径时，使用对应位置。

也可在启动 DSH 的环境中设置 `JEV_API_KEY`；凭据文件中的同名值优先。环境变量修改后需重新启动应用。

## 规则库

[rules.json](rules.json) 完整保留原版十条规则及其判定问题、中英文纠偏提示、豁免和示例。

| 编号 | 规则 |
|---|---|
| AE01 | 任务范围扩张 |
| AE02 | 假想未来需求与配置膨胀 |
| AE03 | 一次性抽象与多层包装 |
| AE04 | 假设性防御与重复校验 |
| AE05 | 无依据兼容层与双路径 |
| AE06 | 无依据的性能机制 |
| AE07 | 无关重构、格式与说明扩散 |
| AE08 | 低价值测试与验证扩张 |
| AE09 | 多余脚手架、产物与依赖 |
| AE10 | 精简损伤行为或可读性 |

规则原文中的“写入／补丁”措辞保持不变；当前评审输入是决策与行为记录，而非文件内容。Jev 依据可见证据评分，命中后使用对应的固定纠偏提示。

单条规则可以覆盖 `enabled`、`threshold`、`cooldownRounds` 和 `correction`，例如：

```yaml
    rules:
      AE04:
        threshold: 0.9
        cooldownRounds: 8
      AE06:
        enabled: false
```

## 评审输入

发送给 Jev 的内容包括：当前消息视图中最近一条用户要求；最近最多 10 条 assistant/tool 消息里的决策文本、接口实际返回的 reasoning、工具名称、调用 ID 和错误标记；待执行工具的名称和 ID。

不主动读取文件内容，不向 Jev 发送工具参数或工具输出正文。命令参数仅在本地用于识别写操作。文本中的围栏代码块会省略，但自然语言及 reasoning 中的引用仍可能包含项目内容，因此启用前需确认项目允许这些文本发送至所选 Jev 服务。

`contextChars` 是用户文本与行为历史合计的保留字符预算，各占一半，超出时保留首尾。消息压缩可能省略旧历史；PTC 内层调用独立评审，历史视图只包含外层消息。reasoning 仅来自模型接口实际返回的文本。

## 运行参数

| 参数 | 默认值 | 含义 |
|---|---|---|
| `mode` | `revise` | 拒绝命中批次并追加纠偏；`remind` 只追加提示 |
| `threshold` | `0.85` | 规则 Noul 分数的命中阈值 |
| `judge.timeoutMs` | `15000` | Jev 请求超时，单位毫秒 |
| `judge.onError` | `allow` | 接口失败时放行；`deny` 则拒绝 |
| `judge.contextChars` | `6000` | 保留文本字符数，不含问题及请求包装 |
| `cadence.checkEveryToolRounds` | `1` | 每隔多少个带写操作的模型轮检查一次 |
| `cadence.globalCooldownRounds` | `2` | 两次干预之间的模型轮间隔 |
| `cadence.sameRuleCooldownRounds` | `6` | 同一规则的干预间隔 |
| `cadence.windowRounds` | `20` | 干预计数窗口，单位模型轮 |
| `cadence.maxInterventionsPerWindow` | `4` | 每窗口最多干预次数 |
| `cadence.maxInterventionsPerSession` | `12` | 每会话最多干预次数 |
| `cadence.maxJevCallsPerSession` | `0` | Jev 请求上限，`0` 表示不限；失败请求也计数 |
| `cadence.maxRulesPerIntervention` | `3` | 每次最多提示的规则数 |

仅 write、edit、apply_patch 和 str_replace_editor 的修改操作，以及 bash/pwsh 中可识别的写命令触发 Jev；read、grep、glob 等只读工具和纯文本回复不触发。Shell 识别常见文件增删改、输出重定向、原地替换、写文件 API 与 Git 修改命令，不完整解析脚本，间接写入、自定义命令和其他工具可能漏识别，不能作为安全隔离。普通批次中的写操作共享一次判定，只读操作不参与拦截。冷却期可能继续调用 Jev，但不会干预；达到会话干预上限后停止评审。计数按会话保存，重启后延续。原生工具审批保持有效。

## 回合末会话统计

每轮结束后，在回复下方以小字显示本轮与本会话累计的 Jev 调用次数、输入 token、各规则命中次数和预估美元费用，不以是否命中规则为展示条件。跟随 DSH 用户界面语言（中文／英文），不增加输入框图标、卡片或时间筛选。回合开始保存累计基线，结束保存累计快照与本轮差值；历史回复不会变成最新一轮的数据，重新打开会话仍可查看。客户端使用回合对象的 turn 编号请求统计；仅当前正在执行的回合返回等待状态，客户端在回合结束前持续等待（轮询间隔最多两秒），离开页面时取消。历史回合没有快照时不显示统计，不误报为等待；真实的查询或写入失败显示“用量暂不可用”，非本预设会话不显示统计。

统计查询使用原生鉴权的 `/api/anti-overengineering/turn-usage` 精确路由与 RPC 请求／响应信封，不再使用在分离 Cordis 服务作用域下注册失败的自定义 RPC 通道。Host 与客户端需同时更新；只新建会话不会重新加载插件代码。回归测试使用分离作用域的原生 Host／Client Connection 服务，覆盖请求关联、鉴权、快照读取与卸载后路由移除。

调用次数计入已发起的 HTTP 请求（包括失败请求），缺少凭据而未发出请求不计入。规则计数按达到该规则阈值的次数累计，包括因冷却期或单次规则数上限而未追加纠偏的命中；不是干预次数。

费用依据响应的 `usage.input_tokens` 与对应官方模型标价计算：TypeSafe `jev-1.13.0`／`jev-1.14.0` 及其已知别名、OpenCode `jev-1.13` 输入均为 **$0.042／百万 tokens**，输出免费；OpenCode `jev-1.13-free` 按免费标价。价格核对日期为 2026-10-19，见 [TypeSafe](https://docs.typesafe.ai/models) 和 [OpenCode](https://opencode.ai/v2/docs/console/models/#pricing)。不乘以规则数，不含充值手续费、税费或其他模型费用；这是官网标价估算，不是账单。

缺失用量、未知模型／自定义服务以及超时丢失响应不会被当作免费，而显示未知或已计价请求比例。输入 token 只累计 Jev 响应实际报告的非负整数，并显示已报告用量的请求比例；它不是主执行模型的上下文用量。升级前未保存的 token 用量不补造，旧回合没有基线时仅显示原累计快照，没有统计快照时不补造数据。

## 已知限制

持久状态仅保存每个代理最近一次 `lastDecision` 评分，不保留逐次评分历史；累计命中为零不代表没有调用，也不能据此还原所有调用的概率分布。Noul 是各规则独立的肯定评分，不是总和为 100% 的分类概率。只读排查不独立触发评审，行为窗口与高分证据要求也限制了对长时间低效排查的识别；零命中不等于过程没有冗余。

## 源码与许可

[index.js](index.js) 为 Host 插件，[policy.js](policy.js) 管理评分与频率策略，[usage.js](usage.js) 计算官方价格估算，[client.js](client.js) 通过原生回合尾插槽显示统计，[cordis.patch.yml](cordis.patch.yml) 定义预设组合。发布的客户端是可直接加载的 JavaScript，无需编译。

[完整仓库](https://github.com/ZhiweiWei-NAMI/dsh-anti-overengineering) · [LICENSE](LICENSE)
