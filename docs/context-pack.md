# 模块上下文包（Context Pack）

蓝图回答“要做什么”，上下文包回答“代码里到底有什么”。分派前必须编译上下文包：它把蓝图里的
`mounts` / `files` / `acceptance` 与磁盘上的真实文件、导出符号、import 边、测试命令合并成一段
可以直接塞进子代理提示词的 Markdown。

## 为什么

图是模型凭先验画的，不包含仓库信息；子代理真正需要的是文件路径、函数签名和测试命令。
上下文包只写入可验证的事实，解析不到就报缺口，不假装完整。

## 命令

```text
/blueprint context <moduleId>     # 单个模块的 Markdown 包
/blueprint brief                  # 所有叶子模块的 JSON（供客户端/工具消费）
```

工具：

```text
blueprint(action="brief")                 # 同 /blueprint brief
blueprint(action="brief", moduleId="api") # 只编译一个模块
```

## 包里有什么

- **工作区**：mounts 解析后的绝对路径、`kind`/`access`；未声明 mounts 时使用会话 cwd 并标注。
- **文件**：`module.files` 逐个解析，支持 `*` / `**` / `?`；只列真实存在且是文件的路径，缺失的单独列出。
- **导出符号**：JS/TS 的 `export function|class|const|{}`、`module.exports`、`exports.x`，
  Python 的 `def` / `class` / 常量 / `__all__`。这是启发式解析，跨行参数会合并；解析不到时标注
  “需人工确认”，不会伪造。
- **依赖边**：来自仓库扫描的 import 图，区分进入本模块的边与离开本模块的边。
- **测试**：按文件名主干或同目录匹配测试文件，并附上包管理器检测到的测试命令。
- **验收与需求**：`module.acceptance` 与挂到该模块的需求条目（含 `R1` 编号）。

## 约束

- 单包上限 12,000 字符，超出截断并注明；文件上限 40 个，符号上限 24 个/文件。
- 不读二进制、不读超过 256 KB 的源文件（标注 `too-large`）。
- 只读：编译不写蓝图、不写版本、不执行命令。

## 分派门禁

`/blueprint dispatch <token>` 会先为所有叶子模块编译上下文包：

- 任一模块声明的文件在 mounts（或 cwd）下解析不到 → 分派被拒绝，一次性令牌**不被消费**，
  返回具体模块与缺失路径；修正 `mounts` / `module.files` 后重新点击分派即可。
- 未声明 `files` 的模块允许分派，但包内会标注 “未声明文件”，并给出 warning。
- 成功时返回值包含 `packs` 与 `grounding.warnings`，客户端把 `packs` 原样注入提示词。

## 与 done 的关系

`done` 只在 `tests` / `reviewer` / `human` 三层全部 `passed` 时成立。历史上“自报 done、验证全 pending”
的模块在读取时会被规范化为 `needs-rework`，不会再被当作已完成。
