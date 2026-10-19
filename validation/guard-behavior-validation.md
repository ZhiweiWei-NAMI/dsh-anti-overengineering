# 反过度工程化 Preset：独立运行验证

验证日期：2026-10-19。运行时为已安装的官方 `@deepseek-ai/dsh@0.2.1-rc.2`，Node `v24.19.0`。本次负责测试的代理未修改交付代码；发现加载问题后由主代理修复，再运行验证。

## 结果

**12 项聚焦行为测试全部通过，0 失败。** 配置覆盖的另一个检查也通过：`Config({rules:{AE03:{threshold:0.9}}}).rules` 精确返回 `{AE03:{threshold:0.9}}`，没有将省略字段补成 `false`、`0` 或空字符串。

| 测试 | 验证到的实际结果 |
|---|---|
| 预执行拒绝与提示注入 | Jev fixture 高分后原生 ToolRuntime 返回错误结果；工具 body 执行 0 次；结果含 1 条原生 `additionalContexts` 修改提示。 |
| 同批两次并发 write/edit | 原生 ToolRuntime 对两次调用均拒绝；Jev 只调用 1 次；只注入 1 条提示；持久计数为 1 次 judgment / 1 次 intervention。 |
| 可选 raw-string apply_patch 入批 | 同一 assistant 响应中的原生 write 与原始补丁字符串同时进入一次 Jev 请求；补丁换行、中文和全文精确保留，没有因 JSON.parse 失败被遗漏。验证的是入批内容，未安装或执行另一个第三方 apply_patch 实现。 |
| 已有 ask + 规则通过 | Jev 仍被调用；原生审批服务收到原始 reason；允许后工具 body 才执行。 |
| 已有 ask + 命中规则 | 判断收窄为 deny；未调用批准流程，也未执行工具 body。 |
| 已有下游 pre deny | 既有 reason 保留，Jev 未调用，工具 body 未执行。 |
| 已有下游 post block | 既有错误 feedback 与原有上下文保留，同时附加本规则提示。 |
| 全局 2 轮 / 同规则 6 轮冷却 | 在命中后的第 1、2 轮禁止再次介入；第 3 轮可由其他规则介入；同一规则间隔 6 轮仍冷却，间隔 7 轮可介入。冷却只抑制提示，测试仍观察到逐次判断。 |
| 不同规则互不误抑制 | A 在自身冷却期内，B 达阈值且全局冷却结束时，B 可以单独触发。 |
| 滑动窗口限额 | 4 轮窗口最多 2 次介入；老记录恰好离开窗口的边界轮恢复触发。 |
| 会话限额重启恢复 | 原生 JSON storage 写入后关闭整个 Context，以新 Context 重开同一目录和会话；计数恢复，达到会话上限后不再调用 Jev。 |
| 冷却字段重启恢复 | 同样以真实磁盘 close/reopen 验证 lastInterventionRound、ruleLastRounds、windowRounds 及其后续行为保持。 |
| 只读工具和非目标 preset | 不调用 Jev，不写入该会话的介入状态。 |

部分项目由同一测试组合验证；总自动测试数量为 12，不是表格行数。

## 实际使用的原生部件与 fixture 范围

真实加载了官方 Cordis Context、SystemPrompt、ToolRuntime、Session、消息构造函数，以及 Storage → StorageJson → StorageDomain 全链路。持久化验证实际写入测试目录内的 JSON，再关闭、重建 Context 读取；并非仅用一个跨测试 Map 模拟恢复。

Jev 的 `fetch`、凭据 resolver、目标 preset 选择、`sessionStats.steps` 时钟与批准答复使用测试 fixture。HTTP fixture 断言默认地址为 `https://api.typesafe.ai/v1/systemone`，请求为 `model/state/questions`，每条规则类型为 `noul`，返回只有 `type/noul` 即可被正确解析。没有使用真实密钥，没有发送外部推理请求，因此这些测试验证宿主兼容性和流程，不证明 Jev 的判规准确率。

## 两个已修复的实际加载问题

1. 初次 import 时，Schemastery 不提供 Zod 风格的 `literal`、`record`、`optional`。主代理改为 `union` 字符串常量、`dict(valueSchema)`，并保留默认非 required 的省略字段。记录 schema 的 Zod 部分没有作无关修改。
2. 原 domain 名 `anti-overengineering-v1` 不符合官方 `/^[a-z][a-z0-9_]*$/`。主代理改为 `anti_overengineering_v1` 后正常初始化、写入和重开。

## 最终小修复后的复验

主代理调整 proposedBatch：当前工具优先使用已解析的 exec.arguments，其他工具不能解析为 JSON 时保留原始字符串；remind 文案改为描述规则检查自身的行为，不再声称工具已经执行。随后仅新增上表 raw-string apply_patch 的一个必要用例，并重跑原有 11 项；最终 12/12 通过。结果 JSON 已更新为最终被测代码的哈希。

## 复现

在 `verify-native` 目录中已有官方运行时依赖，`guard` 是交付包目录的只读导入符号链接。运行：

```bash
node --preserve-symlinks --test --test-isolation=none --test-concurrency=1 --test-reporter=spec guard-behavior.test.mjs
```

测试文件：`guard-behavior.test.mjs`。机器可读结果与被测文件的 SHA-256 见 `guard-behavior-result.json`。这份结果只对应其中列出的源码快照；代码若再变动，主代理应判断变动是否影响已验证流程。
