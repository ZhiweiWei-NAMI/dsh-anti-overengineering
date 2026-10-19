# DSH 反过度工程化预设

让 Agent 聚焦当前任务，用 Jev 识别多余扩张，并给出固定纠偏提示。预设名为 **反过度工程化**（`anti-overengineering`），主执行模型沿用你的现有配置。

## 安装

从 npm 安装当前版本：

```powershell
dsh plugin --profile desktop add dsh-anti-overengineering@1.2.1
```

也可下载 [安装包](dsh-anti-overengineering-1.2.1.tgz)，将上述包名替换为安装包的绝对路径。

配置 Jev 后重启应用，在新会话中选择 **反过度工程化**。CLI Web 使用 `--profile web`。

适用环境：DeepSeek Harness `0.2.1-rc.2`，Node `^22.19.0 || >=24.0.0`。

## 配置 Jev

OpenCode 付费线路使用 `https://opencode.ai/inference/v1/systemone`，模型 `jev-1.13`。TypeSafe 官方线路使用 `https://api.typesafe.ai/v1/systemone`，模型 `jev-latest`。

将对应线路的 Key 保存在本机 DSH 凭据文件中，引用名为 `JEV_API_KEY`。完整配置可直接复制[插件使用说明](dsh-anti-overengineering/README.md#jev-配置)中的示例。

## 规则

使用原版完整规则库，判定问题及中英文纠偏提示词原文保留：

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

[规则原文](dsh-anti-overengineering/rules.json) · [规则解释与提示词](02-rules-and-prompts.zh.md)

## 如何工作

在带写操作的工具批次执行前，将用户要求、Agent 决策、接口返回的 reasoning 和工具行为元数据发送给 Jev，按规则评分。默认达到 `0.85` 且不在冷却期时，暂停本批写操作并追加纠偏提示，只读调用不受影响。频率、阈值和单条规则均可配置。

评审输入来自当前消息视图，不主动读取代码，不向 Jev 发送工具参数或输出正文；命令参数仅在本地用于识别写操作。原版规则中的“写入／补丁”措辞保持原文，实际判断依据是 Agent 对这些行动的决策与行为记录。

这些文本会发送至所配置的 Jev 服务，可能包含 Agent 引用的项目内容。历史受消息压缩及字符预算限制；reasoning 仅包含接口实际返回的文本。接口失败默认放行，可配置为拒绝。

每轮回复下方显示本轮与本会话累计的 Jev 调用、输入 token、规则命中和预估费用。`1.2.1` 修复用量查询路由注册失败；升级需同时加载新版 Host 与客户端，不能仅新建会话。完整变更见 [更新记录](CHANGELOG.md)。

## 资料与许可

[配置与参数](dsh-anti-overengineering/README.md) · [来源说明](01-source-guide.zh.md) · [验证记录](04-validation.zh.md)

插件许可见 [LICENSE](dsh-anti-overengineering/LICENSE)。研究原文各自遵循其许可证，见[来源清单](research/source-manifest.json)。未获公开再分发许可的用户原件不包含在公开仓库中。
