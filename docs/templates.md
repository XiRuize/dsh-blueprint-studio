# 蓝图模板库

分两类模板：

| 来源 | 位置 | 说明 |
|---|---|---|
| 内置模板 | `client.js` 的 `TEMPLATES` | 随插件发布，不依赖文件 |
| 我的模板 | 工作区 `.dsh/blueprints/templates/<id>.json` | 面板里「存为模板」生成 |
| 社区模板 | 仓库 `templates/`（`index.json` + 每个模板 JSON） | 通过 PR 贡献，随包发布 |

## 模板格式

```json
{
  "id": "ecommerce-admin",
  "name": "电商后台",
  "description": "商品、订单、库存三条主链路",
  "domain": "ecommerce",
  "tags": ["ecommerce", "admin"],
  "author": "your-github-id",
  "version": "1.0.0",
  "blueprint": {
    "title": "电商后台",
    "summary": "最小可用的电商管理后台",
    "sections": [{ "key": "goals", "title": "目标", "items": [{ "id": "g1", "text": "..." }] }],
    "diagrams": [{ "key": "module", "layerId": "A", "type": "module", "title": "模块图", "nodes": [], "edges": [] }],
    "modules": [{ "id": "A1", "name": "订单", "layerId": "A", "code": "A1", "summary": "..." }]
  }
}
```

约束：

- `id` 为 `[a-z0-9-]`，2–64 字符；
- 至少包含 `sections`、`diagrams`、`modules` 之一；
- 单个模板 ≤ 512 KB；
- 只保存可复用的蓝图片段：`sessionId`、`status`、验证记录等运行时会话字段会被剥离。

## 命令

```text
/blueprint template list                 # 本地 + 社区模板清单（JSON）
/blueprint template get <id>             # 模板全文（JSON）
/blueprint template save <base64-json>   # 保存/覆盖本地模板
/blueprint template import <base64-json> # 导入（等价 save，id 冲突时覆盖）
/blueprint template remove <id>          # 删除本地模板
/blueprint template export <id>          # 导出 JSON（可分享）
```

面板入口：欢迎页「模板库」，可应用、导入、删除；已打开蓝图时工具栏有「存为模板」。

## 贡献社区模板

1. 在 `templates/` 新增 `<id>.json`（按上面格式）；
2. 在 `templates/index.json` 的 `templates` 数组登记 `{id,name,domain,author,file}`；
3. 本地跑 `node --test test/templates.test.mjs`（会校验仓库内模板格式）；
4. 提 PR，说明适用场景与已知假设。

## 安全说明

- 社区模板随仓库分发，不联网拉取；`import` 只接受用户粘贴/选择的 JSON；
- 模板只带需求与模块结构，不携带命令执行权限；`execution.allow/commands` 即使写在模板里，也会在「分派前复核」里明确展示并要求勾选确认；
- 模板里出现 `..` 路径或非 `[a-z0-9-]` 的 id 会被拒绝。
