# DeepSeek Harness 反过度工程化资料与原生 Preset

交付日期：2026-10-19。原始 Preset 版本：**1.0.0**；当前行为判规版：**1.1.1**（最新安装说明见 [README](README.md)）。适配：官方 **DeepSeek Harness 0.2.1-rc.2**，提交 `687f282e8625c6b8d11ff58211a90524be2e4317`。

> 以下仅为原始 1.0.0 历史导读，写入判规、AE 规则与验证结论不适用于当前 1.1.1 行为判规版。SHA256SUMS.txt 仅覆盖原始快照。当前安装与配置请看 [README](README.md)，不要照搬下方旧命令和配置。

本包包含检索到的可再分发原文、来源与许可清单、10 条可执行规则、中英修改提示，以及一个可由原生插件管理器安装的 preset。预设在模型提出文件修改时把本批修改交给 Jev；命中规则且频率允许时，在写入前拒绝，并通过 Harness 原生上下文接口把修改提示送入下一轮。

## 从哪里开始

| 你要做的事 | 文件 |
|---|---|
| 安装使用 | [dsh-anti-overengineering-1.0.0.tgz](dsh-anti-overengineering-1.0.0.tgz)；[插件 README](dsh-anti-overengineering/README.md) |
| 查看原文与检索范围 | [01-source-guide.zh.md](01-source-guide.zh.md)；[research/](research/) |
| 查看每条规则、豁免、来源与修改提示 | [02-rules-and-prompts.zh.md](02-rules-and-prompts.zh.md) |
| 查看原生接入流程、配置与安装细节 | [03-native-preset-and-workflow.zh.md](03-native-preset-and-workflow.zh.md) |
| 查看实测结果与验证边界 | [04-validation.zh.md](04-validation.zh.md)；[validation/](validation/) |
| 修改实际执行的判规和提示 | [rules.json](dsh-anti-overengineering/rules.json) |
| 修改默认阈值、频率和 preset 组成 | [cordis.patch.yml](dsh-anti-overengineering/cordis.patch.yml) |
| 阅读判规接入与频率算法 | [index.js](dsh-anti-overengineering/index.js)；[policy.js](dsh-anti-overengineering/policy.js) |

## 快速安装

先把本包解压。在已安装官方 Harness 的机器上执行，路径换成你解压后的绝对路径：

```bash
dsh plugin --profile web add /absolute/path/dsh-anti-overengineering-1.0.0.tgz
```

配置 `JEV_API_KEY` 凭据，重启 Harness，在新会话的预设选择器中选择 **anti-overengineering**。默认 Jev 服务为 `https://api.typesafe.ai/v1/systemone`，模型名为 `jev-latest`。地址、模型和凭据必须对应同一服务；具体步骤见 03 文档。TGZ 也可以通过原生插件安装入口导入。

## 默认策略

- 每个含受监控写操作的模型轮调用一次 Jev，同一批多个 write/edit 共享判断。
- Noul 阈值为 0.85，可按规则覆盖；最多选取 3 条规则组成一次修改提示。
- 默认 `mode: revise`：先阻止当前批次写入，再注入提示，让模型下一轮重提修改。
- 全局冷却 2 轮；同一规则冷却 6 轮；每 20 轮最多干预 4 次；每个会话最多干预 12 次。
- 冷却与限额由 Harness 插件执行并持久化，Jev 只返回规则分数。
- 默认 `judge.onError: allow`：判规失败时保留原生工具决策并记录错误；需要判规成功才可写时改为 `deny`。

这些数值是可调整的初始策略，未以真实 Jev 样本校准。冷却期间默认继续检查，但不重复拒绝或注入提示；达到会话干预上限后停止判规。

## 规则目录

| ID | 规则 |
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

每条规则要求依据用户任务与可见证据判断。用户明确要求的功能、配置、冷却、必要校验、兼容、测试和工程约束均不能仅因“看起来复杂”被删除。AE10 专门约束过度精简造成的功能与可读性损伤。

## 交付范围

资料检索覆盖官方工程准则、AI 编码提示与防御性代码规范等可核验来源；“全部原文”指本次检索范围内、具有明确可再分发条件的原文副本。无法确认全文再分发许可的网页保留链接、短摘录与本次摘要，来源导读逐项标注；不声称穷尽互联网。

实际监听原生 `write` / `edit`。`apply_patch` 等名称供已安装相应工具时接入，本包不额外创建它们。任意 shell 命令中的文件副作用及反复执行测试，未纳入本版自动检测。

已完成官方 CLI 安装、配置组合、Web 启动与 12 项聚焦运行时验证。Jev 返回使用固定测试数据，没有使用你的密钥，也没有宣称真实判规准确率。资料、规则和实现各自的许可证与来源在对应目录保留；生成文件的完整性清单为 [SHA256SUMS.txt](SHA256SUMS.txt)。
