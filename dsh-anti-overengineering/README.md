# DeepSeek Harness 反过度工程化预设

通过 Jev 评估 Agent 的决策与行为，按 AE01—AE10 规则给出固定纠偏提示，让工作聚焦当前任务。主执行模型与账号沿用现有配置。

版本 `1.1.2`；适用 DeepSeek Harness `0.2.1-rc.2`，Node `^22.19.0 || >=24.0.0`。

## 安装

```powershell
dsh plugin --profile desktop add /absolute/path/dsh-anti-overengineering-1.1.2.tgz
```

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

发送给 Jev 的内容包括：当前消息视图中的用户要求；最近最多 40 条 assistant/tool 消息里的决策文本、接口实际返回的 reasoning、工具名称、调用 ID 和错误标记；待执行工具的名称和 ID。

不主动读取文件、工具参数或工具输出正文。文本中的围栏代码块会省略，但自然语言及 reasoning 中的引用仍可能包含项目内容，因此启用前需确认项目允许这些文本发送至所选 Jev 服务。

`contextChars` 是用户文本与行为历史合计的保留字符预算，各占一半，超出时保留首尾。消息压缩可能省略旧历史；PTC 内层调用独立评审，历史视图只包含外层消息。reasoning 仅来自模型接口实际返回的文本。

## 运行参数

| 参数 | 默认值 | 含义 |
|---|---|---|
| `mode` | `revise` | 拒绝命中批次并追加纠偏；`remind` 只追加提示 |
| `threshold` | `0.85` | 规则 Noul 分数的命中阈值 |
| `judge.timeoutMs` | `15000` | Jev 请求超时，单位毫秒 |
| `judge.onError` | `allow` | 接口失败时放行；`deny` 则拒绝 |
| `judge.contextChars` | `24000` | 保留文本字符数，不含问题及请求包装 |
| `cadence.checkEveryToolRounds` | `1` | 每隔多少个带工具的模型轮检查一次 |
| `cadence.globalCooldownRounds` | `2` | 两次干预之间的模型轮间隔 |
| `cadence.sameRuleCooldownRounds` | `6` | 同一规则的干预间隔 |
| `cadence.windowRounds` | `20` | 干预计数窗口，单位模型轮 |
| `cadence.maxInterventionsPerWindow` | `4` | 每窗口最多干预次数 |
| `cadence.maxInterventionsPerSession` | `12` | 每会话最多干预次数 |
| `cadence.maxJevCallsPerSession` | `0` | Jev 请求上限，`0` 表示不限；失败请求也计数 |
| `cadence.maxRulesPerIntervention` | `3` | 每次最多提示的规则数 |

普通工具批次共享一次判定，纯文本回复不触发。冷却期可能继续调用 Jev，但不会干预；达到会话干预上限后停止评审。计数按会话保存，重启后延续。原生工具审批保持有效。

## 源码与许可

[index.js](index.js) 为 Host 插件，[policy.js](policy.js) 管理评分与频率策略，[cordis.patch.yml](cordis.patch.yml) 定义预设组合。无需编译。

[完整仓库](https://github.com/ZhiweiWei-NAMI/dsh-anti-overengineering) · [LICENSE](LICENSE)
