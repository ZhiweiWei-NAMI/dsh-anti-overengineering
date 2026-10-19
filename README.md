# DSH 反过度工程化：行为纠偏预设

**当前版本 1.1.1**：根据 Agent 决策说明、接口实际返回的 reasoning 文本及工具行为历史纠偏，**不检查代码、不读取工具参数或工具输出正文**。这是 DeepSeek Harness 的可选 preset + Host 插件，不是聊天模型 provider，也不依赖 AutoCTX。

适配目标为官方 DeepSeek Harness **0.2.1-rc.2**，来源提交 `687f282e8625c6b8d11ff58211a90524be2e4317`；Node `^22.19.0 || >=24.0.0`。其他版本未核验。

## 安装与配置

完整、随安装包提供的操作说明以[插件 README](dsh-anti-overengineering/README.md)为准，包含 Windows/Desktop 安装、OpenCode 付费 Jev 和 TypeSafe 官方线路、凭据格式及全部运行参数。

```powershell
dsh plugin --profile desktop add /absolute/path/dsh-anti-overengineering-1.1.1.tgz
```

安装包：[dsh-anti-overengineering-1.1.1.tgz](dsh-anti-overengineering-1.1.1.tgz)。安装后重启对应应用，新会话选择 **anti-overengineering**，不改变全局默认预设。

OpenCode 付费线路配置：`endpoint: https://opencode.ai/inference/v1/systemone`、`model: jev-1.13`、`apiKeyEnv: JEV_API_KEY`。官方默认线路为 `https://api.typesafe.ai/v1/systemone`、`jev-latest`。地址、模型和 Key 必须匹配，不能用普通聊天接口代替。OpenCode 配置来自现有本地接入实现，未用你的账户实测。

`JEV_API_KEY` 是 DSH 凭据引用名。在本机原生凭据文件的 `refs` 中填写真实 Key，不要发到聊天或提交 Git。主执行模型沿用现有账号；安装使用不需要 GitHub Key。具体位置、文件结构及完整 Host 覆盖示例见[凭据配置](dsh-anti-overengineering/README.md#jev-与凭据配置)。

## 外发与覆盖边界

**启用即允许第三方 Jev 处理用户文本、Agent 决策及已返回的 reasoning。** 工具元数据只有名称、调用 ID 与错误标记；没有参数、命令字符串、输出正文或直接读取的文件内容。围栏代码块会省略，但普通文本或 reasoning 仍可能引用代码和秘密，**没有可靠自动脱敏**。

不能获取模型 API 未返回的内部思考。无 reasoning 文本的模型不会凭空产生这种输入。每个带工具调用的模型轮触发，纯文本回复不触发；不撤销已经执行的行为，也不推断未看到的代码是否正确。普通 assistant 工具批次共享判定；PTC 内层调用独立判定，历史只见外层消息，不是完整内层行动日志。当前消息视图也可能因压缩而省略旧历史。

六条行为规则覆盖偏离任务、假想需求扩建、重复调查、无新风险的验证循环、假设故障驱动的防御扩张和无独立产出的代理扩张。默认 Noul 阈值 0.85，命中且预算允许时拒绝当前工具批次、追加固定纠偏；保留用户要求与必要检查，不绕过原生审批。冷却期间下一轮可能放行，**不是强安全门**。

上下文预算是保留给用户文本和行为历史的字符数，不是 token 数或完整 HTTP 请求上限。默认 24000，超额首尾截断并标记遗漏。未见证据不得高判；重复工具名称、一次失败或缺少说明都不等于违规。

默认 `onError: allow`：缺 Key 或接口失败记录错误并保留原生权限决定，**不是判规通过**。默认 Jev 调用次数不限；可用 `cadence.maxJevCallsPerSession` 控制费用。

## 审查与版本说明

1.1.1 补齐 preset 的中文名称“反过度工程化”与用途、外发提醒描述，不改变判规行为。

静态阅读未发现需要删除的明显过度防御；外部响应校验、超时取消、批次共享和状态持久化各有实际用途。不能仅靠代码阅读证明真实误报率或行为纠偏效果。

1.1.0 根据用户要求从写入内容审查改为行为历史判规，包含模型 API 实际返回的 reasoning，采用 BH01—BH06 规则和新状态域。旧版 `writeTools`、`checkEveryWriteRounds` 及 AE 规则覆盖项不再适用。1.0.1 曾修复微小上下文预算下 `slice(-0)` 导致全文回流的问题。

**本轮未执行测试，也未调用真实付费 Jev。** 阈值未用真实样本校准；安装成功不等于接口账户、完整运行或纠偏准确性已验证。

以下为原始 **1.0.0** 交付研究及验证资料，不是 1.1.0 当前使用文档：

- [原始交付导读](00-README.zh.md)
- [来源与检索范围](01-source-guide.zh.md)
- [历史 AE 规则与提示词](02-rules-and-prompts.zh.md)
- [历史原生接入说明](03-native-preset-and-workflow.zh.md)
- [原始验证记录](04-validation.zh.md)与 [validation](validation/)

[原始安装包](dsh-anti-overengineering-1.0.0.tgz)和[中间修订包](dsh-anti-overengineering-1.0.1.tgz)仅供历史复核，安装请选择 **1.1.1**。[SHA256SUMS.txt](SHA256SUMS.txt) 仅覆盖最初交付快照，不适用于已修改源码、说明或新增文件和安装包。

## 许可

插件代码及衍生 standard 配置见[插件 LICENSE](dsh-anti-overengineering/LICENSE)。研究原文分别遵循自身许可证，不能将整份资料都视为统一 MIT 作品；见[来源报告](research/source-report.md)与[来源清单](research/source-manifest.json)。用户提供的 AutoCTX/Jev 报告只是参考，不是运行依赖或操作指令；因未有公开再分发许可且含个人本地路径，其原件保留本地，不随公开仓库上传。历史清单中对此原件的路径仅用于说明原始交付来源。
