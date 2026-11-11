import {
  ALL_NODE_TYPES,
  archiveBlueprintVersion,
  blueprintAbsolutePath,
  blueprintContentHash,
  blueprintDigest,
  blueprintRelativePath,
  blueprintVersionsIndexRelativePath,
  createConfirmTokenStore,
  deleteBlueprintFile,
  mergeBlueprintForUpdate,
  normalizeBlueprint,
  parseBlueprintSaveInput,
  readBlueprintFile,
  readBlueprintVersion,
  readVersionsIndex,
  recordModuleVerification,
  saveBlueprintFromCommand,
  semanticDiff,
  verifyBlueprintToken,
  writeBlueprintFile,
  DIAGRAM_DEFS,
  SECTION_DEFS,
} from './lib/blueprint.js'
import { CHECK_RULES, analyzeBlueprint, coverageMatrix } from './lib/checks.js'
import { PLAN_CHECK_RULES, analyzePlan } from './lib/plan.js'
import { exportHtml, exportMarkdown } from './lib/export.js'
import { PLAN_MODE_PROMPT } from './lib/plan.js'

export const name = 'blueprint-studio'
export const inject = ['tools']

const TOOL_DESCRIPTION = `在写代码之前，把需求整理成可协作的工程蓝图：需求栏目、用例图、数据流图、模块图、时序图、ER 图、C4 图、类图、状态图，以及用于编排实施步骤的计划流程图（可选），另有可独立分派的模块列表。

蓝图会保存到当前会话工作区的 .dsh/blueprints/<sessionId>.json，用户在「蓝图」面板中能直接看到、手工增删改，之后点击「确认并分派」。每次保存会自动归档上一版，可在「版本」里对比和恢复。

action:
- create：创建或整体覆盖蓝图（需要 blueprint 对象）。
- update：在已有蓝图上合并更新：sections 未提交的 items 沿用旧值，显式 items: [] 会清空；diagrams 按 layerId+type 对齐（root 兼容旧 key），节点/边按 id 合并，未提交的节点/边和子层图保留，用 removedNodeIds / removedEdgeIds / removedModuleIds / removedLayerIds / removedDiagramKeys 显式删除。
- get：读取当前蓝图全文；用户确认后、分派模块前必须先 get。
- confirm：已禁用。确认只能由用户在「蓝图」面板发起，Host 会校验一次性确认令牌。
- dispatch：已禁用。分派只能由用户在「蓝图」面板完成，Host 会校验一次性确认令牌。
- snapshot：把当前蓝图归档为一个手工版本（可传 label）。
- delete：删除当前会话的蓝图文件。

blueprint 结构：
{
  "title": "一句话标题",
  "summary": "2-3 句方案摘要",
  "prompt": "用户的原始需求",
  "layers": [
    {"letter":"A","title":"总览","parentModuleId":null},
    {"letter":"B","title":"认证层","parentModuleId":"api"}
  ],
  "sections": [{"key":"goals|actors|functional|nonfunctional|constraints|acceptance|risks|自定义","title":"栏目名","items":[{"id":"i1","uid":"goals:i1","code":"R1","text":"条目文本","moduleId":"可选模块 id"}]}],
  "diagrams": [{
    "key": "usecase|dfd|module|sequence|er|c4|class|state|flowchart（仅 A 层）；子层用 \"B:dfd\"",
    "layerId": "A",
    "type": "usecase|dfd|module|sequence|er|c4|class|state|flowchart",
    "title": "图解名",
    "nodes": [{"id":"u1","type":"...","label":"名称","technology":"可选","description":"可选","parentGroup":"可选，同图 group 节点 id","condition":"可选，decision 条件","owner":"可选，负责人","verification":"可选，验证方式","collapsed":false,"requirementIds":["goals:i1"],"fields":[{"name":"id","type":"uuid","key":true}]}],
    "edges": [{"from":"u1","to":"u2","label":"标签","kind":"association|flow|depends|sync|async|return|relationship|dashed","cardinality":"1..*","order":1}]
  }],
  "modules": [{"id":"auth","name":"认证模块","layerId":"A","code":"A1","parentId":null,"summary":"范围、接口与验收要点","dependsOn":["db"],"nodeIds":["usecase:u1"],"files":["lib/auth.js"],"acceptance":["登录成功后返回会话令牌"],"status":"pending","verification":{"tests":{"status":"pending","evidence":[]},"reviewer":{"status":"pending","evidence":[]},"human":{"status":"pending","evidence":[]}}}]
}

分层规则：
- A 是根层（总览），始终存在；子层 letter 唯一，可写 A–Z、AA/AB…，id 与 letter 相同。
- 子层通过 parentModuleId 指向父层中的模块；父子不能成环，层数 ≤64，层级深度 ≤4（A 算第 1 层）。
- 模块保留稳定 id；layerId 默认 A，code 形如 A1/B1（前缀必须等于 layer.letter，全局唯一），parentId 在根层为 null、子层等于该层 parentModuleId。
- 仅根层 A 自动补齐原有 8 张图；计划流程图（flowchart）是第 9 张可选图，只有 diagrams 中显式出现时才创建（旧蓝图不会被自动补出）。子层只在 diagrams 显式出现时创建，对应 key 为 "<letter>:<type>"，同一 layer+type 唯一。
- 条目 uid 为 "<sectionKey>:<id>"，code 全局唯一且只增不改（R1/R2…）；可选 moduleId 指向模块 id，不存在时保留原值并由自检报告。
- 上限：需求条目 ≤2000、图实例 ≤256、模块 ≤500、层 ≤64、深度 ≤4；超出会返回可读错误，不会静默截断。

节点类型：
- usecase：actor、usecase、system。
- dfd：entity（外部实体）、process（处理）、store（数据存储）。
- module：module、external。
- sequence：participant、actor（用 kind=sync/async/return 表示同步/异步/返回消息，order 表示消息顺序）。
- er：entity（用 fields 写字段，key=true 表示主键）、relationship（菱形关系，边上写 cardinality）。
- c4：person、system、container、component、database、external（technology/description 写技术栈和职责）。
- flowchart：start（开始）、end（结束）、process（步骤）、decision（判断，用 condition 写条件）、group（阶段分组，label 必填，可 collapsed）、note（备注）；边 kind 只用 flow（实线，默认）或 dashed（虚线）；可用 parentGroup 把步骤归入同图的 group，用 owner/verification 写负责人和验证方式。

要求：
- 用例图至少包含 actor 与 usecase；需要系统边界时加一个 type=system 的节点。
- 数据流图用 entity → process → store 表达数据流，边上写数据名称。
- 模块图用 module 节点表达模块依赖，边用 depends。
- 时序图参与者放节点，消息放边，按 order 从上到下。
- ER 图实体字段写在 fields，关系边上写基数。
- C4 图用 technology 写技术选型，description 写职责。
- 计划流程图可选：用 start/end 界定范围，process 写可执行步骤，decision 的 condition 写分支条件，group 组织阶段并用 parentGroup 归属步骤；只在需要时显式创建 flowchart。
- 可追踪：节点用 requirementIds 引用 "<sectionKey>:<itemId>"（如 goals:i1）；模块用 nodeIds 引用 "<diagramKey>:<nodeId>"（如 usecase:u1），并用 files、acceptance 写清涉及文件与验收标准。
- 分层验证：模块的 verification 分 tests / reviewer / human 三层，只能由用户执行 /blueprint verify 写入；工具 update 会保留旧值，不能通过传 verification 绕过。任一层 failed 会把模块置为 needs-rework，三层全部 passed 才会置为 done，其余情况保持原状态。
- 模块拆分到「一个子代理能独立完成」的粒度，并在 summary 里写清交付物与验收标准。
- 不要编造用户没有提供的业务事实；不确定的写进 risks 栏目。`

const NODE_TYPES = ALL_NODE_TYPES

// The /blueprint check result is a single command payload. Keep it bounded even
// when a deliberately broken blueprint produces thousands of issues.
export const CHECK_ISSUE_LIMIT = 200

function errorMessage(error) {
  const message = (error instanceof Error ? error.message : String(error ?? '')).trim()
  return message === '' ? '未知错误' : message
}

function blueprintLayerIds(blueprint) {
  const layers = Array.isArray(blueprint?.layers) ? blueprint.layers : []
  const ids = []
  for (const layer of layers) {
    if (layer === null || typeof layer !== 'object') continue
    const id = String(layer.letter ?? layer.id ?? '').trim().toUpperCase()
    if (id !== '' && !ids.includes(id)) ids.push(id)
  }
  return ids
}

// Parse the scope of `/blueprint export <md|html> [all|<layer letter>]`.
// An omitted scope means the root layer A; `all` includes every layer.
export function parseExportScope(rawInput) {
  const value = String(rawInput ?? '').trim()
  if (value === '') return { ok: true, global: false, layerId: 'A' }
  if (value.toLowerCase() === 'all') return { ok: true, global: true, layerId: 'A' }
  const layerId = value.toUpperCase()
  if (!/^[A-Z]+$/u.test(layerId)) {
    return {
      ok: false,
      message: `无效的导出范围“${value}”。用法：/blueprint export md|html [all|层 letter]，例如 /blueprint export md A。`,
    }
  }
  return { ok: true, global: false, layerId }
}

// Cap the issues array without touching the source analysis. `summary` still
// counts every issue, while `truncated` tells the caller that the JSON list is
// a prefix of the full result.
export function truncateCheckIssues(issues, limit = CHECK_ISSUE_LIMIT) {
  const list = Array.isArray(issues) ? issues : []
  const max = Number.isInteger(limit) && limit >= 0 ? limit : CHECK_ISSUE_LIMIT
  const truncated = list.length > max
  return {
    issues: truncated ? list.slice(0, max) : list,
    truncated,
  }
}

export function decodeSnapshotLabel(raw) {
  const value = String(raw ?? '')
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function objectArgs(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function summaryText(blueprint, path) {
  const digest = blueprintDigest(blueprint)
  const lines = [
    `蓝图：${digest.title}`,
    `状态：${digest.status}`,
    `文件：${path}`,
    '',
    '需求栏目：',
    ...digest.sections.map(section => `- ${section.title}（${section.items} 条）`),
    '',
    '层：',
    ...digest.layers.map(layer => `- ${layer.letter} ${layer.title}${layer.parentModuleId ? `（父：${layer.parentModuleId}）` : ''}`),
    '',
    '图解：',
    ...digest.diagrams.map(diagram => `- ${diagram.title}：${diagram.nodes} 节点 / ${diagram.edges} 连线`),
    '',
    '模块：',
    ...(digest.modules.length === 0
      ? ['- 未拆分']
      : digest.modules.map(module => `- ${module.name}${module.dependsOn.length > 0 ? `（依赖 ${module.dependsOn.join('、')}）` : ''}`)),
  ]
  return lines.join('\n')
}

export function apply(ctx, rawConfig) {
  const config = objectArgs(rawConfig)
  const workingDirectory = ctx.get('workingDirectory')
  // Host-side gate: only the /blueprint confirm + dispatch commands can issue and spend
  // confirmation tokens. The tool handlers below can never create or consume one.
  const confirmTokens = createConfirmTokenStore({
    ttlMs: Number.isFinite(config.confirmTokenTtlMs) ? config.confirmTokenTtlMs : undefined,
  })

  const cwdOf = async agent => {
    const sessionCwd = agent?.session?.header?.cwd
    if (typeof sessionCwd === 'string' && sessionCwd !== '') return sessionCwd
    if (workingDirectory !== undefined && agent?.session !== undefined) {
      const fromSession = workingDirectory.get(agent.session)
      if (typeof fromSession === 'string' && fromSession !== '') return fromSession
    }
    if (workingDirectory !== undefined && agent !== undefined) {
      return await workingDirectory.ensure(agent)
    }
    if (workingDirectory?.defaultDirectory !== undefined) return workingDirectory.defaultDirectory
    return process.cwd()
  }

  const sessionIdOf = agent => agent?.id ?? 'session'

  const fileOf = async agent => {
    const cwd = await cwdOf(agent)
    const sessionId = sessionIdOf(agent)
    return {
      cwd,
      sessionId,
      absolute: blueprintAbsolutePath(cwd, sessionId),
      relative: blueprintRelativePath(sessionId),
    }
  }

  const readCurrent = async agent => {
    const file = await fileOf(agent)
    const raw = await readBlueprintFile(file.absolute)
    return { file, raw }
  }

  const archive = async (file, blueprint, source, label) => {
    if (blueprint === undefined || blueprint === null) return
    try {
      await archiveBlueprintVersion(file.cwd, file.sessionId, blueprint, { source, label })
    } catch (error) {
      ctx.logger?.warn?.(`blueprint-studio: could not archive version: ${String(error)}`)
    }
  }

  const definition = {
    name: 'blueprint',
    description: TOOL_DESCRIPTION,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'get', 'confirm', 'dispatch', 'snapshot', 'delete'],
          description: '要执行的操作；默认 get。',
        },
        blueprint: {
          type: 'object',
          additionalProperties: true,
          description: 'create/update 时提供的蓝图对象，结构见工具说明。',
        },
        title: { type: 'string', description: '可选：只更新标题。' },
        summary: { type: 'string', description: '可选：只更新摘要。' },
        prompt: { type: 'string', description: '可选：只更新原始需求。' },
        label: { type: 'string', description: 'snapshot 时的版本说明。' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args, value) {
        if (value === null || typeof value !== 'object') return [{ type: 'text', text: String(value ?? '') }]
        const parts = []
        if (typeof value.message === 'string') parts.push(value.message)
        if (value.blueprint !== null && typeof value.blueprint === 'object') {
          parts.push('```json\n' + JSON.stringify(value.blueprint, null, 2) + '\n```')
        }
        if (parts.length === 0) parts.push(JSON.stringify(value, null, 2))
        return [{ type: 'text', text: parts.join('\n\n') }]
      },
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const input = objectArgs(args)
      const action = typeof input.action === 'string' ? input.action : 'get'
      const agent = exec?.agent

      if (action === 'get') {
        const { file, raw } = await readCurrent(agent)
        if (raw === undefined) {
          return { found: false, path: file.relative, absolutePath: file.absolute, message: '当前会话还没有工程蓝图。' }
        }
        const blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        return {
          found: true,
          path: file.relative,
          absolutePath: file.absolute,
          blueprint,
          message: summaryText(blueprint, file.relative),
        }
      }

      if (action === 'delete') {
        const file = await fileOf(agent)
        const raw = await readBlueprintFile(file.absolute)
        if (raw !== undefined) await archive(file, normalizeBlueprint(raw, undefined, { sessionId: file.sessionId }), 'ui', 'before delete')
        const removed = await deleteBlueprintFile(file.absolute)
        return { removed, path: file.relative, message: removed ? `已删除蓝图 ${file.relative}` : '蓝图文件不存在。' }
      }

      if (action === 'snapshot') {
        const { file, raw } = await readCurrent(agent)
        if (raw === undefined) throw new Error('还没有工程蓝图，无法归档。')
        const current = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        const archived = await archiveBlueprintVersion(file.cwd, file.sessionId, current, {
          source: 'manual',
          label: typeof input.label === 'string' ? input.label : '',
        })
        return {
          ok: true,
          skipped: archived?.skipped === true,
          path: file.relative,
          versionsPath: blueprintVersionsIndexRelativePath(file.sessionId),
          message: archived?.skipped === true ? '当前蓝图与最近版本相同，未新增版本。' : '已归档当前蓝图版本。',
        }
      }

      if (action === 'create' || action === 'update') {
        const patch = objectArgs(input.blueprint)
        if (Object.keys(patch).length === 0 && input.title === undefined && input.summary === undefined) {
          throw new Error('create/update 需要 blueprint 对象。')
        }
        const { file, raw } = await readCurrent(agent)
        const previous = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
        const merged = {
          ...(action === 'update' ? previous ?? {} : {}),
          ...patch,
        }
        if (input.title !== undefined) merged.title = input.title
        if (input.summary !== undefined) merged.summary = input.summary
        if (input.prompt !== undefined) merged.prompt = input.prompt
        // Status is not part of the agent-writable surface: create always starts a draft,
        // and update keeps whatever status the Host/user flow already established. This
        // prevents passing status="confirmed"/"dispatched" through the tool.
        merged.status = action === 'create' ? 'draft' : (previous?.status ?? 'draft')
        const blueprint = action === 'update'
          ? mergeBlueprintForUpdate(previous, merged, { sessionId: file.sessionId })
          : normalizeBlueprint(merged, undefined, { sessionId: file.sessionId })
        await archive(file, previous, 'agent')
        await writeBlueprintFile(file.absolute, blueprint)
        if (previous === undefined) await archive(file, blueprint, 'agent', 'initial')
        return {
          ok: true,
          path: file.relative,
          absolutePath: file.absolute,
          digest: blueprintDigest(blueprint),
          message: `已保存 ${file.relative}\n\n${summaryText(blueprint, file.relative)}`,
        }
      }

      if (action === 'confirm' || action === 'dispatch') {
        // Deliberately stateless and source-rejecting: the agent must not be able to mark
        // its own blueprint as confirmed/dispatched. Only the user-driven command flow does.
        throw new Error(
          `工具 action="${action}" 已被禁用：确认与分派必须由用户在「蓝图」面板完成，Host 会校验一次性确认令牌。请让用户点击「确认并分派」。`,
        )
      }

      throw new Error(`不支持的 action：${action}`)
    },
  }

  ctx.effect(() => ctx.tools.register(definition))

  const commands = ctx.get('commands')
  if (commands !== undefined) {
    ctx.effect(() =>
      commands.register({
        name: 'blueprint',
        description: '蓝图工坊：保存、归档、对比、恢复、导出、记录分层验收和自检当前会话的工程蓝图（界面调用）。',
        recordInput: false,
        input: { hint: 'save <base64-json> [--draft] | verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence] | confirm | dispatch <token> | versions | diff <from> <to> | restore <id> | snapshot <label> | path | get | export <md|html> [all|<层>] | check | cancel <childSessionId>' },
        async handler(invocation) {
          const rawInput = String(invocation.rawInput ?? '').trim()
          const [sub, ...rest] = rawInput.split(/\s+/)
          if (sub === 'save') {
            const { encoded, draft, base, force } = parseBlueprintSaveInput(rest.join(' '))
            if (encoded === '') return { kind: 'error', text: '缺少蓝图数据。' }
            let parsed
            try {
              parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
            } catch {
              return { kind: 'error', text: '蓝图数据不是合法的 base64 JSON。' }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            const previous = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const diskUpdatedAt = previous?.updatedAt
            if (!force && base !== undefined && previous !== undefined && Number(base) !== Number(diskUpdatedAt)) {
              return {
                kind: 'success',
                text: JSON.stringify({
                  ok: false,
                  code: 'conflict',
                  updatedAt: diskUpdatedAt,
                  path: file.relative,
                  message: '蓝图已被其他写入更新，请重新加载或选择保留我的修改。',
                }),
              }
            }
            if (force && previous !== undefined) {
              await archive(file, previous, 'ui', 'conflict: keep mine')
            }
            const saved = await saveBlueprintFromCommand({
              cwd: file.cwd,
              sessionId: file.sessionId,
              input: parsed,
              previous,
              draft,
              source: 'ui',
            })
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                mode: saved.mode,
                archived: saved.archived,
                skipped: saved.skipped,
                archiveErrors: saved.archiveErrors,
                updatedAt: saved.blueprint.updatedAt,
                path: file.relative,
              }),
            }
          }
          if (sub === 'verify') {
            const moduleId = String(rest[0] ?? '').trim()
            const role = String(rest[1] ?? '').trim()
            const status = String(rest[2] ?? '').trim()
            const evidence = rest.slice(3).join(' ').trim()
            const usage = '用法：/blueprint verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence]'
            if (moduleId === '' || role === '' || status === '') {
              return { kind: 'error', text: `参数不足。${usage}` }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法记录验证。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            // Only this user-driven command mutates verification. The agent tool's
            // update path preserves the previous value (see mergeBlueprintForUpdate).
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            const result = recordModuleVerification(blueprint, { moduleId, role, status, evidence })
            if (!result.ok) return { kind: 'error', text: result.message }
            blueprint.updatedAt = Date.now()
            await archive(file, previous, 'ui', `verify ${result.moduleId} ${result.role} ${result.status}`)
            await writeBlueprintFile(file.absolute, blueprint)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                moduleId: result.moduleId,
                role: result.role,
                status: result.status,
                moduleStatus: result.moduleStatus,
                evidence: result.evidence,
                at: result.at,
                verification: result.verification,
                path: file.relative,
              }),
            }
          }
          if (sub === 'confirm') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图，无法确认。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            if (previous.status === 'dispatched') {
              return { kind: 'error', text: '蓝图已分派，不能再次确认；如需重新分派请先创建新蓝图或恢复版本。' }
            }
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            blueprint.status = 'confirmed'
            blueprint.updatedAt = Date.now()
            const hash = blueprintContentHash(blueprint)
            await archive(file, previous, 'ui', 'before confirm')
            await writeBlueprintFile(file.absolute, blueprint)
            const issued = confirmTokens.issue(file.sessionId, hash)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                status: blueprint.status,
                token: issued.token,
                hash: issued.hash,
                createdAt: issued.createdAt,
                expiresAt: issued.expiresAt,
                path: file.relative,
              }),
            }
          }
          if (sub === 'dispatch') {
            const token = String(rest[0] ?? '').trim()
            if (token === '') {
              return {
                kind: 'error',
                text: '缺少确认令牌。用法：/blueprint dispatch <token>（请先由用户执行 /blueprint confirm）。',
              }
            }
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图，无法分派。' }
            const previous = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const blueprint = normalizeBlueprint(previous, undefined, { sessionId: file.sessionId })
            const checked = verifyBlueprintToken(confirmTokens, file.sessionId, token, blueprint)
            if (!checked.ok) return { kind: 'error', text: checked.message }
            const consumed = confirmTokens.consume(file.sessionId, token)
            if (!consumed.ok) return { kind: 'error', text: consumed.message }
            blueprint.status = 'dispatched'
            blueprint.updatedAt = Date.now()
            await archive(file, previous, 'ui', 'before dispatch')
            await writeBlueprintFile(file.absolute, blueprint)
            return {
              kind: 'success',
              text: JSON.stringify({
                ok: true,
                status: blueprint.status,
                path: file.relative,
                modules: blueprint.modules,
                summary: summaryText(blueprint, file.relative),
              }),
            }
          }
          if (sub === 'snapshot') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'error', text: '还没有工程蓝图。' }
            const current = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            const label = decodeSnapshotLabel(rest.join(' '))
            await archive(file, current, 'manual', label)
            return { kind: 'success', text: '当前蓝图已归档。' }
          }
          if (sub === 'versions') {
            const file = await fileOf(invocation.agent)
            const index = await readVersionsIndex(file.cwd, file.sessionId)
            const raw = await readBlueprintFile(file.absolute)
            const current = raw === undefined ? undefined : normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            return {
              kind: 'success',
              text: JSON.stringify({
                current: current === undefined ? undefined : {
                  title: current.title,
                  status: current.status,
                  updatedAt: current.updatedAt,
                  counts: blueprintDigest(current),
                },
                versions: index.versions,
                index: blueprintVersionsIndexRelativePath(file.sessionId),
              }),
            }
          }
          if (sub === 'diff') {
            const file = await fileOf(invocation.agent)
            const [fromId, toId] = rest
            const currentRaw = await readBlueprintFile(file.absolute)
            const resolve = async id => {
              if (id === undefined || id === 'current') {
                return currentRaw === undefined ? undefined : normalizeBlueprint(currentRaw, undefined, { sessionId: file.sessionId })
              }
              const version = await readBlueprintVersion(file.cwd, file.sessionId, id)
              return version === undefined ? undefined : normalizeBlueprint(version, undefined, { sessionId: file.sessionId })
            }
            const before = await resolve(fromId)
            const after = await resolve(toId)
            if (before === undefined || after === undefined) return { kind: 'error', text: '版本不存在。' }
            return { kind: 'success', text: JSON.stringify(semanticDiff(before, after)) }
          }
          if (sub === 'restore') {
            const file = await fileOf(invocation.agent)
            const id = rest[0]
            const target = id === undefined ? undefined : await readBlueprintVersion(file.cwd, file.sessionId, id)
            if (target === undefined) return { kind: 'error', text: '版本不存在。' }
            const currentRaw = await readBlueprintFile(file.absolute)
            const current = currentRaw === undefined ? undefined : normalizeBlueprint(currentRaw, undefined, { sessionId: file.sessionId })
            if (current !== undefined) await archive(file, current, 'ui', `before restore ${id}`)
            const restored = normalizeBlueprint(target, current, { sessionId: file.sessionId })
            restored.updatedAt = Date.now()
            await writeBlueprintFile(file.absolute, restored)
            return { kind: 'success', text: `已恢复到 ${id}：${file.relative}` }
          }
          if (sub === 'path') {
            const file = await fileOf(invocation.agent)
            return { kind: 'success', text: file.relative }
          }
          if (sub === 'get') {
            const { file, raw } = await readCurrent(invocation.agent)
            if (raw === undefined) return { kind: 'success', text: '当前会话还没有工程蓝图。' }
            return { kind: 'success', text: JSON.stringify(raw) }
          }
          if (sub === 'export') {
            const format = String(rest[0] ?? '').trim().toLowerCase()
            if (format !== 'md' && format !== 'html') {
              return {
                kind: 'error',
                text: '用法：/blueprint export <md|html> [all|层 letter]，例如 /blueprint export md A。',
              }
            }
            const scope = parseExportScope(rest.slice(1).join(' '))
            if (!scope.ok) return { kind: 'error', text: scope.message }
            let file
            let raw
            try {
              const current = await readCurrent(invocation.agent)
              file = current.file
              raw = current.raw
            } catch (error) {
              return { kind: 'error', text: `读取蓝图失败：${errorMessage(error)}` }
            }
            if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法导出。' }
            let blueprint
            try {
              blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            } catch (error) {
              return { kind: 'error', text: `蓝图数据无法规范化，导出失败：${errorMessage(error)}` }
            }
            const layerIds = blueprintLayerIds(blueprint)
            if (!scope.global && !layerIds.includes(scope.layerId)) {
              return {
                kind: 'error',
                text: `层 ${scope.layerId} 不存在，无法导出。可用层：${layerIds.join('、') || 'A'}。`,
              }
            }
            const options = scope.global ? { global: true } : { layerId: scope.layerId }
            try {
              const text = format === 'md'
                ? exportMarkdown(blueprint, options)
                : exportHtml(blueprint, options)
              return { kind: 'success', text }
            } catch (error) {
              if (error?.code === 'export-too-large') return { kind: 'error', text: error.message }
              const label = format === 'md' ? 'Markdown' : 'HTML'
              return { kind: 'error', text: `${label} 导出失败：${errorMessage(error)}` }
            }
          }
          if (sub === 'check') {
            if (rest.length > 0) return { kind: 'error', text: '用法：/blueprint check（不需要参数）。' }
            let blueprint
            try {
              const { file, raw } = await readCurrent(invocation.agent)
              if (raw === undefined) return { kind: 'error', text: '当前会话还没有工程蓝图，无法自检。' }
              blueprint = normalizeBlueprint(raw, undefined, { sessionId: file.sessionId })
            } catch (error) {
              return { kind: 'error', text: `蓝图自检失败：无法读取或规范化蓝图（${errorMessage(error)}）。` }
            }
            let result
            try {
              const analyzed = analyzeBlueprint(blueprint)
              const hasFlowchart = (blueprint.diagrams ?? []).some(diagram => diagram.type === 'flowchart' || diagram.key === 'flowchart' || String(diagram.key).endsWith(':flowchart'))
              const planned = hasFlowchart ? analyzePlan(blueprint) : { issues: [], coverage: null }
              const issues = [...analyzed.issues, ...planned.issues]
              const summary = { error: 0, warn: 0, info: 0 }
              for (const issue of issues) {
                if (summary[issue.severity] !== undefined) summary[issue.severity] += 1
              }
              result = {
                issues,
                coverage: { ...coverageMatrix(blueprint), plan: planned.coverage },
                summary,
                rules: [...CHECK_RULES, ...PLAN_CHECK_RULES],
              }
            } catch (error) {
              return { kind: 'error', text: `蓝图自检失败：${errorMessage(error)}` }
            }
            const limited = truncateCheckIssues(result.issues)
            return {
              kind: 'success',
              text: JSON.stringify({
                issues: limited.issues,
                coverage: result.coverage,
                summary: result.summary,
                rules: result.rules,
                truncated: limited.truncated,
              }),
            }
          }
          if (sub === 'cancel') {
            const childSessionId = String(rest[0] ?? '').trim()
            if (childSessionId === '') {
              return { kind: 'error', text: '缺少子会话 ID。用法：/blueprint cancel <childSessionId>（Missing child session id.）' }
            }
            let subagents
            try {
              subagents = ctx.get('subagents')
            } catch {
              subagents = undefined
            }
            if (subagents === undefined || typeof subagents.interruptByParent !== 'function') {
              return { kind: 'error', text: '当前环境没有可用的子代理服务，无法取消。Subagent service unavailable.' }
            }
            const parentSessionId = invocation.agent?.session?.header?.id ?? invocation.agent?.id
            if (typeof parentSessionId !== 'string' || parentSessionId === '') {
              return { kind: 'error', text: '无法确定当前父会话 ID，已跳过取消。Unknown parent session.' }
            }
            try {
              const receipt = await subagents.interruptByParent(childSessionId, parentSessionId, 'continuable')
              if (receipt !== undefined && receipt !== null && receipt.accepted === false) {
                return { kind: 'error', text: `取消子代理未被接受：${childSessionId}。Cancel was not accepted.` }
              }
              return { kind: 'success', text: `已向子代理 ${childSessionId} 发送取消信号。Subagent cancel requested.` }
            } catch (error) {
              return { kind: 'error', text: `取消子代理失败：${String(error?.message ?? error)}` }
            }
          }
          return { kind: 'error', text: '可用：/blueprint save | verify <moduleId> <tests|reviewer|human> <passed|failed|pending> [evidence] | confirm | dispatch <token> | versions | diff | restore | snapshot | path | get | export <md|html> [all|<层>] | check | cancel' }
        },
      }),
    )
  }

  if (config.promptSection !== false) {
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt !== undefined) {
      ctx.effect(() =>
        systemPrompt.section({
          name: 'blueprint-studio',
          order: 42,
          text: `## 工程蓝图工作流（Blueprint Studio）

当用户提出需要多步骤实现、跨文件改动或新功能的任务时，在写代码之前：
1. 调用 blueprint(action="create") 生成结构化蓝图：7 个需求栏目、根层 A（总览）与按需子层（layers）、usecase / dfd / module 三张基础图，按需补 sequence / er / c4 / class / state，以及可独立分派的 modules。把原始需求写进 prompt。
2. 分层数据模型：A 是根层，子层 letter 唯一且 id=letter，用 parentModuleId 指向父层模块；模块用稳定的 id、layerId、code（如 A1/B1）和 parentId，需求条目用 uid（sectionKey:id）和全局递增 code（R1/R2…）。只有根层 A 自动保留 8 张图；子层图必须显式给出，key 为 "<letter>:<type>"，没有空图占位。
3. 用两三句话向用户说明方案，并请他在「蓝图」面板中检查、增删改；在用户明确确认之前，不要开始实现，也不要调用文件编辑工具。确认与分派由用户在面板发起，Host 会校验一次性令牌；不要调用 blueprint(action="confirm") 或 blueprint(action="dispatch")，它们会被拒绝。
4. 用户确认后，调用 blueprint(action="get") 读取最新蓝图（用户可能手工改过），再按 modules 为每个模块启动一个子代理：有依赖的按依赖顺序，无依赖的并行。子代理提示词必须包含模块范围、层路径、依赖、验收标准，以及相关图表中的接口/数据流。
5. 启动子代理后，把子代理 sessionId 写回对应 module 的 subagentSessionId 字段，并用 module.status 标记 running；每个子代理完成后不要自行宣称模块 done：tests / reviewer / human 三层验证只能由用户执行 /blueprint verify 记录，任一层 failed 会自动置为 needs-rework，三层全部 passed 才会置为 done。
6. 全部完成后汇总改动、验证结果与剩余风险。用户可以在「版本」面板对比每次保存并恢复旧版本。

简单问答、解释概念、单行小修不需要蓝图，直接回答或修改即可。

可用节点类型：${NODE_TYPES.join('、')}。固定栏目：${SECTION_DEFS.map(item => item.key).join('、')}。固定图解：${DIAGRAM_DEFS.map(item => item.key).join('、')}。
蓝图由插件自动保存到工作区并自动归档历史版本；不要用 write/edit 手工改蓝图文件。

${PLAN_MODE_PROMPT}

## 复杂任务分层要求

在复杂任务中不要只画 A 层：

- 复杂度触发（满足任一）：模块数 ≥6、跨 3 个以上领域、存在多个适配器/外部系统、预计需要 2 个以上子代理并行。
- 触发后必须设计至少 2 层：根层 A + 一个或多个子层 B/C；子层用 parentModuleId 指向根层的父模块。
- 根层 A 只保留总览模块图和必要的用例概览；具体接口、数据流、时序、类/状态放到对应子层。
- 每个子层必须显式提供 diagrams，至少 letter:module；涉及接口时补 letter:dfd 或 letter:sequence。只写 layers/modules 而不写子层图，视为未完成。
- 子层模块 code 使用 B1/C1；父模块只负责汇总，叶子模块才分派。
- 简单任务确实不需要子层时，在 summary/risks 中写明原因，不要静默只做 A 层。`,
        }),
      )
    }
  }
}

