# 借鉴项目研究：Blueprint Studio 的下一阶段

调研日期：2026-11-11。目标不是复制产品，而是提炼可迁移的工程机制。

## 1. dsh-synapse

仓库：https://github.com/liangmianya/dsh-synapse

核心模式：

- DSH session log 是唯一事实来源；插件只保存画布布局与短预览，不复制会话历史。
- 画布是投影（projection），不是第二套状态。
- 插件不修改 prompt、模型请求、工具 schema、provider 路由或 KV-cache 前缀。
- 地图与原生会话双向同步；归档共用同一集合，不各记一套。
- 工作区加载有竞态保护，读失败时明确报错并保持只读，不拿旧备份覆盖。

对 Blueprint 的启示：

- Blueprint 文件是事实来源，Workspace/UI 只是投影；不要把布局、执行状态散落到第二份 JSON。
- 任何“地图/看板/视图”都应可重建，并明确只读投影边界。
- 跨会话/跨工作区切换要有竞态保护与只读失败模式。

## 2. dsh-genui

仓库：https://github.com/Max-Null/dsh-genui

核心模式：

- 模型只输出受限的 `dsh-ui` JSON；组件白名单、无 HTML/script 注入、无 eval。
- 本地优先：排序、折叠、评分、表单状态在浏览器本地完成，只有真正需要模型的动作才回传。
- 诚实交互：没有 action 的按钮禁用，避免“看起来能点但无行为”。
- 有界 spec：节点数、嵌套深度、字符串长度、数值范围都有上限；坏节点丢弃而不是崩溃。
- 按 session + content fingerprint 持久化局部状态；相同内容重渲染保留状态。
- 按需加载重引擎；错误自愈（mermaid 修复后再降级）。
- 双通道渲染，兼容不同宿主版本。

对 Blueprint 的启示：

- 图表/面板应继续使用**声明式、有界、白名单**的数据，而不是让模型直接写 HTML/SVG。
- 交互要区分本地动作与模型动作；按钮必须有真实行为或禁用。
- 面板状态应按 blueprint content hash 持久化，避免版本切换污染。
- 重渲染/导出应尽量确定性，错误要可修复、可降级。

## 3. answer-me-with-html

仓库：https://github.com/QingYunA/answer-me-with-html

核心模式：

- 模型只写 Markdown 语义草稿；CLI 负责模板、布局、CSS、SVG、dagre 排版。
- 同样内容模型输出 token 约为手写 HTML 的 1/8，速度约 2.6 倍。
- 错误返回行号、组件和正确示例，让 Agent 一次修好。
- 页面是单文件、离线、无 CDN；源 Markdown 嵌入页面，可复制回来。
- 快照测试保证重构不改变渲染结果。
- 写作检查（STE）把“可读性”变成可执行规则。

对 Blueprint 的启示：

- 继续坚持“模型写语义，渲染器写布局”，不要把坐标/样式交给模型。
- 导出/校验错误应带可定位信息与修复示例。
- 用快照测试锁定导出与布局。
- 单文件离线导出是评审场景的关键能力。

## 4. dsh-blender-plugin

仓库：https://github.com/sixtysevenlf/dsh-blender-plugin

核心模式：

- 仅 6 个模型工具，背后是 34 family / 228 op 的能力目录；小工具面 + 大能力目录，控制上下文成本。
- `blender_session` 负责会话所有权、claim/release、写范围、暂停、事务快照与标记。
- `blender_run` 异步提交 render/headless job，立即返回 job id，再 wait/collect。
- GUI 优先，headless 兜底；没有 GUI 也能执行并返回渲染帧。
- 视觉验收门禁：渲染对比、缺陷裁剪、测量、阻断交付。
- 明确安装验收：`doctor.kind === ok`；不满足不得宣称成功。
- 事务/回滚、写范围、并行 job 与主 GUI 分离。

对 Blueprint 的启示：

- 工具面保持小；执行能力通过 **capability catalog / operation id** 扩展。
- 模块执行需要 **mount claim / write scope / transaction snapshot / rollback mark**。
- 长任务应异步提交 job，蓝图保存 runId/状态/证据，而不是阻塞面板。
- 交付必须有可观察的验收检查，不能只靠 Agent 自述。

## 5. loopx

仓库：https://github.com/loopx-project/loopx

核心模式：

- 持久 Goal / Todo / Gate / Evidence / Quota / Recovery 控制平面。
- 一个 turn 是一次受治理的状态转移，不是计时器。
- claim / lease / ownership / typed continuation，支持跨会话与 peer agent。
- 证据分支持/反驳/未知；写回必须经过验证，不能把未验证运行当成功。
- `quota should-run` 决定是否行动；spend 只在验证后的 writeback 记账。
- 人类授权门禁；危险动作、发布、生产写入不由 Agent 自主决定。
- review packet 汇总决策、证据、验证和未解决 gate。

对 Blueprint 的启示：

- 模块执行需要 **durable run ledger**：目标、尝试、证据、决策、下一次动作。
- 需要 claim/lease 与配额（并发/尝试次数），避免多 Agent 重复写。
- 完成必须由证据与 human gate 决定，不能由 Agent 自报。
- 跨会话恢复应读取同一份 run ledger，而不是靠聊天记忆。

## 6. 对 Blueprint Studio 的优先级

### P0：Execution Ledger + Transactional Dispatch

借鉴 LoopX + Blender：

- 每个模块的 run 记录：runId、mounts、adapter、base snapshot、claim、状态、证据、决策、next action。
- mount claim/lease，防止两个子代理同时写同一 working mount。
- 执行前记录 base ref/checksum，执行后记录 changed paths / commit / test evidence。
- 失败/冲突时给 rollback plan（先记录，不自动破坏文件）。
- 小工具面：start / claim / complete / fail / collect，能力通过 operation id 扩展。

### P1：Execution Adapter 契约

- `dsh-subagent`（cwd/allow/commands）
- `cli` / `http` / `manual` 描述符，不存密钥
- 异步 job + 结果回收，避免面板阻塞

### P2：确定性评审页

借鉴 answer-me-with-html：

- 单文件离线 HTML/Markdown 评审页
- 语义草稿 + 渲染器布局，模型不写坐标
- 快照测试锁定布局
- 带行号/组件/示例的校验错误

### P3：Blueprint 会话/分支地图

借鉴 dsh-synapse：

- 版本、决策、分支、run 在同一张只读投影图上
- 事实来源仍是 blueprint 文件与 run ledger
- 不复制会话正文

### P4：安全交互面板

借鉴 dsh-genui：

- 有界组件 spec、白名单、动作协议
- 本地动作与模型动作分离
- 状态按 content hash 持久化

## 7. 不做

- 不复制 LoopX 的完整 quota/benchmark 体系。
- 不复制 Blender 的 228 操作目录；只做可验证的少量 operation。
- 不引入 Mermaid/ECharts/Three 运行时依赖到 Blueprint 核心。
- 不让 Blueprint 自动执行危险/生产写操作；人工 gate 保留。
- 不把会话正文/代码复制进蓝图；只保存引用、证据和投影。
