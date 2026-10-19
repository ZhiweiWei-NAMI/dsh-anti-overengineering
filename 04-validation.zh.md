# 安装与运行验证（原始 1.0.0 历史记录）

> 以下结果仅对应原始 **1.0.0** 安装包及当时源码，不是当前 **1.1.0** 行为判规版的验证结果。当前改动与未验证范围见[仓库 README](README.md)。

验证日期：2026-10-19。目标及实测运行时：官方 `@deepseek-ai/dsh@0.2.1-rc.2`；Node `v24.19.0`；原生安装器使用 pnpm `11.25.0`。所有操作在本次任务的隔离配置与临时数据目录中完成。

## 验证结论

**最终 TGZ 已通过官方 CLI 安装并成功启动 Web；12 项聚焦运行时测试全部通过，0 失败。** 同时核对了 TGZ 中 10 个文件与交付源码逐字节一致。Jev 使用模拟响应，因此结论适用于宿主接口、拦截时序、批次合并、冷却与状态恢复，不表示真实判规准确率已经校准。

| 项目 | 结果与证据 |
|---|---|
| 官方包管理安装 | 使用 `dsh plugin --profile web add …tgz` 安装最终包，退出码 0；无安装构建步骤。 |
| 原生配置组合 | `web --dump-config` 退出码 0，包含 `anti-overengineering-runtime` 和 `preset-anti-overengineering`。 |
| 最终包启动 | Web 输出就绪地址；本机未认证请求得到预期 HTTP 401，表明原生认证服务已监听；随后停止测试进程。[记录](validation/native-startup-result.json) |
| 原生工具行为 | 使用真实 Cordis Context、ToolRuntime、Session 及消息构造，验证 pre 拒绝与 post 提示注入。[记录](validation/guard-behavior-validation.md) |
| 原生持久化 | 使用真实 Storage → StorageJson → StorageDomain，关闭 Context 后在新 Context 读取磁盘，计数和冷却字段恢复。 |
| 最终代码一致性 | TGZ 10 个文件逐字节匹配源码；行为测试记录附被测源码 SHA-256。[归档检查](validation/package-integrity-result.json) |
| 完整 schema 导出 | **未通过。** 官方默认 profile 本身也报告 preset carrier 错误，详见下节；不把此项记为通过。 |

最终 TGZ 的 SHA-256：

```text
d66659ce00290b8ec15af00c0c52d0160a816ea7d7fafd92dcb6dd54918f96e1
```

## 12 项测试覆盖了什么

测试重点是用户要求的控制逻辑及原生审批约束：命中时工具 body 执行次数为 0；同批多个 write/edit 只调用一次 Jev、只注入一条提示，而且全部拒绝；通过时保留原生 ask，命中时收窄为 deny；原有 deny、post block、feedback 与 additionalContexts 保留。

频率测试检查了全局 2 轮与同规则 6 轮的准确边界、不同规则互不误抑制、滑动窗口记录离开窗口的边界，以及会话上限与冷却的真实磁盘恢复。只读工具和非目标 preset 不触发 Jev。新增的唯一补丁兼容测试确认非 JSON 的 raw-string `apply_patch` 与同批 write 一起完整进入 Jev state，保留换行和中文。

测试也核对了 `model/state/questions` 请求结构、`noul` 响应字段，以及单条配置只覆盖 threshold 时不会把其他省略字段误补成 false、0 或空字符串。具体断言和测试计数见 [guard-behavior.test.mjs](validation/guard-behavior.test.mjs) 与 [机器可读结果](validation/guard-behavior-result.json)。表格或段落中的行为数不等于独立测试数，部分断言在同一用例中验证。

## 原生 schema 导出的已知限制

在固定官方版本上执行 `web --dump-config-schema`，默认 profile 即以退出码 1 结束，`x-cordis.complete` 为 false。四个内置 preset（standard、ptc、minimal、cordis）均产生：

```text
unrecognized Loader tree carrier; use cordis:group or cordis:include for native child collection
```

加入本包后，本包 Host 配置成功投影为 schema；新增 preset carrier 产生相同错误。已用不加载本包的官方默认配置作对照，结果见 [schema-export-comparison.json](validation/schema-export-comparison.json)。这是该版本完整 schema 遍历 preset 的现有限制；实际安装、配置组合与启动检查成功。没有修改官方项目或把不完整导出改写为成功。

## 真实部件和模拟数据的边界

行为测试中的 HTTP/Jev 返回、凭据解析结果、目标 preset 标识、`sessionStats.steps` 时钟与审批答复是 fixture；其余列出的原生运行时和持久化链路均真实加载。没有读取你的密钥，也没有发出 Jev 或聊天模型推理请求。

因此尚未验证你的具体 Jev 账户、模型可用性、真实代码任务的误报漏报率、调用延时或费用；也未在你的 Desktop 实例中进行实际聊天。Web 启动检查验证的是最终包能随官方应用启动，不等同于一次真实模型会话。预设适配版本已固定，其他版本需要重新核对原生接口。

## 复现聚焦测试

安装使用 preset 不需要执行以下步骤。若要独立复核，可在一个临时目录安装固定官方运行时，将本包测试复制到该目录，并用 `guard` 指向解压的插件源码。Linux/macOS 示例：

```bash
# 先进入自行创建的临时验证目录。
npm install --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@0.2.1-rc.2
cp /absolute/path/validation/guard-behavior.test.mjs .
ln -s /absolute/path/dsh-anti-overengineering guard
node --preserve-symlinks --test --test-isolation=none --test-concurrency=1 --test-reporter=spec guard-behavior.test.mjs
```

测试会在当前验证目录写入 `behavior-fixtures/`；不连接付费推理接口。无需运行官方项目的全量测试矩阵。
