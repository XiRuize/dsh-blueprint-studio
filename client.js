window.__ModuleLoader__.load({
  id: 'dsh-blueprint-studio',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useMemo, useSyncExternalStore } = React

    const NS = 'blueprint'
    const EN = {
      open: 'Blueprint', title: 'Engineering blueprint', subtitle: 'Draw the system before you build it',
      emptyTitle: 'Turn a request into an engineering blueprint',
      emptyHint: 'Describe the task. The agent fills in requirements, use cases, data flow and modules; you refine them, then dispatch subagents per module.',
      emptyPlaceholder: 'e.g. Build a plugin marketplace for DSH with search, version pinning and one-click install…',
      generate: 'Generate blueprint', regenerate: 'Regenerate', save: 'Save', saved: 'Saved', unsaved: 'Unsaved changes',
      saving: 'Saving…', confirmDispatch: 'Confirm & dispatch', dispatching: 'Dispatching…', expand: 'Expand with AI',
      expandSection: 'Expand this section with AI', expandDiagram: 'Expand this diagram with AI', addItem: 'Add item',
      addSection: 'Add section', delete: 'Delete', requirements: 'Requirements', inspector: 'Inspector', modules: 'Modules',
      usecase: 'Use case', dfd: 'Data flow', module: 'Modules', select: 'Select', connect: 'Connect', autoLayout: 'Auto layout',
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Reset view', nodeLabel: 'Label', nodeType: 'Type', edgeLabel: 'Label',
      deleteNode: 'Delete node', deleteEdge: 'Delete edge', addNode: 'Add node', noSelection: 'Select a node or edge to edit it.',
      noModules: 'No modules yet. Ask the agent to split the work into modules.', moduleStatus: 'Status', dependsOn: 'Depends on',
      export: 'Export', exportJSON: 'Blueprint JSON', exportMermaid: 'Mermaid', exportSVG: 'SVG image', close: 'Close',
      statusDraft: 'Draft', statusConfirmed: 'Confirmed', statusDispatched: 'Dispatched',
      generating: 'The agent is drafting the blueprint…', expanding: 'The agent is expanding the blueprint…',
      waiting: 'Waiting for the agent…', sent: 'Instruction sent to the agent', savedToast: 'Blueprint saved',
      loadFailed: 'Could not load the blueprint', saveFailed: 'Could not save the blueprint',
      promptSent: 'The agent will update the blueprint; this view refreshes automatically.',
      manualStart: 'Start manually', taskPrompt: 'Task description', summary: 'Summary', prompt: 'Original request',
      lastSaved: 'Updated', nodeCount: '{count} nodes', emptyDiagram: 'This diagram is empty. Add a node or ask the agent to expand it.',
      connectHint: 'Click a source node, then a target node.', task: 'Task', notes: 'Notes', confirmHint: 'One subagent per module, dependencies first.',
      canvasHint: 'Drag to pan · wheel to zoom · drag nodes to move', addSectionPlaceholder: 'Section name',
      actor: 'Actor', usecaseNode: 'Use case', system: 'System boundary', entity: 'External entity', process: 'Process',
      store: 'Data store', moduleNode: 'Module', external: 'External system', noBlueprint: 'No blueprint yet.',
      summaryPlaceholder: 'Two or three sentences on the chosen approach…', titlePlaceholder: 'Blueprint title',
      sectionCount: '{count} items', saveHint: 'Ctrl/Cmd+S', dispatchBlocked: 'Add at least one module first.',
      editedByYou: 'Edited by you', aiUpdated: 'The agent updated this blueprint', reload: 'Reload',
      zoom: 'Zoom', fitView: 'Fit', allDiagrams: 'All diagrams', edgeKind: 'Kind', addEdge: 'Add edge',
      statusPending: 'Pending', statusRunning: 'Running', statusDone: 'Done', statusBlocked: 'Blocked',
      sequence: 'Sequence', er: 'ER', c4: 'C4', participant: 'Participant', relationship: 'Relationship',
      person: 'Person', container: 'Container', component: 'Component', database: 'Database',
      message: 'Message', cardinality: 'Cardinality', order: 'Order', technology: 'Technology',
      fields: 'Fields', addField: 'Add field', fieldName: 'Name', fieldType: 'Type', primaryKey: 'PK', nullable: 'Nullable',
      versions: 'Versions', board: 'Board', snapshot: 'Snapshot', compare: 'Compare', restore: 'Restore', current: 'Current',
      diffTitle: 'Version diff', noVersions: 'No archived versions yet. Save once to create the first snapshot.',
      added: 'added', removed: 'removed', changed: 'changed', selectTwo: 'Pick two versions to compare.',
      closeDiff: 'Back', versionRestored: 'Version restored', snapshotSaved: 'Snapshot saved', versionLoadFailed: 'Could not load versions',
      children: 'Subagents', noChildren: 'No child subagents yet.', running: 'running', idle: 'idle', refresh: 'Refresh',
      openSession: 'Open session', copyId: 'Copy session id', importDrawio: 'Import draw.io', importFailed: 'Import failed',
      importReplace: 'Replace current diagram? Choose Cancel to append instead.', exportDrawio: 'draw.io XML',
      importTitle: 'Import draw.io', importHint: 'Paste draw.io XML or choose a .drawio/.xml file. Vertices and edges are mapped to this diagram.',
      importPlaceholder: '<mxfile>…</mxfile>', replaceDiagram: 'Replace current diagram', appendDiagram: 'Append to current diagram', importAction: 'Import',
      diffBase: 'From', diffTarget: 'To', diffEmpty: 'No semantic changes between these versions.',
      fieldsEmpty: 'No fields yet.', addEdge: 'Add edge', edgeKind: 'Kind', saveSnapshotHint: 'Archive the current blueprint as a version',
      boardHint: 'Child sessions of this conversation, refreshed every 5 seconds.', moduleOf: 'Module', versionAt: 'Time', versionBy: 'Source',
      textChanged: 'changed', sectionTitleChanged: 'Title changed', diagramMissing: 'Diagram only exists on one side',
      diagrams: 'Diagrams', undo: 'Undo', redo: 'Redo', undoDone: 'Undid the last blueprint change', redoDone: 'Redid the blueprint change',
      backToStart: 'Welcome', continueEditing: 'Continue editing current blueprint', historyHint: 'Ctrl+Z / Ctrl+Y',
      templatesTitle: 'Start from a template', templatesHint: 'One click creates a full draft — no AI call needed.',
      tplWeb: 'Web application', tplWebDesc: 'Frontend, backend, database and auth',
      tplCli: 'CLI tool', tplCliDesc: 'Command parsing, execution, config and output',
      tplPipeline: 'Data pipeline', tplPipelineDesc: 'Ingest, clean, store and schedule',
      tplPlugin: 'DSH plugin', tplPluginDesc: 'Host tool, client panel, storage and tests',
      templateApplied: 'Template applied', templateFailed: 'Could not apply the template',
    }
    const ZH = {
      open: '蓝图', title: '工程蓝图', subtitle: '先把系统画清楚，再开始写代码',
      emptyTitle: '把一句需求变成工程蓝图',
      emptyHint: '描述任务，AI 会补齐需求栏目、用例图、数据流图与模块拆分；你可以增删改，再一键按模块分派子代理。',
      emptyPlaceholder: '例如：为 DSH 做一个插件市场，支持搜索、版本锁定与一键安装……',
      generate: '生成蓝图', regenerate: '重新生成', save: '保存', saved: '已保存', unsaved: '有未保存修改',
      saving: '保存中…', confirmDispatch: '确认并分派', dispatching: '分派中…', expand: '一键扩充',
      expandSection: '用 AI 扩充本栏', expandDiagram: '用 AI 扩充本图', addItem: '新增条目',
      addSection: '新增栏目', delete: '删除', requirements: '需求栏目', inspector: '检查器', modules: '模块',
      usecase: '用例图', dfd: '数据流图', module: '模块图', select: '选择', connect: '连线', autoLayout: '自动布局',
      zoomIn: '放大', zoomOut: '缩小', fit: '重置视图', nodeLabel: '名称', nodeType: '类型', edgeLabel: '标签',
      deleteNode: '删除节点', deleteEdge: '删除连线', addNode: '新增节点', noSelection: '选中一个节点或连线后即可编辑。',
      noModules: '还没有模块。可以让 AI 把工作拆成可独立分派的模块。', moduleStatus: '状态', dependsOn: '依赖',
      export: '导出', exportJSON: '蓝图 JSON', exportMermaid: 'Mermaid', exportSVG: 'SVG 图片', close: '关闭',
      statusDraft: '草稿', statusConfirmed: '已确认', statusDispatched: '已分派',
      generating: 'AI 正在起草蓝图…', expanding: 'AI 正在扩充蓝图…',
      waiting: '等待 AI 更新…', sent: '指令已发送给 AI', savedToast: '蓝图已保存',
      loadFailed: '蓝图加载失败', saveFailed: '蓝图保存失败',
      promptSent: 'AI 将更新蓝图，此视图会自动刷新。',
      manualStart: '手动开始', taskPrompt: '任务描述', summary: '摘要', prompt: '原始需求',
      lastSaved: '更新于', nodeCount: '{count} 个节点', emptyDiagram: '这张图还是空的。可以新增节点，或让 AI 扩充。',
      connectHint: '先点起点节点，再点终点节点。', task: '任务', notes: '备注', confirmHint: '每个模块一个子代理，有依赖的先做。',
      canvasHint: '拖拽空白平移 · 滚轮缩放 · 拖动节点移动', addSectionPlaceholder: '栏目名称',
      actor: '角色', usecaseNode: '用例', system: '系统边界', entity: '外部实体', process: '处理',
      store: '数据存储', moduleNode: '模块', external: '外部系统', noBlueprint: '还没有蓝图。',
      summaryPlaceholder: '用两三句话写清方案取舍……', titlePlaceholder: '蓝图标题',
      sectionCount: '{count} 条', saveHint: 'Ctrl/Cmd+S', dispatchBlocked: '至少先拆分一个模块。',
      editedByYou: '已手工修改', aiUpdated: 'AI 已更新这份蓝图', reload: '重新加载',
      zoom: '缩放', fitView: '适应', allDiagrams: '全部图解', edgeKind: '类型', addEdge: '新增连线',
      statusPending: '待处理', statusRunning: '进行中', statusDone: '已完成', statusBlocked: '受阻',
      sequence: '时序图', er: 'ER 图', c4: 'C4 图', participant: '参与者', relationship: '关系',
      person: '角色', container: '容器', component: '组件', database: '数据库',
      message: '消息', cardinality: '基数', order: '顺序', technology: '技术栈',
      fields: '字段', addField: '新增字段', fieldName: '字段名', fieldType: '类型', primaryKey: '主键', nullable: '可空',
      versions: '版本', board: '看板', snapshot: '保存快照', compare: '对比', restore: '恢复', current: '当前',
      diffTitle: '版本对比', noVersions: '还没有历史版本。保存一次就会生成第一份快照。',
      added: '新增', removed: '删除', changed: '修改', selectTwo: '选择两个版本进行对比。',
      closeDiff: '返回', versionRestored: '已恢复版本', snapshotSaved: '快照已保存', versionLoadFailed: '版本加载失败',
      children: '子代理', noChildren: '还没有子代理。', running: '运行中', idle: '空闲', refresh: '刷新',
      openSession: '打开会话', copyId: '复制会话 ID', importDrawio: '导入 draw.io', importFailed: '导入失败',
      importReplace: '替换当前图？选择“取消”则追加。', exportDrawio: 'draw.io XML',
      importTitle: '导入 draw.io', importHint: '粘贴 draw.io XML，或选择 .drawio/.xml 文件；顶点和连线会映射到当前图。',
      importPlaceholder: '<mxfile>…</mxfile>', replaceDiagram: '替换当前图', appendDiagram: '追加到当前图', importAction: '导入',
      diffBase: '基准', diffTarget: '对比', diffEmpty: '这两个版本之间没有语义变化。',
      fieldsEmpty: '还没有字段。', addEdge: '新增连线', edgeKind: '类型', saveSnapshotHint: '把当前蓝图归档为版本',
      boardHint: '当前会话的子代理，每 5 秒刷新。', moduleOf: '模块', versionAt: '时间', versionBy: '来源',
      textChanged: '已修改', sectionTitleChanged: '标题已修改', diagramMissing: '该图只存在于一侧',
      diagrams: '图解', undo: '撤销', redo: '重做', undoDone: '已撤销上一步蓝图修改', redoDone: '已重做蓝图修改',
      backToStart: '初始页', continueEditing: '继续编辑当前蓝图', historyHint: 'Ctrl+Z / Ctrl+Y',
      templatesTitle: '从模板开始', templatesHint: '一键生成完整草稿，不调用 AI。',
      tplWeb: 'Web 应用', tplWebDesc: '前端、后端、数据库与鉴权',
      tplCli: 'CLI 工具', tplCliDesc: '命令解析、执行、配置与输出',
      tplPipeline: '数据管道', tplPipelineDesc: '采集、清洗、存储与调度',
      tplPlugin: 'DSH 插件', tplPluginDesc: 'Host 工具、Client 面板、存储与测试',
      templateApplied: '已应用模板', templateFailed: '模板应用失败',
    }

    let dict = ZH
    let ctxRef = null
    let translate = key => (ZH[key] ?? EN[key] ?? key)

    function currentLocaleId() {
      try {
        const snapshot = ctxRef?.locale?.getLocale?.()
        return String(snapshot?.id ?? snapshot?.locale ?? snapshot ?? 'en')
      } catch {
        return 'en'
      }
    }

    function t(key, params) {
      let value
      try {
        value = translate(key)
      } catch {
        value = undefined
      }
      if (typeof value !== 'string') value = dict[key] ?? EN[key] ?? key
      if (params === undefined) return value
      return value.replace(/\{(\w+)\}/g, (whole, name) => (params[name] === undefined ? whole : String(params[name])))
    }

    let state = {
      open: false,
      sessionId: null,
      path: null,
      bp: null,
      loading: false,
      missing: false,
      dirty: false,
      saving: false,
      aiBusy: null,
      error: null,
      toast: null,
      tab: 'usecase',
      selected: null,
      mode: 'select',
      connectFrom: null,
      lastText: '',
      lastLoaded: 0,
      remoteUpdated: false,
      panel: 'inspector',
      versions: [],
      versionsLoaded: false,
      versionsLoading: false,
      diff: null,
      children: [],
      childrenLoaded: false,
      childrenLoading: false,
      importOpen: false,
      landing: false,
      canUndo: false,
      canRedo: false,
      historyVersion: 0,
    }
    const listeners = new Set()
    function snapshot() { return state }
    function set(patch) {
      state = Object.assign({}, state, patch)
      for (const listener of listeners) listener()
    }
    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }
    function useStore() {
      return useSyncExternalStore(subscribe, snapshot, snapshot)
    }
    let toastTimer = null
    function toast(message, tone) {
      set({ toast: { message, tone: tone ?? 'info' } })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 3200)
    }

    function remote() {
      return ctxRef?.get?.('remote')
    }

    function safeSession(sessionId) {
      return String(sessionId ?? 'session').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'session'
    }
    function pathFor(sessionId) {
      return `.dsh/blueprints/${safeSession(sessionId)}.json`
    }
    function uuid() {
      try { return crypto.randomUUID() } catch { return `bp-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    }
    function base64(text) {
      const bytes = new TextEncoder().encode(text)
      let binary = ''
      const chunk = 0x8000
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk))
      }
      return btoa(binary)
    }
    function download(name, text, type) {
      const blob = new Blob([text], { type: type ?? 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    async function readTextAt(sessionId, relativePath) {
      const api = remote()
      if (api === undefined) throw new Error('Remote API unavailable')
      let offset = 1
      let text = ''
      for (let page = 0; page < 12; page += 1) {
        const result = await api.workspaceFiles.read(sessionId, relativePath, { offset, limit: 4000 }, undefined)
        if (!result.ok) {
          const code = String(result.error?.code ?? '')
          if (/not.?found|enoent|missing/i.test(code) || /not.?found|enoent/i.test(String(result.error?.message ?? ''))) return null
          throw new Error(result.error?.message ?? code ?? 'read failed')
        }
        const value = result.value
        text += value.text ?? ''
        if (value.eof !== false) break
        offset += value.lines ?? 0
        if ((value.lines ?? 0) === 0) break
      }
      return text
    }

    async function readBlueprintText(sessionId) {
      return await readTextAt(sessionId, pathFor(sessionId))
    }

    function versionsIndexPath(sessionId) {
      return `.dsh/blueprints/${safeSession(sessionId)}.versions/index.json`
    }

    async function loadVersions() {
      const sessionId = state.sessionId
      if (!sessionId) return
      set({ versionsLoading: true })
      try {
        const text = await readTextAt(sessionId, versionsIndexPath(sessionId))
        const versions = text === null ? [] : (JSON.parse(text).versions ?? [])
        set({ versions, versionsLoaded: true, versionsLoading: false })
      } catch (error) {
        set({ versions: [], versionsLoaded: true, versionsLoading: false })
        try { console.warn('blueprint versions', error) } catch {}
      }
    }

    async function loadChildren() {
      const sessionId = state.sessionId
      const api = remote()
      if (!sessionId || api === undefined) return
      set({ childrenLoading: true })
      try {
        const result = await api.session.list({})
        if (!result.ok) throw new Error(result.error?.message ?? 'list failed')
        const items = result.value?.items ?? []
        const children = items.filter(item => item.parentSessionId === sessionId && item.origin === 'subagent')
        set({ children, childrenLoaded: true, childrenLoading: false })
      } catch (error) {
        set({ childrenLoaded: true, childrenLoading: false })
        try { console.warn('blueprint children', error) } catch {}
      }
    }

    async function loadBlueprint({ initial = false } = {}) {
      const sessionId = state.sessionId
      if (!sessionId) return
      try {
        const text = await readBlueprintText(sessionId)
        if (text === null || text.trim() === '') {
          resetHistory()
          set({
            loading: false,
            missing: true,
            bp: initial ? null : state.bp,
            lastText: '',
            landing: initial ? true : state.landing,
            canUndo: false,
            canRedo: false,
          })
          return
        }
        if (text === state.lastText) {
          set({ loading: false })
          return
        }
        const parsed = JSON.parse(text)
        ensureLayout(parsed)
        if (state.dirty && !initial) {
          set({ loading: false, remoteUpdated: true, lastText: text })
          return
        }
        const nextFingerprint = JSON.stringify({ ...parsed, updatedAt: 0 })
        const currentFingerprint = state.bp === null ? null : JSON.stringify({ ...state.bp, updatedAt: 0 })
        if (currentFingerprint === nextFingerprint) {
          set({ loading: false, lastText: text, missing: false, landing: false })
          return
        }
        resetHistory()
        set({
          bp: parsed,
          loading: false,
          missing: false,
          dirty: false,
          lastText: text,
          lastLoaded: Date.now(),
          remoteUpdated: false,
          error: null,
          aiBusy: null,
          landing: false,
          canUndo: false,
          canRedo: false,
          tab: parsed.diagrams.some(diagram => diagram.key === state.tab) ? state.tab : parsed.diagrams[0]?.key ?? 'usecase',
        })
      } catch (error) {
        set({ loading: false, error: String(error?.message ?? error) })
      }
    }

    async function saveBlueprint({ silent = true } = {}) {
      if (state.bp === null || state.sessionId === null) return false
      set({ saving: true })
      try {
        const api = remote()
        const line = `/blueprint save ${base64(JSON.stringify(state.bp))}`
        const result = await api.commands.execute(state.sessionId, line, [])
        if (!result.ok) throw new Error(result.error?.message ?? 'command failed')
        const outcome = result.value?.result
        if (outcome?.kind === 'error') throw new Error(outcome.text)
        set({ saving: false, dirty: false, lastLoaded: Date.now() })
        if (!silent) toast(t('savedToast'), 'success')
        loadVersions()
        return true
      } catch (error) {
        set({ saving: false, error: String(error?.message ?? error) })
        toast(`${t('saveFailed')}: ${String(error?.message ?? error)}`, 'error')
        return false
      }
    }

    async function runBlueprintCommand(line) {
      const api = remote()
      const result = await api.commands.execute(state.sessionId, `/blueprint ${line}`, [])
      if (!result.ok) throw new Error(result.error?.message ?? 'command failed')
      const outcome = result.value?.result
      if (outcome?.kind === 'error') throw new Error(outcome.text)
      return outcome?.text ?? ''
    }

    async function compareVersions(from, to) {
      try {
        const text = await runBlueprintCommand(`diff ${from} ${to}`)
        set({ diff: { ...JSON.parse(text), from, to }, panel: 'versions' })
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }

    async function restoreVersion(id) {
      if (!window.confirm(`${t('restore')} ${id}?`)) return
      try {
        if (state.dirty) {
          const ok = await saveBlueprint({ silent: true })
          if (!ok) return
        }
        await runBlueprintCommand(`restore ${id}`)
        await loadBlueprint({ initial: true })
        await loadVersions()
        set({ diff: null })
        toast(t('versionRestored'), 'success')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }

    async function snapshotVersion() {
      try {
        if (state.dirty) {
          const ok = await saveBlueprint({ silent: true })
          if (!ok) return
        }
        const label = encodeURIComponent(`${t('snapshot')} ${new Date().toLocaleString()}`)
        await runBlueprintCommand(`snapshot ${label}`)
        await loadVersions()
        toast(t('snapshotSaved'), 'success')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }

    async function sendPrompt(text, kind) {
      const api = remote()
      if (state.bp !== null && state.dirty) {
        const ok = await saveBlueprint({ silent: true })
        if (ok !== true) return
      }
      const result = await api.session.prompt({
        requestId: uuid(),
        sessionId: state.sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }, undefined)
      if (!result.ok) throw new Error(result.error?.message ?? 'prompt failed')
      set({ aiBusy: kind ?? 'waiting', toast: { message: t('sent'), tone: 'success' } })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => set({ toast: null }), 3200)
    }

    function generatePrompt(task) {
      return `请为下面的任务创建工程蓝图（先不要写代码）：\n\n${task}\n\n请调用 blueprint 工具 action="create" 保存蓝图。要求：\n1. sections 覆盖 goals、actors、functional、nonfunctional、constraints、acceptance、risks 七个栏目，每条都写成可验收的具体描述；\n2. diagrams 至少给出 usecase（actor + usecase，必要时加 system 边界）、dfd（entity → process → store，边上写数据名称）、module（模块依赖，边用 depends）；涉及交互流程时补 sequence（消息按 order 排序），涉及数据模型时补 er（实体 fields + 关系 cardinality），涉及系统分层时补 c4（person/container/component 与 technology）；\n3. modules 拆成 3–7 个可以由一个子代理独立完成的模块，summary 写清交付物、接口与验收标准；\n4. prompt 字段填写用户的原始需求。\n完成后用 2–3 句话向用户说明方案，并请他在「蓝图」面板检查、修改后点击「确认并分派」。`
    }

    function expandSectionPrompt(section) {
      return `当前会话已有工程蓝图。请先调用 blueprint(action="get") 读取用户可能手工修改过的最新版本，然后只扩充栏目「${section.title}」（key=${section.key}）：补充更具体、可验收、彼此不重复的条目，保留现有条目和用户修改。最后调用 blueprint(action="update") 保存完整蓝图，不要删除其他栏目、图解或模块。完成后用一句话说明新增了什么。`
    }

    function expandDiagramPrompt(diagram) {
      const names = { usecase: '用例图', dfd: '数据流图', module: '模块图', sequence: '时序图', er: 'ER 图', c4: 'C4 图' }
      const kind = names[diagram.key] ?? diagram.title
      return `当前会话已有工程蓝图。请先调用 blueprint(action="get") 读取用户可能手工修改过的最新版本，然后只扩充「${kind}」（key=${diagram.key}）：补齐缺失的节点、连线、字段或消息，保留现有内容和用户修改。最后调用 blueprint(action="update") 保存完整蓝图，不要删除其他栏目、图解或模块。完成后用一句话说明新增了什么。`
    }

    function dispatchPrompt() {
      return `用户已在蓝图面板确认工程蓝图。请执行：\n1. 调用 blueprint(action="get") 读取最新蓝图（用户可能手工改过）；\n2. 调用 blueprint(action="dispatch") 标记为已分派；\n3. 为 modules 中每个模块启动一个子代理：有依赖的按依赖顺序执行，无依赖的并行；每个子代理的提示词必须包含该模块的范围、摘要、依赖、验收标准，以及相关用例/数据流/接口；\n4. 不要让一个子代理包办所有模块，也不要自己直接实现全部模块；\n5. 所有子代理完成后，汇总每个模块的改动、验证结果与剩余风险，并用 blueprint(action="update") 更新模块状态。`
    }

    const tplSection = (key, title, items) => ({
      key, title, items: items.map((text, index) => ({ id: `${key}-${index + 1}`, text })),
    })
    const tplDiagram = (key, title, nodes, edges) => ({
      key, title,
      nodes: nodes.map(([id, type, label]) => ({ id, type, label })),
      edges: edges.map(([from, to, label, kind]) => ({ from, to, label, kind })),
    })
    const tplModule = (id, name, summary, dependsOn) => ({ id, name, summary, dependsOn, status: 'pending' })
    function tplBlueprint({ title, summary, prompt, sections, diagrams, modules }) {
      const now = Date.now()
      return {
        version: 1, id: `bp-${now.toString(36)}`, sessionId: state.sessionId,
        title, summary, prompt, status: 'draft',
        sections, diagrams, modules,
        createdAt: now, updatedAt: now,
      }
    }

    // Welcome-page starters. Each one is a complete draft blueprint; layout is
    // left to ensureLayout() so templates never carry x/y/w/h.
    const TEMPLATES = [
      {
        key: 'web', nameKey: 'tplWeb', descKey: 'tplWebDesc',
        build: () => tplBlueprint({
          title: 'Web 应用',
          summary: '前后端分离的 Web 应用：React 前端、Node API、关系型数据库与统一鉴权，先跑通核心浏览与项目流程。',
          prompt: '构建一个 Web 应用，支持注册登录、项目管理与仪表盘；前端 React，后端 Node API，数据库使用 PostgreSQL。',
          sections: [
            tplSection('goals', '目标与价值', [
              '新用户能在 3 分钟内完成注册并进入首个项目。',
              '核心页面首屏在常规网络下 2 秒内可交互。',
              '管理员能查看用户与项目的基础运营数据。',
            ]),
            tplSection('actors', '角色与场景', [
              '访客：浏览落地页、注册与登录。',
              '注册用户：创建和管理自己的项目。',
              '管理员：查看用户与项目并处理异常账号。',
            ]),
            tplSection('functional', '功能需求', [
              '支持邮箱注册、登录、退出与密码重置。',
              '用户可创建、重命名、归档项目并按名称搜索。',
              '仪表盘展示项目数量、最近活动和待办摘要。',
            ]),
            tplSection('nonfunctional', '非功能需求', [
              '接口 P95 延迟低于 300ms，错误率低于 0.5%。',
              '密码只存哈希，会话令牌 7 天过期并可主动吊销。',
              '关键操作写审计日志，保留至少 90 天。',
            ]),
            tplSection('constraints', '约束与依赖', [
              '前端使用 React，后端提供 REST/JSON 接口。',
              '数据存储使用 PostgreSQL，通过迁移脚本管理表结构。',
              '首版不接入第三方 OAuth，仅邮箱密码登录。',
            ]),
            tplSection('acceptance', '验收标准', [
              '新用户可完成注册→登录→创建项目→刷新后数据仍在。',
              '未登录访问受限页面会跳转登录并保留回跳地址。',
              '管理员能禁用账号，被禁用账号立即无法登录。',
            ]),
            tplSection('risks', '风险与开放问题', [
              '鉴权边界（前端守卫 vs 后端校验）需明确，避免只做前端拦截。',
              '是否支持多租户尚未确定，可能影响数据模型。',
              '仪表盘统计口径未定，需产品确认。',
            ]),
          ],
          diagrams: [
            tplDiagram('usecase', '用例图', [
              ['a-user', 'actor', '用户'], ['a-admin', 'actor', '管理员'],
              ['sys', 'system', 'Web 应用'],
              ['uc-signin', 'usecase', '注册 / 登录'], ['uc-project', 'usecase', '管理项目'],
              ['uc-dash', 'usecase', '查看仪表盘'],
            ], [
              ['a-user', 'uc-signin', '关联', 'association'],
              ['a-user', 'uc-project', '关联', 'association'],
              ['a-admin', 'uc-project', '管理', 'association'],
              ['a-admin', 'uc-dash', '查看', 'association'],
            ]),
            tplDiagram('dfd', '数据流图', [
              ['ext-browser', 'entity', '浏览器'], ['ext-admin', 'entity', '管理员'],
              ['p-auth', 'process', '鉴权服务'], ['p-api', 'process', '业务 API'], ['p-dash', 'process', '统计服务'],
              ['s-user', 'store', '用户库'], ['s-project', 'store', '项目库'],
            ], [
              ['ext-browser', 'p-auth', '邮箱 / 密码', 'flow'],
              ['ext-browser', 'p-api', '项目操作', 'flow'],
              ['ext-admin', 'p-dash', '统计查询', 'flow'],
              ['p-auth', 's-user', '账号与令牌', 'flow'],
              ['p-api', 's-project', '项目记录', 'flow'],
              ['p-api', 'p-dash', '活动事件', 'flow'],
              ['p-dash', 's-project', '聚合结果', 'flow'],
            ]),
            tplDiagram('module', '模块图', [
              ['m-ui', 'module', '前端应用'], ['m-api', 'module', '后端 API'],
              ['m-auth', 'module', '鉴权'], ['m-db', 'module', '数据层'],
            ], [
              ['m-ui', 'm-api', 'REST', 'depends'],
              ['m-api', 'm-auth', '校验令牌', 'depends'],
              ['m-api', 'm-db', '读写数据', 'depends'],
              ['m-auth', 'm-db', '账号存储', 'depends'],
            ]),
            tplDiagram('sequence', '时序图', [], []),
            tplDiagram('er', 'ER 图', [], []),
            tplDiagram('c4', 'C4 图', [], []),
          ],
          modules: [
            tplModule('web-ui', '前端应用', '实现登录、项目列表与仪表盘页面，接入后端 REST 接口；验收：核心流程可点通且刷新不丢数据。', []),
            tplModule('web-api', '后端接口', '提供鉴权、项目与仪表盘 REST 接口，包含参数校验与错误码；验收：接口契约测试通过。', ['web-auth', 'web-db']),
            tplModule('web-auth', '鉴权', '实现注册、登录、会话令牌与吊销，密码哈希存储；验收：未授权请求返回 401。', ['web-db']),
            tplModule('web-db', '数据层', '设计用户与项目表、迁移脚本和查询封装；验收：迁移可在空库执行且可回滚。', []),
          ],
        }),
      },
      {
        key: 'cli', nameKey: 'tplCli', descKey: 'tplCliDesc',
        build: () => tplBlueprint({
          title: 'CLI 工具',
          summary: '零依赖命令行工具：命令解析、执行器、配置读取与格式化输出，支持脚本化调用和机器可读结果。',
          prompt: '构建一个 CLI 工具，支持子命令、配置文件和机器可读输出，覆盖命令解析、执行、配置与输出。',
          sections: [
            tplSection('goals', '目标与价值', [
              '开发者能用一个命令完成核心任务。',
              '非法参数给出可操作错误并以非零退出码结束。',
              '输出支持 text 与 json 两种格式，便于脚本消费。',
            ]),
            tplSection('actors', '角色与场景', [
              '开发者：交互式执行命令并查看帮助。',
              'CI 脚本：非交互调用并依赖退出码判断结果。',
              '维护者：发布版本并排查运行问题。',
            ]),
            tplSection('functional', '功能需求', [
              '支持子命令与全局选项解析，未知选项报错并提示用法。',
              '从用户配置与项目配置合并配置，CLI 参数优先级最高。',
              '执行结果写 stdout，诊断与错误写 stderr。',
            ]),
            tplSection('nonfunctional', '非功能需求', [
              '启动到输出帮助信息低于 200ms。',
              '单条命令常驻内存低于 100MB。',
              '退出码遵循 0 成功、1 运行失败、2 用法错误的约定。',
            ]),
            tplSection('constraints', '约束与依赖', [
              '仅使用 Node 标准库，零运行时依赖。',
              '要求 Node 18 及以上版本。',
              '配置格式固定为 JSON，首版不做远程配置。',
            ]),
            tplSection('acceptance', '验收标准', [
              '`tool --help` 退出码为 0 并列出全部子命令。',
              '`tool run --bad` 退出码为 2 并输出用法提示。',
              '`--json` 输出可被 jq 解析，且不混入日志文本。',
            ]),
            tplSection('risks', '风险与开放问题', [
              '子命令命名可能与未来扩展冲突，需要预留命名空间。',
              '配置文件合并顺序需写入文档并加测试。',
              'Windows 路径与换行差异需要额外测试覆盖。',
            ]),
          ],
          diagrams: [
            tplDiagram('usecase', '用例图', [
              ['a-dev', 'actor', '开发者'], ['a-ci', 'actor', 'CI 脚本'],
              ['sys', 'system', 'CLI 工具'],
              ['uc-parse', 'usecase', '解析命令'], ['uc-run', 'usecase', '执行命令'],
              ['uc-config', 'usecase', '读取配置'], ['uc-out', 'usecase', '输出结果'],
            ], [
              ['a-dev', 'uc-parse', '输入参数', 'association'],
              ['a-dev', 'uc-config', '配置覆盖', 'association'],
              ['a-dev', 'uc-out', '查看结果', 'association'],
              ['a-ci', 'uc-run', '脚本调用', 'association'],
              ['a-ci', 'uc-out', '解析输出', 'association'],
            ]),
            tplDiagram('dfd', '数据流图', [
              ['ext-shell', 'entity', '终端'], ['p-parse', 'process', '命令解析器'],
              ['p-exec', 'process', '命令执行器'], ['p-config', 'process', '配置加载器'],
              ['p-format', 'process', '输出格式化'],
              ['s-config', 'store', '配置文件'], ['s-log', 'store', '运行日志'],
            ], [
              ['ext-shell', 'p-parse', 'argv', 'flow'],
              ['p-parse', 'p-config', '命令上下文', 'flow'],
              ['p-parse', 'p-exec', '执行计划', 'flow'],
              ['p-exec', 'p-format', '执行结果', 'flow'],
              ['p-config', 's-config', '读取配置', 'flow'],
              ['p-format', 'ext-shell', 'stdout / stderr', 'flow'],
              ['p-exec', 's-log', '诊断信息', 'flow'],
            ]),
            tplDiagram('module', '模块图', [
              ['m-cli', 'module', '命令解析'], ['m-core', 'module', '执行引擎'],
              ['m-config', 'module', '配置'], ['m-output', 'module', '输出'],
            ], [
              ['m-cli', 'm-core', '执行计划', 'depends'],
              ['m-cli', 'm-config', '选项合并', 'depends'],
              ['m-core', 'm-output', '结果', 'depends'],
              ['m-output', 'm-config', '格式偏好', 'depends'],
            ]),
            tplDiagram('sequence', '时序图', [], []),
            tplDiagram('er', 'ER 图', [], []),
            tplDiagram('c4', 'C4 图', [], []),
          ],
          modules: [
            tplModule('cli-parser', '命令解析', '解析子命令、选项与位置参数，生成执行计划并处理用法错误；验收：未知选项退出码为 2。', []),
            tplModule('cli-core', '执行引擎', '按执行计划调度子命令、处理异常与退出码；验收：成功与失败路径都有测试。', ['cli-parser']),
            tplModule('cli-config', '配置', '加载并合并用户级与项目级 JSON 配置，参数优先；验收：合并顺序符合文档。', []),
            tplModule('cli-output', '输出', '实现 text/json 渲染与 stdout/stderr 分流；验收：json 输出可被 jq 解析。', ['cli-config']),
          ],
        }),
      },
      {
        key: 'pipeline', nameKey: 'tplPipeline', descKey: 'tplPipelineDesc',
        build: () => tplBlueprint({
          title: '数据管道',
          summary: '采集 → 清洗 → 存储 → 调度 的批处理数据管道，先保证可重跑、可观测、数据质量可定位。',
          prompt: '构建一个数据管道：从多个数据源采集、清洗、写入数仓，并由定时任务调度，支持失败重试与质量检查。',
          sections: [
            tplSection('goals', '目标与价值', [
              '每日自动采集并产出可直接分析的数据。',
              '失败任务可一键重跑且不产生重复数据。',
              '数据质量问题能在运行报告中快速定位。',
            ]),
            tplSection('actors', '角色与场景', [
              '数据工程师：配置任务、查看运行状态并排障。',
              '分析师：查询数仓中的分区表。',
              '调度器：按计划触发任务并重试失败任务。',
            ]),
            tplSection('functional', '功能需求', [
              '支持 HTTP 与文件数据源，配置增量采集游标。',
              '清洗规则可配置：去重、类型转换与空值处理。',
              '按日期分区写入数仓，并提供任务状态查询。',
            ]),
            tplSection('nonfunctional', '非功能需求', [
              '单批处理 100 万行低于 15 分钟。',
              '失败自动重试 3 次并采用指数退避。',
              '每次运行记录行数、耗时与质量指标。',
            ]),
            tplSection('constraints', '约束与依赖', [
              '首版只做批处理，暂不引入流式框架。',
              '数据落地 PostgreSQL 并复用现有 cron 调度。',
              '敏感字段在入库前脱敏。',
            ]),
            tplSection('acceptance', '验收标准', [
              '同一分区连续运行两天不产生重复记录。',
              '注入脏数据后质量检查能拦截并在报告中标记。',
              '失败任务重跑后结果幂等且状态可追踪。',
            ]),
            tplSection('risks', '风险与开放问题', [
              '数据源限流策略未知，可能需要退避与配额。',
              '清洗规则变更后需要回填策略与影响评估。',
              '时区与分区边界需与分析师确认。',
            ]),
          ],
          diagrams: [
            tplDiagram('usecase', '用例图', [
              ['a-engineer', 'actor', '数据工程师'], ['a-analyst', 'actor', '分析师'], ['a-scheduler', 'actor', '调度器'],
              ['sys', 'system', '数据管道'],
              ['uc-ingest', 'usecase', '配置采集任务'], ['uc-run', 'usecase', '触发任务'],
              ['uc-monitor', 'usecase', '查看运行与质量'], ['uc-query', 'usecase', '查询数仓'],
            ], [
              ['a-engineer', 'uc-ingest', '配置', 'association'],
              ['a-engineer', 'uc-monitor', '排障', 'association'],
              ['a-scheduler', 'uc-run', '定时触发', 'association'],
              ['a-analyst', 'uc-query', '分析', 'association'],
            ]),
            tplDiagram('dfd', '数据流图', [
              ['ext-source', 'entity', '数据源'], ['p-schedule', 'process', '调度器'],
              ['p-ingest', 'process', '采集器'], ['p-clean', 'process', '清洗器'], ['p-load', 'process', '加载器'],
              ['s-raw', 'store', '原始数据'], ['s-dw', 'store', '数仓'],
            ], [
              ['p-schedule', 'p-ingest', '触发任务', 'flow'],
              ['ext-source', 'p-ingest', '原始记录', 'flow'],
              ['p-ingest', 's-raw', '原始分区', 'flow'],
              ['s-raw', 'p-clean', '待清洗数据', 'flow'],
              ['p-clean', 'p-load', '干净记录', 'flow'],
              ['p-load', 's-dw', '数仓分区', 'flow'],
              ['p-clean', 'p-schedule', '质量报告', 'flow'],
            ]),
            tplDiagram('module', '模块图', [
              ['m-ingest', 'module', '采集'], ['m-clean', 'module', '清洗'],
              ['m-store', 'module', '存储'], ['m-schedule', 'module', '调度'],
            ], [
              ['m-schedule', 'm-ingest', '触发', 'depends'],
              ['m-ingest', 'm-clean', '原始数据', 'depends'],
              ['m-clean', 'm-store', '干净数据', 'depends'],
              ['m-schedule', 'm-store', '运行状态', 'depends'],
            ]),
            tplDiagram('sequence', '时序图', [], []),
            tplDiagram('er', 'ER 图', [], []),
            tplDiagram('c4', 'C4 图', [], []),
          ],
          modules: [
            tplModule('pipe-ingest', '采集', '实现数据源配置、增量游标与原始数据落地；验收：重复运行不重复采集。', []),
            tplModule('pipe-clean', '清洗', '实现去重、类型转换、空值处理与质量检查；验收：脏数据被拦截并记录原因。', ['pipe-ingest']),
            tplModule('pipe-store', '存储', '负责分区写入、幂等 upsert 与查询视图；验收：同分区重复写入结果一致。', ['pipe-clean']),
            tplModule('pipe-schedule', '调度', '接入 cron、实现重试与运行报告；验收：失败任务自动重试且状态可查。', ['pipe-ingest', 'pipe-store']),
          ],
        }),
      },
      {
        key: 'plugin', nameKey: 'tplPlugin', descKey: 'tplPluginDesc',
        build: () => tplBlueprint({
          title: 'DSH 插件',
          summary: '一个 DSH 插件：Host 端注册工具、Client 端提供面板、读写工作区存储并补齐测试，遵循插件清单与零构建客户端。',
          prompt: '为 DSH 开发一个插件：Host 端注册工具、Client 端提供面板、读写工作区存储，并补齐单元测试。',
          sections: [
            tplSection('goals', '目标与价值', [
              '用户在会话中能直接使用插件工具与面板。',
              '插件安装后无需额外构建即可加载。',
              '核心逻辑有回归测试，升级宿主后能快速验证。',
            ]),
            tplSection('actors', '角色与场景', [
              'DSH 用户：通过工具与面板完成任务。',
              '宿主 Agent：按工具 schema 调用并消费结果。',
              '插件维护者：发布版本并处理兼容问题。',
            ]),
            tplSection('functional', '功能需求', [
              'Host 端注册带参数 schema 的工具并返回结构化结果。',
              'Client 端注册面板并订阅宿主状态。',
              '插件读写工作区文件，缺失文件时自动初始化。',
            ]),
            tplSection('nonfunctional', '非功能需求', [
              '工具调用 P95 低于 500ms。',
              '客户端零运行时依赖、无构建步骤。',
              '安装或加载失败时给出明确错误信息。',
            ]),
            tplSection('constraints', '约束与依赖', [
              '客户端只能通过 module-loader 工厂加载。',
              '不得 import 本地 Node 文件，React 来自宿主模块表。',
              '遵循插件清单与宿主版本兼容要求。',
            ]),
            tplSection('acceptance', '验收标准', [
              '安装后工具出现在会话工具列表并可调用。',
              '面板能随会话打开且不破坏宿主布局。',
              '`node --check` 与现有单元测试通过。',
            ]),
            tplSection('risks', '风险与开放问题', [
              '宿主 API 变更可能影响兼容性，需要版本约束。',
              '面板样式依赖宿主主题变量，深浅主题都需检查。',
              '文件权限边界需在真实工作区验证。',
            ]),
          ],
          diagrams: [
            tplDiagram('usecase', '用例图', [
              ['a-user', 'actor', 'DSH 用户'], ['a-agent', 'actor', '宿主 Agent'],
              ['sys', 'system', 'DSH 插件'],
              ['uc-tool', 'usecase', '调用 Host 工具'], ['uc-panel', 'usecase', '打开 Client 面板'],
              ['uc-store', 'usecase', '读写工作区'], ['uc-test', 'usecase', '运行测试'],
            ], [
              ['a-agent', 'uc-tool', '调用', 'association'],
              ['a-agent', 'uc-store', '读写', 'association'],
              ['a-user', 'uc-panel', '查看', 'association'],
              ['a-user', 'uc-test', '验证', 'association'],
            ]),
            tplDiagram('dfd', '数据流图', [
              ['ext-session', 'entity', '会话'], ['ext-work', 'entity', '工作区'],
              ['p-host', 'process', 'Host 工具'], ['p-client', 'process', 'Client 面板'],
              ['p-store', 'process', '存储服务'],
              ['s-file', 'store', '插件数据文件'],
            ], [
              ['ext-session', 'p-host', '工具参数', 'flow'],
              ['p-host', 'p-store', '读写请求', 'flow'],
              ['p-store', 's-file', 'JSON 数据', 'flow'],
              ['p-store', 'p-client', '状态快照', 'flow'],
              ['p-client', 'ext-session', '渲染面板', 'flow'],
              ['ext-work', 'p-store', '文件路径', 'flow'],
            ]),
            tplDiagram('module', '模块图', [
              ['m-host', 'module', 'Host 工具'], ['m-client', 'module', 'Client 面板'],
              ['m-store', 'module', '存储'], ['m-test', 'module', '测试'],
            ], [
              ['m-host', 'm-store', '数据读写', 'depends'],
              ['m-client', 'm-store', '状态读取', 'depends'],
              ['m-test', 'm-host', '覆盖', 'depends'],
              ['m-test', 'm-client', '覆盖', 'depends'],
            ]),
            tplDiagram('sequence', '时序图', [], []),
            tplDiagram('er', 'ER 图', [], []),
            tplDiagram('c4', 'C4 图', [], []),
          ],
          modules: [
            tplModule('plugin-host', 'Host 工具', '注册带 schema 的工具并实现业务处理；验收：工具可被 Agent 调用且返回结构化结果。', []),
            tplModule('plugin-client', 'Client 面板', '通过 module-loader 注册面板、订阅状态并适配主题；验收：面板打开正常且无构建步骤。', ['plugin-host']),
            tplModule('plugin-store', '存储', '封装工作区文件读写、缺失初始化与原子写入；验收：并发写不产生半截文件。', []),
            tplModule('plugin-test', '测试', '补齐语法检查与单元测试，覆盖工具与存储边界；验收：`node --check` 与测试全部通过。', ['plugin-host', 'plugin-store']),
          ],
        }),
      },
    ]

    const TYPE_META = {
      actor: { label: 'actor', color: '#f59e0b', w: 90, h: 104 },
      usecase: { label: 'usecaseNode', color: '#38bdf8', w: 176, h: 64 },
      system: { label: 'system', color: '#64748b', w: 460, h: 320 },
      entity: { label: 'entity', color: '#34d399', w: 158, h: 72 },
      process: { label: 'process', color: '#60a5fa', w: 168, h: 84 },
      store: { label: 'store', color: '#f472b6', w: 164, h: 62 },
      module: { label: 'moduleNode', color: '#a78bfa', w: 196, h: 86 },
      external: { label: 'external', color: '#94a3b8', w: 176, h: 72 },
      participant: { label: 'participant', color: '#38bdf8', w: 170, h: 52 },
      relationship: { label: 'relationship', color: '#f59e0b', w: 120, h: 68 },
      person: { label: 'person', color: '#f59e0b', w: 180, h: 84 },
      container: { label: 'container', color: '#60a5fa', w: 210, h: 104 },
      component: { label: 'component', color: '#a78bfa', w: 200, h: 96 },
      database: { label: 'database', color: '#f472b6', w: 170, h: 84 },
    }

    function typesFor(key) {
      if (key === 'usecase') return ['actor', 'usecase', 'system']
      if (key === 'dfd') return ['entity', 'process', 'store']
      if (key === 'sequence') return ['participant', 'actor']
      if (key === 'er') return ['entity', 'relationship']
      if (key === 'c4') return ['person', 'system', 'container', 'component', 'database', 'external']
      return ['module', 'external']
    }
    function defaultEdgeKind(key) {
      if (key === 'usecase') return 'association'
      if (key === 'dfd') return 'flow'
      if (key === 'sequence') return 'sync'
      if (key === 'er') return 'relationship'
      if (key === 'c4') return 'uses'
      return 'depends'
    }
    function sizeOf(node) {
      const meta = TYPE_META[node.type] ?? TYPE_META.usecase
      if (node.type === 'entity' && Array.isArray(node.fields) && node.fields.length > 0) {
        return { w: node.w ?? 210, h: Math.max(96, 58 + node.fields.length * 19) }
      }
      return { w: node.w ?? meta.w, h: node.h ?? meta.h }
    }

    function layoutDiagram(diagram) {
      const nodes = diagram.nodes ?? []
      if (nodes.length === 0) return
      const system = nodes.find(node => node.type === 'system')
      const gapX = 70
      const gapY = 56
      if (diagram.key === 'usecase') {
        const actors = nodes.filter(node => node.type === 'actor')
        const usecases = nodes.filter(node => node.type === 'usecase')
        let x = 70
        actors.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = x
          node.y = 110 + index * (size.h + gapY)
          node.w = size.w
          node.h = size.h
        })
        const startX = actors.length > 0 ? 300 : 120
        const columns = usecases.length > 4 ? 2 : 1
        let maxRight = startX
        usecases.forEach((node, index) => {
          const size = sizeOf(node)
          const column = index % columns
          const row = Math.floor(index / columns)
          node.x = startX + column * (size.w + gapX)
          node.y = 92 + row * (size.h + gapY)
          node.w = size.w
          node.h = size.h
          maxRight = Math.max(maxRight, node.x + size.w)
        })
        if (system !== undefined) {
          system.x = startX - 40
          system.y = 44
          system.w = Math.max(420, maxRight - startX + 80)
          system.h = Math.max(300, ...usecases.map(node => node.y + sizeOf(node).h - 44 + 40))
        }
      } else if (diagram.key === 'dfd') {
        const groups = {
          entity: nodes.filter(node => node.type === 'entity'),
          process: nodes.filter(node => node.type === 'process'),
          store: nodes.filter(node => node.type === 'store'),
        }
        const xFor = { entity: 70, process: 380, store: 720 }
        for (const type of ['entity', 'process', 'store']) {
          groups[type].forEach((node, index) => {
            const size = sizeOf(node)
            node.x = xFor[type]
            node.y = 100 + index * (Math.max(size.h, 84) + gapY)
            node.w = size.w
            node.h = size.h
          })
        }
      } else if (diagram.key === 'module') {
        const byId = new Map(nodes.map(node => [node.id, node]))
        const level = new Map(nodes.map(node => [node.id, 0]))
        for (let round = 0; round < 12; round += 1) {
          let changed = false
          for (const edge of diagram.edges ?? []) {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (from === undefined || to === undefined) continue
            const next = (level.get(to.id) ?? 0) + 1
            if ((level.get(from.id) ?? 0) < next && next < 12) {
              level.set(from.id, next)
              changed = true
            }
          }
          if (!changed) break
        }
        const columns = new Map()
        for (const node of nodes) {
          const depth = level.get(node.id) ?? 0
          if (!columns.has(depth)) columns.set(depth, [])
          columns.get(depth).push(node)
        }
        const maxDepth = Math.max(...columns.keys(), 0)
        for (const [depth, list] of columns) {
          list.forEach((node, index) => {
            const size = sizeOf(node)
            node.x = 90 + (maxDepth - depth) * 280
            node.y = 100 + index * (size.h + gapY)
            node.w = size.w
            node.h = size.h
          })
        }
      } else if (diagram.key === 'sequence') {
        nodes.forEach((node, index) => {
          node.x = 80 + index * 230
          node.y = 64
          node.w = node.type === 'actor' ? 130 : 170
          node.h = node.type === 'actor' ? 84 : 52
        })
        ;(diagram.edges ?? []).forEach((edge, index) => {
          if (typeof edge.order !== 'number') edge.order = index + 1
        })
        diagram.height = 170 + Math.max(1, (diagram.edges ?? []).length) * 56 + 90
      } else if (diagram.key === 'er') {
        const entities = nodes.filter(node => node.type === 'entity')
        const relationships = nodes.filter(node => node.type === 'relationship')
        const columns = entities.length > 3 ? 2 : 1
        entities.forEach((node, index) => {
          const size = sizeOf(node)
          const column = index % columns
          const row = Math.floor(index / columns)
          node.x = 70 + column * (size.w + 70)
          node.y = 90 + row * (size.h + 60)
          node.w = size.w
          node.h = size.h
        })
        relationships.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = 620
          node.y = 110 + index * (size.h + 60)
          node.w = size.w
          node.h = size.h
        })
      } else if (diagram.key === 'c4') {
        const people = nodes.filter(node => node.type === 'person')
        const externals = nodes.filter(node => node.type === 'external')
        const cores = nodes.filter(node => !['person', 'external'].includes(node.type))
        people.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = 70
          node.y = 100 + index * (size.h + 54)
          node.w = size.w
          node.h = size.h
        })
        const columns = cores.length > 3 ? 2 : 1
        cores.forEach((node, index) => {
          const size = sizeOf(node)
          const column = index % columns
          const row = Math.floor(index / columns)
          node.w = node.type === 'system' ? 230 : size.w
          node.h = node.type === 'system' ? 110 : size.h
          node.x = 340 + column * (node.w + 60)
          node.y = 90 + row * (node.h + 56)
        })
        externals.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = 880
          node.y = 100 + index * (size.h + 54)
          node.w = size.w
          node.h = size.h
        })
      } else {
        nodes.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = 100 + (index % 3) * 240
          node.y = 100 + Math.floor(index / 3) * 120
          node.w = size.w
          node.h = size.h
        })
      }
      for (const node of nodes) {
        const size = sizeOf(node)
        node.w = size.w
        node.h = size.h
      }
    }

    function ensureLayout(blueprint) {
      for (const diagram of blueprint.diagrams ?? []) {
        const missing = (diagram.nodes ?? []).some(node => typeof node.x !== 'number' || typeof node.y !== 'number')
        if (missing) layoutDiagram(diagram)
        if (diagram.key === 'sequence') {
          ;(diagram.edges ?? []).forEach((edge, index) => {
            if (typeof edge.order !== 'number') edge.order = index + 1
          })
          diagram.height = 170 + Math.max(1, (diagram.edges ?? []).length) * 56 + 90
        }
      }
    }

    let undoStack = []
    let redoStack = []
    let lastUndoAt = 0
    let lastUndoLabel = ''
    const UNDO_LIMIT = 60

    function cloneBlueprint(bp) {
      return JSON.parse(JSON.stringify(bp))
    }
    function resetHistory() {
      undoStack = []
      redoStack = []
      lastUndoAt = 0
      lastUndoLabel = ''
    }
    function historyFlags() {
      return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        historyVersion: state.historyVersion + 1,
      }
    }
    function recordUndo(bp, label) {
      const now = Date.now()
      if (undoStack.length > 0 && now - lastUndoAt < 800 && lastUndoLabel === label) {
        lastUndoAt = now
        return
      }
      undoStack.push(cloneBlueprint(bp))
      if (undoStack.length > UNDO_LIMIT) undoStack.shift()
      redoStack = []
      lastUndoAt = now
      lastUndoLabel = label
    }
    function undoBlueprint() {
      if (state.bp === null || undoStack.length === 0) return
      redoStack.push(cloneBlueprint(state.bp))
      const previous = undoStack.pop()
      lastUndoAt = 0
      set({
        bp: previous,
        dirty: true,
        selected: null,
        mode: 'select',
        connectFrom: null,
        diff: null,
        ...historyFlags(),
      })
      toast(t('undoDone'), 'info')
    }
    function redoBlueprint() {
      if (state.bp === null || redoStack.length === 0) return
      undoStack.push(cloneBlueprint(state.bp))
      const next = redoStack.pop()
      lastUndoAt = 0
      set({
        bp: next,
        dirty: true,
        selected: null,
        mode: 'select',
        connectFrom: null,
        diff: null,
        ...historyFlags(),
      })
      toast(t('redoDone'), 'info')
    }

    function mutate(fn, { layout = false, undoLabel = 'edit', undo = true } = {}) {
      const bp = state.bp
      if (bp === null) return
      if (undo) recordUndo(bp, undoLabel)
      fn(bp)
      if (layout) {
        const diagram = bp.diagrams.find(item => item.key === state.tab)
        if (diagram !== undefined) layoutDiagram(diagram)
      }
      bp.updatedAt = Date.now()
      set({ bp: { ...bp }, dirty: true, ...historyFlags() })
    }

    function wrapLines(label, width) {
      const text = String(label ?? '')
      const max = Math.max(4, Math.floor(width / 7.2))
      const lines = []
      let current = ''
      let units = 0
      for (const char of text) {
        const weight = /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1
        if (units + weight > max * 2 && current !== '') {
          lines.push(current)
          current = ''
          units = 0
        }
        current += char
        units += weight
      }
      if (current !== '') lines.push(current)
      return lines.slice(0, 3)
    }

    function labelText(x, y, lines, options = {}) {
      return h('text', {
        x, y, textAnchor: 'middle', className: 'bp-canvas-label',
        fill: options.fill ?? 'var(--dsw-alias-label-primary)',
        fontSize: options.size ?? 12.5,
        fontWeight: options.weight ?? 500,
        pointerEvents: 'none',
      }, lines.map((line, index) => h('tspan', {
        key: index, x, dy: index === 0 ? 0 : (options.lineHeight ?? 15),
      }, line)))
    }

    function Icon({ name, size = 16 }) {
      const common = {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true,
      }
      if (name === 'blueprint') {
        return h('svg', common,
          h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }),
          h('path', { d: 'M3 9h18M9 9v12' }),
          h('circle', { cx: 15.5, cy: 14.5, r: 1.6, fill: 'currentColor', stroke: 'none' }))
      }
      if (name === 'spark') {
        return h('svg', common, h('path', { d: 'M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3z' }), h('path', { d: 'M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z' }))
      }
      if (name === 'plus') return h('svg', common, h('path', { d: 'M12 5v14M5 12h14' }))
      if (name === 'trash') return h('svg', common, h('path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' }))
      if (name === 'close') return h('svg', common, h('path', { d: 'M6 6l12 12M18 6L6 18' }))
      if (name === 'save') return h('svg', common, h('path', { d: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-7h8v7' }))
      if (name === 'send') return h('svg', common, h('path', { d: 'M4 12l16-7-6 16-3-7-7-2z' }))
      if (name === 'download') return h('svg', common, h('path', { d: 'M12 4v10M7 10l5 5 5-5M5 20h14' }))
      if (name === 'layout') return h('svg', common, h('rect', { x: 4, y: 4, width: 6, height: 6, rx: 1 }), h('rect', { x: 14, y: 4, width: 6, height: 6, rx: 1 }), h('rect', { x: 9, y: 14, width: 6, height: 6, rx: 1 }), h('path', { d: 'M7 10v2h10v-2M12 12v2' }))
      if (name === 'connect') return h('svg', common, h('circle', { cx: 6, cy: 6, r: 2 }), h('circle', { cx: 18, cy: 18, r: 2 }), h('path', { d: 'M8 8l8 8' }))
      if (name === 'cursor') return h('svg', common, h('path', { d: 'M5 3l6.5 16 2-6 6-2L5 3z' }))
      if (name === 'zoomIn') return h('svg', common, h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'M15.5 15.5L21 21M10.5 8v5M8 10.5h5' }))
      if (name === 'zoomOut') return h('svg', common, h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'M15.5 15.5L21 21M8 10.5h5' }))
      if (name === 'expand') return h('svg', common, h('path', { d: 'M4 9V4h5M20 15v5h-5M4 15v5h5M20 9V4h-5' }))
      if (name === 'back') return h('svg', common, h('path', { d: 'M19 12H5M11 6l-6 6 6 6' }))
      if (name === 'undo') return h('svg', common, h('path', { d: 'M9 14L4 9l5-5' }), h('path', { d: 'M4 9h9a7 7 0 1 1 0 14h-3' }))
      if (name === 'redo') return h('svg', common, h('path', { d: 'M15 14l5-5-5-5' }), h('path', { d: 'M20 9h-9a7 7 0 1 0 0 14h3' }))
      return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }))
    }

    function statusLabel(status) {
      if (status === 'confirmed') return t('statusConfirmed')
      if (status === 'dispatched') return t('statusDispatched')
      return t('statusDraft')
    }

    function moduleStatusLabel(status) {
      if (status === 'running' || status === 'in-progress') return t('statusRunning')
      if (status === 'done' || status === 'completed') return t('statusDone')
      if (status === 'blocked' || status === 'failed') return t('statusBlocked')
      return t('statusPending')
    }

    function button(className, onClick, children, options = {}) {
      return h('button', {
        type: 'button',
        className: `bp-btn ${className ?? ''}`.trim(),
        onClick,
        title: options.title,
        disabled: options.disabled === true,
        'aria-label': options.title,
      }, children)
    }

    function OpenButton(props) {
      const store = useStore()
      const sessionId = props?.sessionId
      const [has, setHas] = useState(false)
      const [ready, setReady] = useState(false)
      useEffect(() => {
        if (!sessionId) return
        let alive = true
        async function probe() {
          try {
            const api = remote()
            if (api === undefined) return
            const result = await api.workspaceFiles.stat(sessionId, pathFor(sessionId), undefined)
            if (alive) setHas(result.ok === true)
          } catch {
            if (alive) setHas(false)
          }
          if (alive) setReady(true)
        }
        probe()
        const timer = setInterval(probe, 6000)
        return () => { alive = false; clearInterval(timer) }
      }, [sessionId, store.lastLoaded])
      return h(React.Fragment, null,
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: `bp-open${has ? ' bp-has' : ''}`,
          title: t('open'),
          'aria-label': t('open'),
          'data-bp-session': sessionId ?? '',
          onClick: () => openStudio(sessionId),
        }, h(Icon, { name: 'blueprint', size: 15 }), h('span', { className: 'bp-open-label' }, t('open')), has && ready ? h('i', { className: 'bp-dot' }) : null))
    }

    function openStudio(sessionId) {
      if (!sessionId) return
      resetHistory()
      set({
        open: true, sessionId, path: pathFor(sessionId), bp: null, loading: true, missing: false,
        dirty: false, selected: null, mode: 'select', connectFrom: null, error: null, lastText: '', tab: 'usecase',
        panel: 'inspector', versions: [], versionsLoaded: false, diff: null, children: [], childrenLoaded: false,
        landing: false, canUndo: false, canRedo: false, historyVersion: state.historyVersion + 1,
      })
      loadBlueprint({ initial: true })
      loadVersions()
    }

    function backToStart() {
      if (state.dirty) {
        const pending = saveBlueprint({ silent: true })
        pending.then(ok => {
          if (ok) set({ landing: true, selected: null, mode: 'select', connectFrom: null, diff: null, panel: 'inspector' })
        })
        return
      }
      set({ landing: true, selected: null, mode: 'select', connectFrom: null, diff: null, panel: 'inspector' })
    }

    function closeStudio() {
      if (state.dirty) {
        saveBlueprint({ silent: true })
      }
      set({ open: false })
    }

    function EmptyState() {
      const store = useStore()
      const existing = store.bp !== null
      const [task, setTask] = useState(existing ? (store.bp.prompt ?? '') : '')
      const start = async () => {
        if (task.trim() === '') return
        try {
          set({ loading: true, error: null })
          await sendPrompt(generatePrompt(task.trim()), 'generating')
          set({ loading: false, landing: false })
          // The agent will create the file; poll picks it up.
          const timer = setInterval(async () => {
            if (!state.open) { clearInterval(timer); return }
            const text = await readBlueprintText(state.sessionId).catch(() => null)
            if (text !== null) {
              clearInterval(timer)
              loadBlueprint()
            }
          }, 2000)
        } catch (error) {
          set({ loading: false, error: String(error?.message ?? error) })
        }
      }
      const applyTemplate = template => {
        try {
          const bp = template.build()
          ensureLayout(bp)
          resetHistory()
          set({
            bp, missing: false, dirty: true, tab: 'usecase', landing: false,
            canUndo: false, canRedo: false, error: null, selected: null,
            mode: 'select', connectFrom: null, panel: 'inspector',
          })
          const pending = saveBlueprint({ silent: true })
          pending.then(ok => {
            if (ok) toast(t('templateApplied'), 'success')
          }).catch(error => {
            set({ error: String(error?.message ?? error) })
          })
        } catch (error) {
          const message = String(error?.message ?? error)
          set({ error: message })
          toast(`${t('templateFailed')}: ${message}`, 'error')
        }
      }
      const continueOrStart = () => {
        if (existing) {
          set({ landing: false, selected: null })
          return
        }
        const now = Date.now()
        const bp = {
          version: 1,
          id: `bp-${now.toString(36)}`,
          sessionId: store.sessionId,
          title: task.trim().slice(0, 60) || t('title'),
          summary: '',
          prompt: task.trim(),
          status: 'draft',
          sections: [
            { key: 'goals', title: '目标与价值', items: [] },
            { key: 'actors', title: '角色与场景', items: [] },
            { key: 'functional', title: '功能需求', items: [] },
            { key: 'nonfunctional', title: '非功能需求', items: [] },
            { key: 'constraints', title: '约束与依赖', items: [] },
            { key: 'acceptance', title: '验收标准', items: [] },
            { key: 'risks', title: '风险与开放问题', items: [] },
          ],
          diagrams: [
            { key: 'usecase', title: '用例图', nodes: [], edges: [] },
            { key: 'dfd', title: '数据流图', nodes: [], edges: [] },
            { key: 'module', title: '模块图', nodes: [], edges: [] },
            { key: 'sequence', title: '时序图', nodes: [], edges: [] },
            { key: 'er', title: 'ER 图', nodes: [], edges: [] },
            { key: 'c4', title: 'C4 图', nodes: [], edges: [] },
          ],
          modules: [],
          createdAt: now,
          updatedAt: now,
        }
        resetHistory()
        set({ bp, missing: false, dirty: true, tab: 'usecase', landing: false, canUndo: false, canRedo: false })
        saveBlueprint({ silent: true })
      }
      return h('div', { className: 'bp-empty' },
        h('div', { className: 'bp-empty-card' },
          h('div', { className: 'bp-empty-icon' }, h(Icon, { name: 'blueprint', size: 30 })),
          h('h2', null, t('emptyTitle')),
          h('p', null, t('emptyHint')),
          h('textarea', {
            className: 'bp-empty-input', value: task, rows: 4,
            placeholder: t('emptyPlaceholder'),
            onChange: event => setTask(event.target.value),
            onKeyDown: event => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') start()
            },
          }),
          h('div', { className: 'bp-templates' },
            h('div', { className: 'bp-templates-head' },
              h('strong', null, t('templatesTitle')),
              h('span', null, t('templatesHint'))),
            h('div', { className: 'bp-template-grid' },
              TEMPLATES.map(template => h('button', {
                key: template.key,
                type: 'button',
                className: 'bp-template-card',
                title: t(template.descKey),
                onClick: () => applyTemplate(template),
              },
                h('strong', null, t(template.nameKey)),
                h('span', null, t(template.descKey)))))),
          h('div', { className: 'bp-empty-actions' },
            h('button', { className: 'bp-btn bp-primary', disabled: task.trim() === '' || store.aiBusy !== null, onClick: start },
              h(Icon, { name: 'spark', size: 15 }), store.aiBusy ? t('generating') : t('generate')),
            h('button', { className: 'bp-btn', onClick: continueOrStart }, existing ? t('continueEditing') : t('manualStart'))),
          store.aiBusy ? h('div', { className: 'bp-waiting' }, h('span', { className: 'bp-spinner' }), t('waiting')) : null,
          store.error ? h('div', { className: 'bp-error' }, store.error) : null))
    }

    function Section({ section, store }) {
      const [open, setOpen] = useState(true)
      const [adding, setAdding] = useState(false)
      const [draft, setDraft] = useState('')
      const addItem = () => {
        const body = draft.trim()
        if (body === '') { setAdding(false); return }
        mutate(bp => {
          const target = bp.sections.find(item => item.key === section.key)
          if (target !== undefined) target.items.push({ id: `i${Date.now().toString(36)}`, text: body })
        })
        setDraft('')
        setAdding(false)
      }
      return h('section', { className: 'bp-section' },
        h('header', { className: 'bp-section-head' },
          h('button', { type: 'button', className: 'bp-section-title', onClick: () => setOpen(!open) },
            h('span', { className: `bp-caret${open ? ' open' : ''}` }, '▸'),
            h('span', null, section.title),
            h('em', null, t('sectionCount', { count: section.items.length }))),
          h('div', { className: 'bp-section-tools' },
            button('bp-ghost', () => setAdding(value => !value), h(Icon, { name: 'plus', size: 14 }), { title: t('addItem') }),
            button('bp-ghost bp-spark', () => expandSection(section), h(Icon, { name: 'spark', size: 14 }), { title: t('expandSection') }))),
        open ? h('div', { className: 'bp-section-body' },
          section.items.map((item, index) => h('div', { className: 'bp-item', key: item.id ?? index },
            h('textarea', {
              className: 'bp-item-input', value: item.text, rows: Math.max(1, Math.ceil((item.text.length * 2 + 8) / 34)),
              onChange: event => mutate(bp => {
                const target = bp.sections.find(entry => entry.key === section.key)
                if (target?.items[index] !== undefined) target.items[index].text = event.target.value
              }),
            }),
            h('button', {
              type: 'button', className: 'bp-item-del', title: t('delete'),
              onClick: () => mutate(bp => {
                const target = bp.sections.find(entry => entry.key === section.key)
                if (target !== undefined) target.items.splice(index, 1)
              }),
            }, h(Icon, { name: 'trash', size: 13 })))),
          adding ? h('div', { className: 'bp-add-row' },
            h('input', {
              autoFocus: true, className: 'bp-input', value: draft, placeholder: t('addItem'),
              onChange: event => setDraft(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); addItem() }
                if (event.key === 'Escape') { setAdding(false); setDraft('') }
              },
              onBlur: addItem,
            })) : null) : null)
    }

    function LeftPanel({ store }) {
      const bp = store.bp
      const [addingSection, setAddingSection] = useState(false)
      const [sectionName, setSectionName] = useState('')
      if (bp === null) return null
      const addSection = () => {
        const title = sectionName.trim()
        if (title === '') { setAddingSection(false); return }
        mutate(current => {
          const key = `custom-${Date.now().toString(36)}`
          current.sections.push({ key, title, items: [] })
        })
        setSectionName('')
        setAddingSection(false)
      }
      return h('aside', { className: 'bp-left' },
        h('div', { className: 'bp-left-head' },
          h('div', { className: 'bp-kicker' }, t('requirements')),
          h('input', {
            className: 'bp-title-input', value: bp.title, placeholder: t('titlePlaceholder'),
            onChange: event => mutate(current => { current.title = event.target.value }),
          }),
          h('textarea', {
            className: 'bp-summary-input', value: bp.summary ?? '', rows: 2,
            placeholder: t('summaryPlaceholder'),
            onChange: event => mutate(current => { current.summary = event.target.value }),
          })),
        h('div', { className: 'bp-sections' },
          bp.sections.map(section => h(Section, { key: section.key, section, store })),
          addingSection ? h('div', { className: 'bp-add-row' },
            h('input', {
              autoFocus: true, className: 'bp-input', value: sectionName, placeholder: t('addSectionPlaceholder'),
              onChange: event => setSectionName(event.target.value),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); addSection() }
                if (event.key === 'Escape') { setAddingSection(false); setSectionName('') }
              },
              onBlur: addSection,
            })) : null,
          h('button', { type: 'button', className: 'bp-add-section', onClick: () => setAddingSection(true) },
            h(Icon, { name: 'plus', size: 14 }), t('addSection'))))
    }

    function NodeShape({ node, selected, onPointerDown, onClick, diagramKey, index }) {
      const size = sizeOf(node)
      const w = size.w
      const height = size.h
      const meta = TYPE_META[node.type] ?? TYPE_META.usecase
      const color = meta.color
      const lines = wrapLines(node.label, w - 24)
      const shape = []
      if (node.type === 'actor') {
        const cx = w / 2
        shape.push(
          h('circle', { key: 'head', cx, cy: 17, r: 9, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 2 }),
          h('path', {
            key: 'body', d: `M${cx} 26v26M${cx - 15} 36h30M${cx} 52l-11 18M${cx} 52l11 18`,
            fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round',
          }))
        shape.push(labelText(cx, height - 6, wrapLines(node.label, w - 8), { size: 12 }))
      } else if (node.type === 'participant') {
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 8, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('rect', { key: 'bar', x: 0, y: 0, width: w, height: 5, rx: 2.5, fill: color }),
          labelText(w / 2, height / 2 + 3, lines, { weight: 600 }))
      } else if (node.type === 'relationship') {
        shape.push(
          h('polygon', { key: 'shape', points: `${w / 2},2 ${w - 2},${height / 2} ${w / 2},${height - 2} 2,${height / 2}`, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 + 4, lines, { weight: 600 }))
      } else if (node.type === 'entity' && diagramKey === 'er') {
        const rowHeight = 19
        const headerHeight = 34
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 8, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('rect', { key: 'header', x: 0, y: 0, width: w, height: headerHeight, rx: 8, fill: color, opacity: 0.14 }),
          h('text', { key: 'label', x: 12, y: 22, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 700 }, node.label))
        const fields = node.fields ?? []
        if (fields.length === 0) {
          shape.push(h('text', { key: 'empty', x: 12, y: headerHeight + 18, fill: 'var(--dsw-alias-label-secondary)', fontSize: 11 }, t('fieldsEmpty')))
        } else {
          fields.forEach((field, index) => {
            const y = headerHeight + 15 + index * rowHeight
            shape.push(h('text', {
              key: `f-${index}`, x: 12, y, fill: 'var(--dsw-alias-label-primary)', fontSize: 11, fontWeight: field.key ? 700 : 400,
            }, `${field.key ? 'PK ' : ''}${field.name}`))
            if (field.type) {
              shape.push(h('text', {
                key: `t-${index}`, x: w - 12, y, textAnchor: 'end', fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5,
              }, field.type))
            }
          })
        }
      } else if (node.type === 'person') {
        const cx = 24
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 10, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('circle', { key: 'head', cx, cy: 24, r: 7, fill: 'none', stroke: color, strokeWidth: 1.8 }),
          h('path', { key: 'body', d: `M${cx - 11} 48c0-8 5-13 11-13s11 5 11 13`, fill: 'none', stroke: color, strokeWidth: 1.8 }),
          h('text', { key: 'label', x: 46, y: 28, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 650 }, node.label))
        if (node.technology) shape.push(h('text', { key: 'tech', x: 46, y: 46, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5 }, node.technology))
      } else if (node.type === 'container' || node.type === 'component' || node.type === 'database' || (node.type === 'external' && diagramKey === 'c4')) {
        const dash = node.type === 'external' ? '6 4' : undefined
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 10, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8, strokeDasharray: dash }),
          h('rect', { key: 'bar', x: 0, y: 0, width: w, height: 6, rx: 3, fill: color }),
          h('text', { key: 'label', x: 12, y: 30, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 650 }, node.label))
        if (node.technology) shape.push(h('text', { key: 'tech', x: 12, y: 51, fill: color, fontSize: 10.5, fontWeight: 600 }, `[${node.technology}]`))
        if (node.description) {
          const description = wrapLines(node.description, w - 24).slice(0, 2)
          description.forEach((line, index) => shape.push(h('text', {
            key: `d-${index}`, x: 12, y: 70 + index * 14, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5,
          }, line)))
        }
      } else if (node.type === 'system' && diagramKey === 'c4') {
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 12, fill: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent)', stroke: color, strokeWidth: 2 }),
          h('text', { key: 'label', x: 12, y: 30, fill: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 700 }, node.label))
        if (node.technology) shape.push(h('text', { key: 'tech', x: 12, y: 52, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5 }, `[${node.technology}]`))
        if (node.description) {
          wrapLines(node.description, w - 24).slice(0, 2).forEach((line, index) => shape.push(h('text', {
            key: `d-${index}`, x: 12, y: 74 + index * 14, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5,
          }, line)))
        }
      } else if (node.type === 'system') {
        shape.push(
          h('rect', { key: 'rect', x: 0, y: 0, width: w, height, rx: 18, fill: 'color-mix(in srgb, var(--dsw-alias-bg-layer-2) 55%, transparent)', stroke: color, strokeWidth: 1.6, strokeDasharray: '8 6' }),
          h('rect', { key: 'label-bg', x: 10, y: 8, width: Math.min(w - 20, Math.max(60, node.label.length * 13 + 14)), height: 22, rx: 6, fill: 'var(--dsw-alias-bg-base)', opacity: 0.92 }),
          h('text', { key: 'label', x: 17, y: 23, fill: 'var(--dsw-alias-label-secondary)', fontSize: 12, fontWeight: 600 }, node.label))
      } else if (node.type === 'usecase') {
        shape.push(
          h('ellipse', { key: 'shape', cx: w / 2, cy: height / 2, rx: w / 2 - 3, ry: height / 2 - 3, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 - (lines.length - 1) * 7 + 4, lines))
      } else if (node.type === 'process') {
        const r = Math.min(w, height) / 2 - 4
        shape.push(
          h('circle', { key: 'shape', cx: w / 2, cy: height / 2, r, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 - (lines.length - 1) * 7 + 4, lines))
      } else if (node.type === 'store') {
        shape.push(
          h('path', { key: 'shape', d: `M4 4h${w - 8}M4 ${height - 4}h${w - 8}M4 4v${height - 8}M${w - 4} 4v${height - 8}`, fill: 'none', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 - (lines.length - 1) * 7 + 4, lines))
      } else if (node.type === 'module' || node.type === 'external') {
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 10, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8, strokeDasharray: node.type === 'external' ? '6 4' : undefined }),
          h('rect', { key: 'bar', x: 0, y: 0, width: w, height: 5, rx: 2.5, fill: color, opacity: 0.85 }),
          labelText(w / 2, height / 2 - (lines.length - 1) * 7 + 4, lines, { weight: 600 }))
      } else {
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 8, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 - (lines.length - 1) * 7 + 4, lines))
      }
      return h('g', {
        transform: `translate(${node.x ?? 0} ${node.y ?? 0})`,
        className: `bp-node${selected ? ' selected' : ''}`,
        onPointerDown,
        onClick,
        style: { cursor: 'grab' },
        'data-node-id': node.id,
        'data-node-index': index,
      },
        selected ? h('rect', { x: -6, y: -6, width: w + 12, height: height + 12, rx: 12, fill: 'none', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.4, strokeDasharray: '5 4' }) : null,
        shape)
    }

    function edgeGeometry(diagram, edge) {
      const from = diagram.nodes.find(node => node.id === edge.from)
      const to = diagram.nodes.find(node => node.id === edge.to)
      if (from === undefined || to === undefined) return null
      const a = sizeOf(from)
      const b = sizeOf(to)
      const x1 = (from.x ?? 0) + a.w / 2
      const y1 = (from.y ?? 0) + a.h / 2
      const x2 = (to.x ?? 0) + b.w / 2
      const y2 = (to.y ?? 0) + b.h / 2
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const shortX = x2 - Math.cos(angle) * Math.min(b.w, b.h) * 0.42
      const shortY = y2 - Math.sin(angle) * Math.min(b.w, b.h) * 0.42
      return { x1, y1, x2: shortX, y2: shortY, mx: (x1 + shortX) / 2, my: (y1 + shortY) / 2 }
    }

    function Edge({ diagram, edge, selected, onSelect }) {
      const geo = edgeGeometry(diagram, edge)
      if (geo === null) return null
      const dashed = edge.kind === 'depends' || edge.kind === 'include'
      const showLabel = typeof edge.label === 'string' && edge.label.trim() !== ''
      const width = showLabel ? Math.min(200, edge.label.length * 12 + 14) : 0
      return h('g', {
        className: `bp-edge${selected ? ' selected' : ''}`,
        onClick: event => { event.stopPropagation(); onSelect() },
        style: { cursor: 'pointer' },
      },
        h('line', { x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2, stroke: 'transparent', strokeWidth: 14 }),
        h('line', {
          x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2,
          stroke: selected ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: dashed ? '6 4' : undefined,
          markerEnd: 'url(#bp-arrow)',
        }),
        showLabel ? h('g', null,
          h('rect', { x: geo.mx - width / 2, y: geo.my - 10, width, height: 20, rx: 6, fill: 'var(--dsw-alias-bg-base)', stroke: 'var(--dsw-alias-border-l1)' }),
          h('text', { x: geo.mx, y: geo.my + 4, textAnchor: 'middle', fontSize: 11, fill: 'var(--dsw-alias-label-secondary)' }, edge.label)) : null,
        edge.cardinality ? h('text', {
          x: geo.x2, y: geo.y2 - 7, textAnchor: 'middle', fontSize: 10.5, fontWeight: 600,
          fill: 'var(--dsw-alias-label-secondary)',
        }, edge.cardinality) : null)
    }

    function fitViewFor(diagram) {
      const W = 2000
      const H = 1200
      const nodes = diagram?.nodes ?? []
      if (nodes.length === 0) return { x: 70, y: 30, zoom: 1 }
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const node of nodes) {
        const size = sizeOf(node)
        minX = Math.min(minX, node.x ?? 0)
        minY = Math.min(minY, node.y ?? 0)
        maxX = Math.max(maxX, (node.x ?? 0) + size.w)
        maxY = Math.max(maxY, (node.y ?? 0) + size.h)
      }
      const width = Math.max(120, maxX - minX)
      const height = Math.max(120, maxY - minY, diagram?.height ?? 0)
      const zoom = Math.min(1.5, Math.max(0.35, Math.min((W - 220) / width, (H - 180) / height)))
      return {
        zoom,
        x: (W - width * zoom) / 2 - minX * zoom,
        y: (H - height * zoom) / 2 - minY * zoom,
      }
    }

    function SequenceLayer({ diagram, selectedId, onSelect }) {
      const nodes = [...(diagram.nodes ?? [])].sort((left, right) => (left.x ?? 0) - (right.x ?? 0))
      const byId = new Map(nodes.map(node => [node.id, node]))
      const edges = [...(diagram.edges ?? [])].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      const bottom = Math.max(360, diagram.height ?? 520)
      const messages = []
      edges.forEach((edge, index) => {
        const from = byId.get(edge.from)
        const to = byId.get(edge.to)
        if (from === undefined || to === undefined) return
        const fromSize = sizeOf(from)
        const toSize = sizeOf(to)
        const x1 = (from.x ?? 0) + fromSize.w / 2
        const x2 = (to.x ?? 0) + toSize.w / 2
        const y = 168 + index * 56
        const active = selectedId === edge.id
        const stroke = active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
        const dashed = edge.kind === 'return' ? '6 4' : undefined
        if (edge.from === edge.to) {
          messages.push(h('g', { key: edge.id, onClick: event => { event.stopPropagation(); onSelect(edge.id) }, style: { cursor: 'pointer' } },
            h('path', { d: `M${x1 - 8} ${y}h54v26h-54`, fill: 'none', stroke, strokeWidth: active ? 2 : 1.5, strokeDasharray: dashed }),
            h('text', { x: x1 + 14, y: y - 8, fill: 'var(--dsw-alias-label-secondary)', fontSize: 11 }, edge.label ?? '')
          ))
          return
        }
        const direction = x2 >= x1 ? 1 : -1
        messages.push(h('g', { key: edge.id, onClick: event => { event.stopPropagation(); onSelect(edge.id) }, style: { cursor: 'pointer' } },
          h('line', { x1, y1: y, x2, y2: y, stroke: 'transparent', strokeWidth: 14 }),
          h('line', { x1, y1: y, x2, y2: y, stroke, strokeWidth: active ? 2 : 1.5, strokeDasharray: dashed, markerEnd: 'url(#bp-arrow)' }),
          h('text', { x: (x1 + x2) / 2, y: y - 7, textAnchor: 'middle', fill: 'var(--dsw-alias-label-secondary)', fontSize: 11 }, edge.label ?? ''),
          h('text', { x: x2 - direction * 10, y: y - 7, textAnchor: 'middle', fill: 'var(--dsw-alias-label-secondary)', fontSize: 9, opacity: 0.65 }, String(index + 1))
        ))
      })
      return h('g', { className: 'bp-sequence' },
        nodes.map(node => {
          const size = sizeOf(node)
          const x = (node.x ?? 0) + size.w / 2
          return h('line', {
            key: `life-${node.id}`, x1: x, y1: (node.y ?? 0) + size.h, x2: x, y2: bottom,
            stroke: 'var(--dsw-alias-border-l2)', strokeWidth: 1.2, strokeDasharray: '5 5',
          })
        }),
        messages)
    }

    function Canvas({ store }) {
      const bp = store.bp
      const diagram = bp?.diagrams.find(item => item.key === store.tab) ?? bp?.diagrams[0]
      const [view, setView] = useState({ x: 70, y: 30, zoom: 1 })
      const viewRef = useRef(view)
      viewRef.current = view
      const svgRef = useRef(null)
      const dragRef = useRef(null)
      const [, force] = useState(0)
      const [hoverPoint, setHoverPoint] = useState(null)

      useEffect(() => {
        setView(fitViewFor(diagram))
        setHoverPoint(null)
      }, [store.tab])

      if (diagram === undefined) return null

      const W = 2000
      const H = 1200
      const toSvg = event => {
        const rect = svgRef.current.getBoundingClientRect()
        return { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H }
      }
      const toWorld = event => {
        const point = toSvg(event)
        return { x: (point.x - viewRef.current.x) / viewRef.current.zoom, y: (point.y - viewRef.current.y) / viewRef.current.zoom }
      }

      const onBackgroundDown = event => {
        if (event.button !== 0) return
        const point = toSvg(event)
        dragRef.current = { type: 'pan', point, x: viewRef.current.x, y: viewRef.current.y }
        if (store.selected) set({ selected: null })
      }
      const onNodeDown = (node, event) => {
        event.stopPropagation()
        if (store.mode === 'connect') return
        const world = toWorld(event)
        const size = sizeOf(node)
        dragRef.current = { type: 'node', id: node.id, start: world, x: node.x ?? 0, y: node.y ?? 0, moved: false }
        set({ selected: { kind: 'node', id: node.id } })
        force(value => value + 1)
      }
      const onMove = event => {
        if (store.mode === 'connect') setHoverPoint(toWorld(event))
        const drag = dragRef.current
        if (drag === null) return
        if (drag.type === 'pan') {
          const point = toSvg(event)
          setView(value => ({ ...value, x: drag.x + (point.x - drag.point.x), y: drag.y + (point.y - drag.point.y) }))
          return
        }
        const world = toWorld(event)
        mutate(current => {
          const target = current.diagrams.find(item => item.key === store.tab)
          const node = target?.nodes.find(item => item.id === drag.id)
          if (node === undefined) return
          node.x = drag.x + (world.x - drag.start.x)
          node.y = drag.y + (world.y - drag.start.y)
        })
        drag.moved = true
      }
      const onUp = () => { dragRef.current = null }

      const onWheel = event => {
        event.preventDefault()
        const point = toSvg(event)
        const current = viewRef.current
        const factor = event.deltaY < 0 ? 1.1 : 0.9
        const zoom = Math.min(2.6, Math.max(0.32, current.zoom * factor))
        const worldX = (point.x - current.x) / current.zoom
        const worldY = (point.y - current.y) / current.zoom
        setView({ x: point.x - worldX * zoom, y: point.y - worldY * zoom, zoom })
      }

      const onNodeClick = (node, event) => {
        event.stopPropagation()
        if (store.mode === 'connect') {
          if (store.connectFrom === null) set({ connectFrom: node.id, selected: { kind: 'node', id: node.id } })
          else if (store.connectFrom === node.id) set({ connectFrom: null })
          else addEdge(store.connectFrom, node.id)
          return
        }
        set({ selected: { kind: 'node', id: node.id } })
      }

      const addEdge = (from, to) => {
        const id = `e${Date.now().toString(36)}`
        mutate(current => {
          const target = current.diagrams.find(item => item.key === store.tab)
          if (target === undefined) return
          const edge = { id, from, to, kind: defaultEdgeKind(store.tab) }
          if (store.tab === 'sequence') edge.order = (target.edges?.length ?? 0) + 1
          target.edges.push(edge)
        })
        set({ connectFrom: null, mode: 'select', selected: { kind: 'edge', id } })
      }

      const ordered = [...(diagram.nodes ?? [])].sort((a, b) => (a.type === 'system' ? -1 : b.type === 'system' ? 1 : 0))
      const zoom = view.zoom
      return h('div', { className: 'bp-canvas' },
        h('svg', {
          ref: svgRef,
          viewBox: `0 0 ${W} ${H}`,
          className: 'bp-canvas-svg',
          onPointerDown: onBackgroundDown,
          onPointerMove: onMove,
          onPointerUp: onUp,
          onPointerLeave: onUp,
          onWheel,
          onContextMenu: event => event.preventDefault(),
        },
          h('defs', null,
            h('pattern', { id: 'bp-grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' },
              h('path', { d: 'M24 0H0V24', fill: 'none', stroke: 'var(--dsw-alias-border-l1)', strokeWidth: 1, opacity: 0.45 })),
            h('marker', { id: 'bp-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
              h('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--dsw-alias-label-secondary)' }))),
          h('rect', { width: W, height: H, fill: 'transparent' }),
          h('g', { transform: `translate(${view.x} ${view.y}) scale(${zoom})` },
            diagram.key === 'sequence'
              ? h(SequenceLayer, {
                  diagram,
                  selectedId: store.selected?.kind === 'edge' ? store.selected.id : null,
                  onSelect: id => set({ selected: { kind: 'edge', id } }),
                })
              : (diagram.edges ?? []).map(edge => h(Edge, {
                  key: edge.id, diagram, edge,
                  selected: store.selected?.kind === 'edge' && store.selected.id === edge.id,
                  onSelect: () => set({ selected: { kind: 'edge', id: edge.id } }),
                })),
            ordered.map((node, index) => h(NodeShape, {
              key: node.id, node,
              diagramKey: diagram.key,
              index,
              selected: store.selected?.kind === 'node' && store.selected.id === node.id,
              onPointerDown: event => onNodeDown(node, event),
              onClick: event => onNodeClick(node, event),
            })),
            store.mode === 'connect' && store.connectFrom !== null && hoverPoint !== null ? (() => {
              const from = diagram.nodes.find(node => node.id === store.connectFrom)
              if (from === undefined) return null
              const size = sizeOf(from)
              return h('line', {
                x1: (from.x ?? 0) + size.w / 2, y1: (from.y ?? 0) + size.h / 2,
                x2: hoverPoint.x, y2: hoverPoint.y,
                stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.5, strokeDasharray: '6 4',
              })
            })() : null)),
        (diagram.nodes ?? []).length === 0 ? h('div', { className: 'bp-canvas-empty' }, t('emptyDiagram')) : null,
        h('div', { className: 'bp-canvas-hint' }, store.mode === 'connect' ? t('connectHint') : t('canvasHint')),
        h('div', { className: 'bp-zoom' },
          button('bp-ghost', () => setView(value => ({ ...value, zoom: Math.min(2.6, value.zoom * 1.15) })), h(Icon, { name: 'zoomIn', size: 15 }), { title: t('zoomIn') }),
          h('span', null, `${Math.round(zoom * 100)}%`),
          button('bp-ghost', () => setView(value => ({ ...value, zoom: Math.max(0.32, value.zoom / 1.15) })), h(Icon, { name: 'zoomOut', size: 15 }), { title: t('zoomOut') }),
          button('bp-ghost', () => setView(fitViewFor(diagram)), h(Icon, { name: 'expand', size: 15 }), { title: t('fit') })))
    }

    function Inspector({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const selected = store.selected
      const diagram = bp.diagrams.find(item => item.key === store.tab)
      const node = selected?.kind === 'node' ? diagram?.nodes.find(item => item.id === selected.id) : undefined
      const edge = selected?.kind === 'edge' ? diagram?.edges.find(item => item.id === selected.id) : undefined

      const updateNode = patchFn => mutate(current => {
        const target = current.diagrams.find(item => item.key === store.tab)
        const found = target?.nodes.find(item => item.id === selected.id)
        if (found !== undefined) patchFn(found)
      })
      const updateEdge = patchFn => mutate(current => {
        const target = current.diagrams.find(item => item.key === store.tab)
        const found = target?.edges.find(item => item.id === selected.id)
        if (found !== undefined) patchFn(found)
      })

      if (node !== undefined) {
        const isErEntity = store.tab === 'er' && node.type === 'entity'
        const isC4 = store.tab === 'c4'
        const edgeKinds = store.tab === 'sequence'
          ? ['sync', 'async', 'return']
          : store.tab === 'er'
            ? ['relationship']
            : store.tab === 'c4'
              ? ['uses', 'contains', 'realizes', 'depends']
              : ['association', 'include', 'extend', 'flow', 'depends']
        return h('div', { className: 'bp-inspector' },
          h('div', { className: 'bp-kicker' }, t('inspector')),
          h('label', { className: 'bp-field' }, h('span', null, t('nodeLabel')),
            h('input', { className: 'bp-input', value: node.label, onChange: event => updateNode(found => { found.label = event.target.value }) })),
          h('label', { className: 'bp-field' }, h('span', null, t('nodeType')),
            h('select', { className: 'bp-input', value: node.type, onChange: event => updateNode(found => {
              found.type = event.target.value
              const meta = TYPE_META[event.target.value]
              if (meta) { found.w = meta.w; found.h = meta.h }
            }) }, typesFor(store.tab).map(type => h('option', { key: type, value: type }, t(TYPE_META[type]?.label ?? type))))),
          isC4 ? h('label', { className: 'bp-field' }, h('span', null, t('technology')),
            h('input', { className: 'bp-input', value: node.technology ?? '', onChange: event => updateNode(found => { found.technology = event.target.value }) })) : null,
          node.type === 'system' || node.type === 'module' || node.type === 'usecase' || isC4
            ? h('label', { className: 'bp-field' }, h('span', null, t('notes')),
                h('textarea', { className: 'bp-input', rows: 3, value: node.description ?? '', onChange: event => updateNode(found => { found.description = event.target.value }) }))
            : null,
          isErEntity ? h('div', { className: 'bp-field' },
            h('span', null, t('fields')),
            h('div', { className: 'bp-fields' },
              (node.fields ?? []).map((field, index) => h('div', { className: 'bp-field-row', key: index },
                h('input', { className: 'bp-input bp-field-name', value: field.name, placeholder: t('fieldName'), onChange: event => updateNode(found => {
                  if (found.fields?.[index] !== undefined) found.fields[index].name = event.target.value
                }) }),
                h('input', { className: 'bp-input bp-field-type', value: field.type ?? '', placeholder: t('fieldType'), onChange: event => updateNode(found => {
                  if (found.fields?.[index] !== undefined) found.fields[index].type = event.target.value
                }) }),
                h('label', { className: 'bp-pk', title: t('primaryKey') },
                  h('input', { type: 'checkbox', checked: field.key === true, onChange: event => updateNode(found => {
                    if (found.fields?.[index] !== undefined) found.fields[index].key = event.target.checked
                  }) }), 'PK'),
                h('button', { type: 'button', className: 'bp-item-del', onClick: () => updateNode(found => {
                  found.fields = (found.fields ?? []).filter((_, itemIndex) => itemIndex !== index)
                  found.h = Math.max(96, 58 + (found.fields?.length ?? 0) * 19)
                }) }, h(Icon, { name: 'trash', size: 12 })))),
              h('button', { type: 'button', className: 'bp-btn bp-add-field', onClick: () => updateNode(found => {
                found.fields = [...(found.fields ?? []), { name: `field_${(found.fields?.length ?? 0) + 1}`, type: 'text' }]
                found.h = Math.max(96, 58 + (found.fields?.length ?? 0) * 19)
              }) }, h(Icon, { name: 'plus', size: 13 }), t('addField'))))
            : null,
          h('button', { className: 'bp-btn bp-danger', onClick: deleteSelection }, h(Icon, { name: 'trash', size: 14 }), t('deleteNode')))
      }
      if (edge !== undefined) {
        const edgeKinds = store.tab === 'sequence'
          ? ['sync', 'async', 'return']
          : store.tab === 'er'
            ? ['relationship']
            : store.tab === 'c4'
              ? ['uses', 'contains', 'realizes', 'depends']
              : ['association', 'include', 'extend', 'flow', 'depends']
        return h('div', { className: 'bp-inspector' },
          h('div', { className: 'bp-kicker' }, t('inspector')),
          h('label', { className: 'bp-field' }, h('span', null, store.tab === 'sequence' ? t('message') : t('edgeLabel')),
            h('input', { className: 'bp-input', value: edge.label ?? '', onChange: event => updateEdge(found => { found.label = event.target.value }) })),
          h('label', { className: 'bp-field' }, h('span', null, t('edgeKind')),
            h('select', { className: 'bp-input', value: edge.kind ?? defaultEdgeKind(store.tab), onChange: event => updateEdge(found => { found.kind = event.target.value }) },
              edgeKinds.map(kind => h('option', { key: kind, value: kind }, kind)))),
          store.tab === 'er' ? h('label', { className: 'bp-field' }, h('span', null, t('cardinality')),
            h('input', { className: 'bp-input', value: edge.cardinality ?? '', placeholder: '1..*', onChange: event => updateEdge(found => { found.cardinality = event.target.value }) })) : null,
          store.tab === 'sequence' ? h('label', { className: 'bp-field' }, h('span', null, t('order')),
            h('input', { className: 'bp-input', type: 'number', value: edge.order ?? 1, onChange: event => updateEdge(found => { found.order = Number(event.target.value) || 1 }) })) : null,
          store.tab === 'c4' ? h('label', { className: 'bp-field' }, h('span', null, t('technology')),
            h('input', { className: 'bp-input', value: edge.technology ?? '', onChange: event => updateEdge(found => { found.technology = event.target.value }) })) : null,
          h('button', { className: 'bp-btn bp-danger', onClick: deleteSelection }, h(Icon, { name: 'trash', size: 14 }), t('deleteEdge')))
      }
      return h('div', { className: 'bp-inspector bp-muted' }, t('noSelection'))
    }

    function deleteSelection() {
      const selected = state.selected
      if (selected === null) return
      mutate(current => {
        const diagram = current.diagrams.find(item => item.key === state.tab)
        if (diagram === undefined) return
        if (selected.kind === 'node') {
          diagram.nodes = diagram.nodes.filter(node => node.id !== selected.id)
          diagram.edges = diagram.edges.filter(edge => edge.from !== selected.id && edge.to !== selected.id)
        } else {
          diagram.edges = diagram.edges.filter(edge => edge.id !== selected.id)
        }
      })
      set({ selected: null })
    }

    function ModulePanel({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const selectModule = module => {
        const diagram = bp.diagrams.find(item => item.key === 'module')
        const node = diagram?.nodes.find(entry => entry.label === module.name || entry.id === module.id)
        if (node !== undefined) {
          set({ tab: 'module', selected: { kind: 'node', id: node.id }, mode: 'select' })
        }
      }
      return h('div', { className: 'bp-modules' },
        h('div', { className: 'bp-kicker' }, t('modules')),
        bp.modules.length === 0 ? h('div', { className: 'bp-muted' }, t('noModules')) : null,
        bp.modules.map(module => h('div', { className: 'bp-module', key: module.id, onClick: () => selectModule(module) },
          h('div', { className: 'bp-module-top' },
            h('strong', null, module.name),
            h('span', { className: `bp-chip bp-chip-${module.status ?? 'pending'}` }, moduleStatusLabel(module.status))),
          module.summary ? h('p', null, module.summary) : null,
          module.dependsOn?.length ? h('div', { className: 'bp-module-deps' }, `${t('dependsOn')}: ${module.dependsOn.join(', ')}`) : null)))
    }

    function BoardPanel({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const childById = new Map(store.children.map(child => [child.sessionId, child]))
      const openChild = child => {
        try {
          const ui = ctxRef?.get?.('uiWorkspace')
          if (ui?.openSession !== undefined) {
            ui.openSession({ kind: 'session', sessionId: child.sessionId })
            return
          }
        } catch {}
        toast(child.sessionId, 'info')
      }
      const copy = async child => {
        try { await navigator.clipboard.writeText(child.sessionId); toast(t('copyId'), 'success') } catch {}
      }
      return h('div', { className: 'bp-board' },
        h('div', { className: 'bp-panel-head' },
          h('div', { className: 'bp-kicker' }, t('children')),
          h('button', { type: 'button', className: 'bp-ghost bp-btn', onClick: loadChildren }, t('refresh'))),
        h('div', { className: 'bp-muted' }, t('boardHint')),
        store.children.length === 0
          ? h('div', { className: 'bp-muted bp-board-empty' }, t('noChildren'))
          : store.children.map(child => h('div', { className: 'bp-child', key: child.sessionId },
              h('div', { className: 'bp-child-top' },
                h('span', { className: `bp-run-dot${child.running ? ' running' : ''}` }),
                h('strong', null, child.running ? t('running') : t('idle')),
                h('span', { className: 'bp-child-time' }, new Date(child.updatedAt ?? Date.now()).toLocaleTimeString())),
              h('div', { className: 'bp-child-id' }, child.sessionId),
              h('div', { className: 'bp-child-actions' },
                h('button', { type: 'button', className: 'bp-btn', onClick: () => openChild(child) }, t('openSession')),
                h('button', { type: 'button', className: 'bp-btn', onClick: () => copy(child) }, t('copyId'))))),
        h('div', { className: 'bp-divider' }),
        h('div', { className: 'bp-kicker' }, t('modules')),
        bp.modules.length === 0 ? h('div', { className: 'bp-muted' }, t('noModules')) : null,
        bp.modules.map(module => h('div', { className: 'bp-module', key: module.id },
          h('div', { className: 'bp-module-top' },
            h('strong', null, module.name),
            h('span', { className: `bp-chip bp-chip-${module.status ?? 'pending'}` }, moduleStatusLabel(module.status))),
          module.summary ? h('p', null, module.summary) : null,
          module.subagentSessionId ? h('div', { className: 'bp-child-id' },
            childById.has(module.subagentSessionId) ? `${module.subagentSessionId} · ${childById.get(module.subagentSessionId).running ? t('running') : t('idle')}` : module.subagentSessionId) : null)))
    }

    function VersionsPanel({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const latest = store.versions[0]?.id ?? 'current'
      const [from, setFrom] = useState(latest)
      const [to, setTo] = useState('current')
      useEffect(() => {
        if (from === 'current' && store.versions[0] !== undefined) setFrom(store.versions[0].id)
      }, [store.versions.length])
      const options = [{ id: 'current', label: t('current') }, ...store.versions.map(version => ({ id: version.id, label: `${version.title} · ${new Date(version.at).toLocaleString()}` }))]
      const compare = () => compareVersions(from, to)
      return h('div', { className: 'bp-versions' },
        h('div', { className: 'bp-panel-head' },
          h('div', { className: 'bp-kicker' }, t('versions')),
          h('button', { type: 'button', className: 'bp-btn', onClick: snapshotVersion, title: t('saveSnapshotHint') }, h(Icon, { name: 'save', size: 14 }), t('snapshot'))),
        h('div', { className: 'bp-diff-picker' },
          h('label', null, h('span', null, t('diffBase')),
            h('select', { className: 'bp-input', value: from, onChange: event => setFrom(event.target.value) }, options.map(option => h('option', { key: option.id, value: option.id }, option.label)))),
          h('label', null, h('span', null, t('diffTarget')),
            h('select', { className: 'bp-input', value: to, onChange: event => setTo(event.target.value) }, options.map(option => h('option', { key: option.id, value: option.id }, option.label)))),
          h('button', { type: 'button', className: 'bp-btn bp-primary', onClick: compare }, t('compare'))),
        h('div', { className: 'bp-muted' }, store.versionsLoading ? t('waiting') : t('selectTwo')),
        store.versions.length === 0 ? h('div', { className: 'bp-muted bp-board-empty' }, t('noVersions')) : null,
        store.versions.map(version => h('div', { className: 'bp-version', key: version.id },
          h('div', { className: 'bp-version-top' },
            h('strong', null, version.title || t('current')),
            h('span', { className: `bp-chip bp-chip-${version.status ?? 'draft'}` }, statusLabel(version.status))),
          h('div', { className: 'bp-version-meta' },
            h('span', null, new Date(version.at).toLocaleString()),
            h('span', null, ` · ${version.source ?? 'agent'}`),
            version.label ? h('span', null, ` · ${version.label}`) : null),
          h('div', { className: 'bp-version-counts' },
            `${version.counts?.items ?? 0} 条需求 · ${version.counts?.nodes ?? 0} 节点 · ${version.counts?.edges ?? 0} 连线 · ${version.counts?.modules ?? 0} 模块`),
          h('div', { className: 'bp-child-actions' },
            h('button', { type: 'button', className: 'bp-btn', onClick: () => compareVersions(version.id, 'current') }, t('compare')),
            h('button', { type: 'button', className: 'bp-btn', onClick: () => restoreVersion(version.id) }, t('restore'))))))
    }

    function DiffPanel({ store }) {
      const diff = store.diff
      if (diff === null) return null
      const added = diff.totals?.added ?? 0
      const removed = diff.totals?.removed ?? 0
      const changed = diff.totals?.changed ?? 0
      return h('div', { className: 'bp-diff' },
        h('div', { className: 'bp-diff-head' },
          h('div', null,
            h('div', { className: 'bp-kicker' }, t('diffTitle')),
            h('strong', null, `${diff.before?.title || t('current')} → ${diff.after?.title || t('current')}`)),
          h('div', { className: 'bp-diff-totals' },
            h('span', { className: 'bp-plus' }, `+${added}`),
            h('span', { className: 'bp-minus' }, `−${removed}`),
            h('span', { className: 'bp-warn' }, `~${changed}`)),
          h('button', { type: 'button', className: 'bp-btn', onClick: () => set({ diff: null }) }, t('closeDiff'))),
        added + removed + changed === 0 ? h('div', { className: 'bp-empty-diff' }, t('diffEmpty')) : null,
        h('div', { className: 'bp-diff-grid' },
          h('section', null,
            h('h3', null, t('requirements')),
            diff.sections.length === 0 ? h('div', { className: 'bp-muted' }, '—') : null,
            diff.sections.map(section => h('div', { className: 'bp-diff-card', key: section.key },
              h('div', { className: 'bp-diff-card-head' },
                h('strong', null, section.title),
                h('span', null, `${section.before} → ${section.after}`)),
              section.sectionAdded ? h('div', { className: 'bp-plus' }, `+ ${t('added')}`) : null,
              section.sectionRemoved ? h('div', { className: 'bp-minus' }, `− ${t('removed')}`) : null,
              section.titleChanged ? h('div', { className: 'bp-warn' }, `${t('sectionTitleChanged')}: ${section.titleChanged.from} → ${section.titleChanged.to}`) : null,
              section.added.map((item, index) => h('div', { className: 'bp-diff-line bp-plus', key: `a-${index}` }, `+ ${item}`)),
              section.removed.map((item, index) => h('div', { className: 'bp-diff-line bp-minus', key: `r-${index}` }, `− ${item}`))))),
          h('section', null,
            h('h3', null, t('diagrams')),
            diff.diagrams.length === 0 ? h('div', { className: 'bp-muted' }, '—') : null,
            diff.diagrams.map(diagram => h('div', { className: 'bp-diff-card', key: diagram.key },
              h('div', { className: 'bp-diff-card-head' },
                h('strong', null, diagram.title),
                h('span', null, `+${diagram.addedNodes.length + diagram.addedEdges.length} / −${diagram.removedNodes.length + diagram.removedEdges.length}`)),
              diagram.diagramAdded ? h('div', { className: 'bp-plus' }, t('diagramMissing')) : null,
              diagram.diagramRemoved ? h('div', { className: 'bp-minus' }, t('diagramMissing')) : null,
              diagram.addedNodes.map(node => h('div', { className: 'bp-diff-line bp-plus', key: node.id }, `+ ${node.label} (${node.type})`)),
              diagram.removedNodes.map(node => h('div', { className: 'bp-diff-line bp-minus', key: node.id }, `− ${node.label} (${node.type})`)),
              diagram.changedNodes.map(node => h('div', { className: 'bp-diff-line bp-warn', key: node.id }, `~ ${node.label}`)),
              diagram.addedEdges.map(edge => h('div', { className: 'bp-diff-line bp-plus', key: edge.id }, `+ ${edge.from} → ${edge.to}`)),
              diagram.removedEdges.map(edge => h('div', { className: 'bp-diff-line bp-minus', key: edge.id }, `− ${edge.from} → ${edge.to}`))))),
          h('section', null,
            h('h3', null, t('modules')),
            diff.modules.added.map(module => h('div', { className: 'bp-diff-line bp-plus', key: module.id }, `+ ${module.name}`)),
            diff.modules.removed.map(module => h('div', { className: 'bp-diff-line bp-minus', key: module.id }, `− ${module.name}`)),
            diff.modules.changed.map(module => h('div', { className: 'bp-diff-card', key: module.id },
              h('strong', null, module.name),
              module.changes.map((change, index) => h('div', { className: 'bp-diff-line bp-warn', key: index },
                `~ ${change.field}: ${change.from || '—'} → ${change.to || '—'}`)))))))
    }

    function ImportDialog({ store }) {
      const [text, setText] = useState('')
      const [replace, setReplace] = useState(true)
      const [error, setError] = useState(null)
      const close = () => set({ importOpen: false })
      const run = () => {
        try {
          const parsed = parseDrawio(text, state.tab)
          if (parsed.nodes.length === 0) throw new Error('no vertices found')
          mutate(current => {
            const target = current.diagrams.find(item => item.key === state.tab)
            if (target === undefined) return
            if (replace) {
              target.nodes = parsed.nodes
              target.edges = parsed.edges
            } else {
              const stamp = Date.now().toString(36)
              const idMap = new Map()
              for (const node of parsed.nodes) {
                const next = { ...node, id: `${node.id}-${stamp}` }
                idMap.set(node.id, next.id)
                target.nodes.push(next)
              }
              for (const edge of parsed.edges) {
                target.edges.push({ ...edge, id: `${edge.id}-${stamp}`, from: idMap.get(edge.from), to: idMap.get(edge.to) })
              }
            }
          })
          set({ importOpen: false })
          toast(`Imported ${parsed.nodes.length} nodes, ${parsed.edges.length} edges`, 'success')
        } catch (failure) {
          setError(String(failure?.message ?? failure))
        }
      }
      return h('div', { className: 'bp-import-backdrop', onClick: close },
        h('div', { className: 'bp-import-dialog', onClick: event => event.stopPropagation() },
          h('div', { className: 'bp-kicker' }, t('importTitle')),
          h('p', { className: 'bp-muted' }, t('importHint')),
          h('textarea', {
            className: 'bp-input bp-import-text', rows: 9, value: text,
            placeholder: t('importPlaceholder'),
            onChange: event => { setText(event.target.value); setError(null) },
          }),
          h('div', { className: 'bp-import-row' },
            h('input', {
              type: 'file', accept: '.drawio,.xml,application/xml,text/xml',
              onChange: async event => {
                const file = event.target.files?.[0]
                if (file !== undefined) {
                  try { setText(await file.text()) } catch (failure) { setError(String(failure)) }
                }
              },
            }),
            h('label', { className: 'bp-check' },
              h('input', { type: 'checkbox', checked: replace, onChange: event => setReplace(event.target.checked) }),
              replace ? t('replaceDiagram') : t('appendDiagram'))),
          error ? h('div', { className: 'bp-error' }, error) : null,
          h('div', { className: 'bp-import-actions' },
            h('button', { type: 'button', className: 'bp-btn', onClick: close }, t('close')),
            h('button', { type: 'button', className: 'bp-btn bp-primary', disabled: text.trim() === '', onClick: run }, t('importAction')))))
    }

    function RightPanel({ store }) {
      const panel = store.panel ?? 'inspector'
      return h('aside', { className: 'bp-right' },
        h('div', { className: 'bp-panel-tabs' },
          h('button', { type: 'button', className: `bp-panel-tab${panel === 'inspector' ? ' active' : ''}`, onClick: () => set({ panel: 'inspector' }) }, t('inspector')),
          h('button', { type: 'button', className: `bp-panel-tab${panel === 'board' ? ' active' : ''}`, onClick: () => { set({ panel: 'board' }); loadChildren() } }, t('board')),
          h('button', { type: 'button', className: `bp-panel-tab${panel === 'versions' ? ' active' : ''}`, onClick: () => { set({ panel: 'versions' }); loadVersions() } }, t('versions'))),
        panel === 'board'
          ? h(BoardPanel, { store })
          : panel === 'versions'
            ? h(VersionsPanel, { store })
            : h(React.Fragment, null,
                h(Inspector, { store }),
                h('div', { className: 'bp-divider' }),
                h(ModulePanel, { store })))
    }

    function DiagramHeader({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const diagram = bp.diagrams.find(item => item.key === store.tab) ?? bp.diagrams[0]
      const tabName = key => ({
        usecase: t('usecase'), dfd: t('dfd'), module: t('module'), sequence: t('sequence'), er: t('er'), c4: t('c4'),
      }[key] ?? key)
      return h('div', { className: 'bp-diagram-head' },
        h('div', { className: 'bp-tabs' },
          bp.diagrams.map(item => h('button', {
            type: 'button', key: item.key,
            className: `bp-tab${store.tab === item.key ? ' active' : ''}`,
            title: item.title,
            onClick: () => set({ tab: item.key, selected: null, mode: 'select', connectFrom: null }),
          }, tabName(item.key), h('em', null, `${item.nodes.length}`)))),
        h('div', { className: 'bp-tools' },
          h('div', { className: 'bp-seg' },
            button(`bp-seg-btn${store.mode === 'select' ? ' active' : ''}`, () => set({ mode: 'select', connectFrom: null }), h(Icon, { name: 'cursor', size: 14 }), { title: t('select') }),
            button(`bp-seg-btn${store.mode === 'connect' ? ' active' : ''}`, () => set({ mode: store.mode === 'connect' ? 'select' : 'connect', connectFrom: null }), h(Icon, { name: 'connect', size: 14 }), { title: t('connect') })),
          h('div', { className: 'bp-seg' },
            typesFor(store.tab).map(type => h('button', {
              type: 'button', key: type, className: 'bp-seg-btn bp-add-type',
              title: `${t('addNode')} · ${t(TYPE_META[type].label)}`,
              onClick: () => addNode(store, type),
            }, h('span', { className: 'bp-type-dot', style: { background: TYPE_META[type].color } }), t(TYPE_META[type].label)))),
          h('button', { type: 'button', className: 'bp-btn bp-ghost bp-import', title: t('importDrawio'), onClick: () => set({ importOpen: true }) },
            h(Icon, { name: 'download', size: 15 }), h('span', { className: 'bp-import-label' }, t('importDrawio'))),
          button('bp-ghost', () => { layoutDiagram(diagram); mutate(() => {}); }, h(Icon, { name: 'layout', size: 15 }), { title: t('autoLayout') }),
          button('bp-ghost', () => expandDiagram(diagram), h(Icon, { name: 'spark', size: 15 }), { title: t('expandDiagram') })))
    }

    function addNode(store, type) {
      const bp = state.bp
      if (bp === null) return
      const diagram = bp.diagrams.find(item => item.key === state.tab)
      if (diagram === undefined) return
      const meta = TYPE_META[type] ?? TYPE_META.usecase
      const id = `n${Date.now().toString(36)}`
      const label = t(meta.label)
      mutate(current => {
        const target = current.diagrams.find(item => item.key === state.tab)
        if (target === undefined) return
        const sequence = state.tab === 'sequence'
        target.nodes.push({
          id, type, label,
          x: sequence ? 80 + target.nodes.length * 230 : 160 + (target.nodes.length % 4) * 40,
          y: sequence ? 64 : 120 + (target.nodes.length % 5) * 40,
          w: sequence ? (type === 'actor' ? 130 : 170) : meta.w,
          h: sequence ? (type === 'actor' ? 84 : 52) : meta.h,
          ...(state.tab === 'er' && type === 'entity' ? { fields: [{ name: 'id', type: 'uuid', key: true }] } : {}),
        })
      })
      set({ selected: { kind: 'node', id }, mode: 'select' })
    }

    function exportJSON() {
      const bp = state.bp
      if (bp === null) return
      download(`${bp.id ?? 'blueprint'}.json`, JSON.stringify(bp, null, 2), 'application/json;charset=utf-8')
    }

    function exportMermaid() {
      const bp = state.bp
      if (bp === null) return
      const parts = []
      for (const diagram of bp.diagrams) {
        if (diagram.key === 'sequence') {
          const lines = ['sequenceDiagram']
          for (const node of diagram.nodes) lines.push(`  participant ${node.id} as ${node.label}`)
          for (const edge of [...diagram.edges].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
            const arrow = edge.kind === 'return' ? '-->>' : edge.kind === 'async' ? '-)' : '->>'
            lines.push(`  ${edge.from}${arrow}${edge.to}: ${(edge.label ?? '').replace(/\n/g, ' ')}`)
          }
          parts.push(`%% ${diagram.title}\n${lines.join('\n')}`)
          continue
        }
        if (diagram.key === 'er') {
          const lines = ['erDiagram']
          for (const node of diagram.nodes.filter(item => item.type === 'entity')) {
            lines.push(`  ${node.id} {`)
            for (const field of node.fields ?? []) lines.push(`    ${field.type ?? 'string'} ${field.name}${field.key ? ' PK' : ''}`)
            lines.push('  }')
          }
          for (const edge of diagram.edges) lines.push(`  ${edge.from} ||--o{ ${edge.to} : "${(edge.label ?? 'rel').replace(/"/g, '')}"`)
          parts.push(`%% ${diagram.title}\n${lines.join('\n')}`)
          continue
        }
        const header = diagram.key === 'module' || diagram.key === 'c4' ? 'graph TD' : 'flowchart LR'
        const lines = [`%% ${diagram.title}`, header]
        for (const node of diagram.nodes) {
          const label = String(node.label).replace(/["\n]/g, ' ')
          if (node.type === 'actor' || node.type === 'person') lines.push(`  ${node.id}(["${label}"])`)
          else if (node.type === 'process' || node.type === 'usecase') lines.push(`  ${node.id}(("${label}"))`)
          else if (node.type === 'store' || node.type === 'database') lines.push(`  ${node.id}[("${label}")]`)
          else lines.push(`  ${node.id}["${label}"]`)
        }
        for (const edge of diagram.edges) {
          const label = edge.label ? `|${String(edge.label).replace(/[|\n]/g, ' ')}|` : ''
          lines.push(`  ${edge.from} -->${label} ${edge.to}`)
        }
        parts.push(lines.join('\n'))
      }
      download(`${bp.id ?? 'blueprint'}.mmd`, parts.join('\n\n'), 'text/plain;charset=utf-8')
    }

    function xmlEscape(value) {
      return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    function drawioStyle(node) {
      if (node.type === 'actor') return 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;'
      if (node.type === 'usecase') return 'ellipse;whiteSpace=wrap;html=1;'
      if (node.type === 'process') return 'ellipse;whiteSpace=wrap;html=1;'
      if (node.type === 'store') return 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;'
      if (node.type === 'database') return 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;'
      if (node.type === 'system' && node.w > 300) return 'swimlane;whiteSpace=wrap;html=1;'
      if (node.type === 'relationship') return 'rhombus;whiteSpace=wrap;html=1;'
      if (node.type === 'person') return 'shape=actor;whiteSpace=wrap;html=1;'
      if (node.type === 'external') return 'rounded=1;dashed=1;whiteSpace=wrap;html=1;'
      if (node.type === 'container' || node.type === 'component') return 'rounded=1;whiteSpace=wrap;html=1;'
      return 'rounded=1;whiteSpace=wrap;html=1;'
    }

    function exportDrawio() {
      const bp = state.bp
      const diagram = bp?.diagrams.find(item => item.key === state.tab)
      if (bp === null || diagram === undefined) return
      const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
      for (const node of diagram.nodes) {
        const size = sizeOf(node)
        const fields = (node.fields ?? []).map(field => `${field.key ? 'PK ' : ''}${field.name}${field.type ? `: ${field.type}` : ''}`).join('\n')
        const label = xmlEscape([node.label, fields].filter(Boolean).join('\n'))
        cells.push(`<mxCell id="${xmlEscape(node.id)}" value="${label}" style="${drawioStyle(node)}" vertex="1" parent="1"><mxGeometry x="${Math.round(node.x ?? 0)}" y="${Math.round(node.y ?? 0)}" width="${Math.round(size.w)}" height="${Math.round(size.h)}" as="geometry"/></mxCell>`)
      }
      for (const edge of diagram.edges) {
        cells.push(`<mxCell id="${xmlEscape(edge.id)}" value="${xmlEscape(edge.label ?? '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;${edge.kind === 'depends' || edge.kind === 'return' ? 'dashed=1;' : ''}" edge="1" parent="1" source="${xmlEscape(edge.from)}" target="${xmlEscape(edge.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`)
      }
      const xml = `<mxfile host="dsh-blueprint-studio"><diagram name="${xmlEscape(diagram.title)}" id="bp-${Date.now().toString(36)}"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
      download(`${bp.id ?? 'blueprint'}-${diagram.key}.drawio`, xml, 'application/xml;charset=utf-8')
    }

    function drawioTypeFor(style, diagramKey) {
      const value = String(style ?? '').toLowerCase()
      if (diagramKey === 'sequence') return 'participant'
      if (diagramKey === 'er') return value.includes('rhombus') ? 'relationship' : 'entity'
      if (diagramKey === 'c4') {
        if (value.includes('actor') || value.includes('person')) return 'person'
        if (value.includes('cylinder') || value.includes('database')) return 'database'
        if (value.includes('component')) return 'component'
        if (value.includes('swimlane')) return 'system'
        return 'container'
      }
      if (value.includes('actor')) return 'actor'
      if (value.includes('rhombus')) return diagramKey === 'er' ? 'relationship' : 'module'
      if (value.includes('cylinder') || value.includes('database')) return 'store'
      if (value.includes('ellipse')) return diagramKey === 'dfd' ? 'process' : diagramKey === 'usecase' ? 'usecase' : 'module'
      if (value.includes('swimlane')) return diagramKey === 'usecase' ? 'system' : 'module'
      if (diagramKey === 'dfd') return 'process'
      if (diagramKey === 'usecase') return 'usecase'
      return 'module'
    }

    function decodeDrawioLabel(value) {
      const area = document.createElement('textarea')
      area.innerHTML = String(value ?? '')
      return area.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    function parseDrawio(text, diagramKey) {
      const doc = new DOMParser().parseFromString(text, 'text/xml')
      if (doc.querySelector('parsererror') !== null) throw new Error('XML parse error')
      const cells = [...doc.querySelectorAll('mxCell')]
      const geomOf = cell => cell.querySelector('mxGeometry')
      const idMap = new Map()
      const nodes = []
      for (const cell of cells) {
        if (cell.getAttribute('vertex') !== '1') continue
        const id = cell.getAttribute('id')
        if (id === null) continue
        const wrapper = cell.closest('UserObject, object')
        const label = decodeDrawioLabel(wrapper?.getAttribute('label') ?? cell.getAttribute('value'))
        if (label === '') continue
        const geometry = geomOf(cell)
        const style = cell.getAttribute('style') ?? ''
        const type = drawioTypeFor(style, diagramKey)
        const node = {
          id: `dw-${id}`,
          type,
          label,
          x: Number(geometry?.getAttribute('x') ?? 80),
          y: Number(geometry?.getAttribute('y') ?? 80),
          w: Number(geometry?.getAttribute('width') ?? TYPE_META[type]?.w ?? 160),
          h: Number(geometry?.getAttribute('height') ?? TYPE_META[type]?.h ?? 60),
        }
        nodes.push(node)
        idMap.set(id, node.id)
      }
      const edges = []
      for (const cell of cells) {
        if (cell.getAttribute('edge') !== '1') continue
        const source = idMap.get(cell.getAttribute('source'))
        const target = idMap.get(cell.getAttribute('target'))
        if (source === undefined || target === undefined) continue
        const wrapper = cell.closest('UserObject, object')
        const label = decodeDrawioLabel(wrapper?.getAttribute('label') ?? cell.getAttribute('value'))
        const edge = {
          id: `dwe-${cell.getAttribute('id') ?? edges.length}`,
          from: source,
          to: target,
          kind: diagramKey === 'sequence' ? 'sync' : diagramKey === 'er' ? 'relationship' : defaultEdgeKind(diagramKey),
        }
        if (label !== '') edge.label = label
        if (diagramKey === 'sequence') edge.order = edges.length + 1
        edges.push(edge)
      }
      return { nodes, edges }
    }

    function exportSVG() {
      const svg = document.querySelector('.bp-canvas-svg')
      if (svg === null) return
      const clone = svg.cloneNode(true)
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', '2000')
      clone.setAttribute('height', '1200')
      const replacements = {
        'var(--dsw-alias-bg-base)': '#ffffff',
        'var(--dsw-alias-bg-layer-1)': '#ffffff',
        'var(--dsw-alias-bg-layer-2)': '#f3f4f6',
        'var(--dsw-alias-label-primary)': '#111827',
        'var(--dsw-alias-label-secondary)': '#6b7280',
        'var(--dsw-alias-border-l1)': '#e5e7eb',
        'var(--dsw-alias-border-l2)': '#d1d5db',
        'var(--dsw-alias-brand-primary)': '#2563eb',
      }
      clone.querySelectorAll('*').forEach(element => {
        for (const attribute of ['fill', 'stroke']) {
          let value = element.getAttribute(attribute)
          if (value === null) continue
          if (value.startsWith('color-mix')) value = '#f3f4f6'
          for (const [from, to] of Object.entries(replacements)) value = value.split(from).join(to)
          element.setAttribute(attribute, value)
        }
      })
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = 'text{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}.bp-canvas-label{fill:#111827}'
      clone.insertBefore(style, clone.firstChild)
      const bp = state.bp
      download(`${bp?.id ?? 'blueprint'}.svg`, new XMLSerializer().serializeToString(clone), 'image/svg+xml;charset=utf-8')
    }

    async function expandSection(section) {
      try {
        await sendPrompt(expandSectionPrompt(section), 'expanding')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }
    async function expandDiagram(diagram) {
      try {
        await sendPrompt(expandDiagramPrompt(diagram), 'expanding')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }
    async function regenerate() {
      const bp = state.bp
      try {
        const task = bp?.prompt?.trim() || bp?.title || ''
        if (task === '') return
        await sendPrompt(generatePrompt(task), 'generating')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }
    async function dispatch() {
      const bp = state.bp
      if (bp === null) return
      if (bp.modules.length === 0) { toast(t('dispatchBlocked'), 'error'); return }
      try {
        mutate(current => { current.status = 'confirmed' })
        const ok = await saveBlueprint({ silent: true })
        if (!ok) return
        await sendPrompt(dispatchPrompt(), 'dispatching')
        mutate(current => { current.status = 'dispatched' })
        await saveBlueprint({ silent: true })
        toast(t('dispatching'), 'success')
      } catch (error) {
        toast(String(error?.message ?? error), 'error')
      }
    }

    function Header({ store }) {
      const bp = store.bp
      const busy = store.aiBusy !== null
      return h('header', { className: 'bp-header' },
        h('div', { className: 'bp-brand' },
          h('div', { className: 'bp-logo' }, h(Icon, { name: 'blueprint', size: 18 })),
          h('div', null,
            h('div', { className: 'bp-brand-title' }, t('title')),
            h('div', { className: 'bp-brand-sub' }, bp?.title || t('subtitle')))),
        bp !== null ? h('div', { className: 'bp-status' },
          h('span', { className: `bp-status-dot ${bp.status ?? 'draft'}` }),
          h('span', null, statusLabel(bp.status)),
          h('span', { className: 'bp-sep' }, '·'),
          h('span', { className: 'bp-muted' }, store.dirty ? t('unsaved') : t('saved'))) : null,
        h('div', { className: 'bp-actions' },
          bp !== null && !store.landing ? button('bp-ghost bp-back', backToStart, h(React.Fragment, null, h(Icon, { name: 'back', size: 15 }), h('span', { className: 'bp-back-label' }, t('backToStart'))), { title: t('backToStart') }) : null,
          bp !== null && !store.landing ? button('bp-ghost', undoBlueprint, h(Icon, { name: 'undo', size: 15 }), { title: `${t('undo')} · Ctrl+Z`, disabled: !store.canUndo }) : null,
          bp !== null && !store.landing ? button('bp-ghost', redoBlueprint, h(Icon, { name: 'redo', size: 15 }), { title: `${t('redo')} · Ctrl+Y`, disabled: !store.canRedo }) : null,
          bp !== null && !store.landing ? button('bp-ghost', () => saveBlueprint({ silent: false }), h(Icon, { name: 'save', size: 15 }), { title: `${t('save')} · ${t('saveHint')}`, disabled: store.saving || !store.dirty }) : null,
          bp !== null && !store.landing ? button('bp-ghost', regenerate, h(Icon, { name: 'spark', size: 15 }), { title: t('regenerate'), disabled: busy }) : null,
          bp !== null && !store.landing ? h('details', { className: 'bp-menu' },
            h('summary', { className: 'bp-btn' }, h(Icon, { name: 'download', size: 15 }), t('export')),
            h('div', { className: 'bp-menu-pop' },
              h('button', { type: 'button', onClick: exportJSON }, t('exportJSON')),
              h('button', { type: 'button', onClick: exportMermaid }, t('exportMermaid')),
              h('button', { type: 'button', onClick: exportSVG }, t('exportSVG')),
              h('button', { type: 'button', onClick: exportDrawio }, t('exportDrawio')))) : null,
          bp !== null && !store.landing ? h('button', {
            type: 'button',
            className: 'bp-btn bp-primary',
            disabled: busy || bp.modules.length === 0,
            title: bp.modules.length === 0 ? t('dispatchBlocked') : t('confirmHint'),
            onClick: dispatch,
          }, h(Icon, { name: 'send', size: 15 }), bp.status === 'dispatched' ? t('dispatching') : t('confirmDispatch')) : null,
          button('bp-close', closeStudio, h(Icon, { name: 'close', size: 17 }), { title: t('close') })))
    }

    class StudioBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error, info) {
        try { console.error('blueprint studio crashed', error, info) } catch {}
      }
      render() {
        if (this.state.error !== null) {
          return h('div', { className: 'bp-root' },
            h('style', null, CSS),
            h('div', { className: 'bp-backdrop', onClick: closeStudio }),
            h('div', { className: 'bp-shell', style: { padding: 24, gap: 12 } },
              h('h2', null, t('title')),
              h('div', { className: 'bp-error' }, String(this.state.error?.stack ?? this.state.error?.message ?? this.state.error)),
              h('button', { type: 'button', className: 'bp-btn', onClick: () => this.setState({ error: null }) }, t('reload')),
              h('button', { type: 'button', className: 'bp-btn', onClick: closeStudio }, t('close'))))
        }
        return h(Studio, this.props)
      }
    }

    function Studio() {
      const store = useStore()
      useEffect(() => {
        if (!store.open) return
        const timer = setInterval(() => {
          if (!state.dirty && state.aiBusy === null) loadBlueprint()
        }, 2600)
        return () => clearInterval(timer)
      }, [store.open, store.sessionId])

      useEffect(() => {
        if (!store.open) return
        loadChildren()
        if (state.panel === 'versions') loadVersions()
        const timer = setInterval(() => {
          loadChildren()
          if (state.panel === 'versions') loadVersions()
        }, 5000)
        return () => clearInterval(timer)
      }, [store.open, store.sessionId, store.panel])

      useEffect(() => {
        if (!store.open) return
        const onKey = event => {
          const tag = event.target?.tagName
          const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable
          if (state.landing) {
            if (event.key === 'Escape') closeStudio()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            if (state.selected) set({ selected: null, connectFrom: null, mode: 'select' })
            else closeStudio()
            return
          }
          const command = event.metaKey || event.ctrlKey
          if (command && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            if (event.shiftKey) redoBlueprint()
            else undoBlueprint()
            return
          }
          if (command && event.key.toLowerCase() === 'y') {
            event.preventDefault()
            redoBlueprint()
            return
          }
          if (command && event.key.toLowerCase() === 's') {
            event.preventDefault()
            saveBlueprint({ silent: false })
            return
          }
          if (editing) return
          if ((event.key === 'Delete' || event.key === 'Backspace') && state.selected) {
            event.preventDefault()
            deleteSelection()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [store.open, store.selected])

      if (!store.open) return null
      const bp = store.bp
      return h('div', { className: 'bp-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
        h('style', null, CSS),
        h('div', { className: 'bp-backdrop', onClick: closeStudio }),
        h('div', { className: 'bp-shell', onClick: event => event.stopPropagation() },
          h(Header, { store }),
          store.loading && bp === null ? h('div', { className: 'bp-loading' }, h('span', { className: 'bp-spinner' }), t('waiting')) : null,
          (store.landing || bp === null) && !store.loading ? h(EmptyState) : null,
          !store.landing && bp !== null ? h('div', { className: 'bp-body' },
            h(LeftPanel, { store }),
            h('main', { className: 'bp-main' },
              h(DiagramHeader, { store }),
              store.diff !== null ? h(DiffPanel, { store }) : h(Canvas, { store }),
              store.diff === null ? h('div', { className: 'bp-main-foot' },
                h('span', null, `${bp.diagrams.length} ${t('allDiagrams')}`),
                h('span', { className: 'bp-sep' }, '·'),
                h('span', null, t('lastSaved') + ' ' + new Date(bp.updatedAt ?? Date.now()).toLocaleTimeString())) : null),
            h(RightPanel, { store })) : null,
          store.aiBusy !== null ? h('div', { className: 'bp-ai-strip' }, h('span', { className: 'bp-spinner' }),
            store.aiBusy === 'generating' ? t('generating') : store.aiBusy === 'dispatching' ? t('dispatching') : t('expanding'),
            h('button', { type: 'button', className: 'bp-link', onClick: () => set({ aiBusy: null }) }, t('close'))) : null,
          store.remoteUpdated && store.dirty ? h('div', { className: 'bp-conflict' },
            h('span', null, t('aiUpdated')),
            h('button', { type: 'button', className: 'bp-btn', onClick: () => loadBlueprint({ initial: true }) }, t('reload'))) : null,
          store.error ? h('div', { className: 'bp-error-bar' }, store.error) : null,
          store.importOpen ? h(ImportDialog, { store }) : null,
          store.toast ? h('div', { className: `bp-toast ${store.toast.tone}` }, store.toast.message) : null))
    }

    const CSS = `
.bp-root{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;pointer-events:auto;font-family:inherit;color:var(--dsw-alias-label-primary)}
.bp-backdrop{position:absolute;inset:0;background:rgba(8,12,20,.52);backdrop-filter:blur(2px)}
.bp-shell{position:relative;display:flex;flex-direction:column;width:min(1500px,96vw);height:min(940px,92vh);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.35);overflow:hidden}
.bp-header{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:0 0 auto}
.bp-brand{display:flex;align-items:center;gap:10px;min-width:220px}
.bp-logo{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}
.bp-brand-title{font-size:14px;font-weight:650;letter-spacing:.01em}
.bp-brand-sub{font-size:12px;color:var(--dsw-alias-label-secondary);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-status{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.bp-status-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.bp-status-dot.confirmed{background:var(--dsw-alias-state-warn-primary)}
.bp-status-dot.dispatched{background:var(--dsw-alias-state-success-primary)}
.bp-sep{opacity:.5}
.bp-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
.bp-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
.bp-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.bp-btn:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay)}
.bp-btn:disabled{opacity:.45;cursor:not-allowed}
.bp-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.bp-primary:hover{background:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.bp-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.bp-ghost:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
.bp-close{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.bp-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-body{display:flex;flex:1;min-height:0}
.bp-left{width:330px;flex:0 0 330px;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;min-height:0}
.bp-left-head{padding:14px 14px 8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.bp-kicker{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin-bottom:8px}
.bp-title-input{width:100%;box-sizing:border-box;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;font-weight:650;padding:4px 6px;border-radius:7px}
.bp-title-input:hover,.bp-title-input:focus{border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);outline:none}
.bp-summary-input{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.5;resize:vertical;padding:4px 6px;border-radius:7px}
.bp-summary-input:hover,.bp-summary-input:focus{border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);outline:none}
.bp-sections{overflow:auto;padding:8px 10px 18px;flex:1}
.bp-section{border-bottom:1px solid var(--dsw-alias-border-l1);padding:6px 0 8px}
.bp-section-head{display:flex;align-items:center;gap:4px}
.bp-section-title{flex:1;display:flex;align-items:center;gap:6px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-weight:600;padding:6px 4px;cursor:pointer;text-align:left}
.bp-section-title em{font-style:normal;color:var(--dsw-alias-label-secondary);font-weight:400;font-size:11px;margin-left:auto}
.bp-caret{display:inline-block;transition:transform .12s;color:var(--dsw-alias-label-secondary);font-size:10px}
.bp-caret.open{transform:rotate(90deg)}
.bp-section-tools{display:flex;gap:2px}
.bp-section-tools .bp-btn{width:26px;height:26px;padding:0;justify-content:center}
.bp-item{display:flex;align-items:flex-start;gap:4px;margin:2px 0}
.bp-item-input{flex:1;box-sizing:border-box;resize:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;padding:5px 7px;border-radius:7px;overflow:hidden}
.bp-item-input:hover,.bp-item-input:focus{border-color:var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);outline:none}
.bp-item-del{opacity:0;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:4px;border-radius:6px}
.bp-item:hover .bp-item-del{opacity:1}
.bp-item-del:hover{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2)}
.bp-add-row{margin-top:6px}
.bp-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:6px 8px;border-radius:7px;outline:none}
.bp-input:focus{border-color:var(--dsw-alias-brand-primary)}
.bp-add-section{display:flex;align-items:center;gap:6px;margin:10px 0 0;border:1px dashed var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:7px 10px;border-radius:8px;cursor:pointer;width:100%}
.bp-add-section:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
.bp-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.bp-diagram-head{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.bp-tabs{display:flex;gap:4px}
.bp-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;padding:6px 10px;border-radius:8px;cursor:pointer}
.bp-tab:hover{background:var(--dsw-alias-bg-layer-2)}
.bp-tab.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-weight:600}
.bp-tab em{font-style:normal;font-size:10.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:0 5px}
.bp-tools{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.bp-seg{display:flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.bp-seg-btn{display:inline-flex;align-items:center;gap:5px;border:0;border-right:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:5px 8px;cursor:pointer}
.bp-seg-btn:last-child{border-right:0}
.bp-seg-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-seg-btn.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary)}
.bp-add-type{font-size:11px}
.bp-type-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.bp-canvas{position:relative;flex:1;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base)}
.bp-canvas-svg{width:100%;height:100%;display:block;touch-action:none;user-select:none}
.bp-canvas-label{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}
.bp-node.selected{filter:drop-shadow(0 0 0 rgba(0,0,0,0))}
.bp-canvas-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:13px;pointer-events:none;text-align:center;padding:20px}
.bp-canvas-hint{position:absolute;left:12px;bottom:10px;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.8;pointer-events:none}
.bp-zoom{position:absolute;right:12px;bottom:8px;display:flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);padding:2px}
.bp-zoom .bp-btn{width:26px;height:26px;padding:0;justify-content:center}
.bp-zoom span{font-size:11px;color:var(--dsw-alias-label-secondary);min-width:38px;text-align:center}
.bp-right{width:292px;flex:0 0 292px;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);overflow:auto;padding:14px}
.bp-inspector .bp-field{display:block;margin-bottom:10px}
.bp-field span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.bp-field textarea{resize:vertical}
.bp-inspector .bp-danger{margin-top:4px}
.bp-divider{height:1px;background:var(--dsw-alias-border-l1);margin:16px 0}
.bp-modules{display:flex;flex-direction:column;gap:8px}
.bp-module{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 10px;cursor:pointer}
.bp-module:hover{border-color:var(--dsw-alias-border-l2)}
.bp-module-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.bp-module strong{font-size:12.5px}
.bp-module p{margin:5px 0 0;font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.bp-module-deps{margin-top:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.85}
.bp-chip{font-size:10px;padding:1px 6px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.bp-chip-confirmed{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,transparent)}
.bp-chip-dispatched,.bp-chip-done{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}
.bp-main-foot{display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-secondary)}
.bp-loading{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:13px}
.bp-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:bp-spin .8s linear infinite;display:inline-block}
@keyframes bp-spin{to{transform:rotate(360deg)}}
.bp-empty{flex:1;display:grid;place-items:center;padding:24px;overflow:auto}
.bp-empty-card{width:min(640px,100%);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:18px;padding:28px;box-shadow:0 16px 50px rgba(0,0,0,.12)}
.bp-empty-icon{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);margin-bottom:14px}
.bp-empty h2{margin:0 0 6px;font-size:19px;letter-spacing:-.01em}
.bp-empty p{margin:0 0 14px;font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary)}
.bp-empty-input{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.55;padding:10px 12px;border-radius:10px;resize:vertical;outline:none}
.bp-empty-input:focus{border-color:var(--dsw-alias-brand-primary)}
.bp-templates{margin-top:12px}
.bp-templates-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.bp-templates-head strong{font-size:11px;font-weight:650}
.bp-templates-head span{font-size:10.5px;opacity:.8}
.bp-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px}
.bp-template-card{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}
.bp-template-card:hover,.bp-template-card:focus-visible{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);outline:none}
.bp-template-card strong{font-size:12px;font-weight:600}
.bp-template-card span{font-size:10.5px;line-height:1.4;color:var(--dsw-alias-label-secondary)}
.bp-empty-actions{display:flex;gap:8px;margin-top:12px;align-items:center}
.bp-waiting{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.bp-error{color:var(--dsw-alias-state-error-primary);font-size:12px;margin-top:10px;white-space:pre-wrap}
.bp-error-bar{padding:6px 14px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px}
.bp-ai-strip{display:flex;align-items:center;gap:8px;padding:7px 14px;border-top:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent);font-size:12px;color:var(--dsw-alias-label-secondary)}
.bp-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;cursor:pointer;margin-left:auto}
.bp-conflict{display:flex;align-items:center;gap:8px;padding:7px 14px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent);font-size:12px;color:var(--dsw-alias-label-secondary)}
.bp-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:8px 14px;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
.bp-toast.error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.bp-toast.success{border-color:var(--dsw-alias-state-success-primary)}
.bp-menu{position:relative}
.bp-menu summary{list-style:none;cursor:pointer}
.bp-menu summary::-webkit-details-marker{display:none}
.bp-menu-pop{position:absolute;right:0;top:36px;z-index:5;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:5px;min-width:160px;box-shadow:0 12px 32px rgba(0,0,0,.2)}
.bp-menu-pop button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:7px 9px;border-radius:6px;cursor:pointer}
.bp-menu-pop button:hover{background:var(--dsw-alias-bg-layer-2)}
.bp-open{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;position:relative}
.bp-open:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-open.bp-has{color:var(--dsw-alias-brand-primary)}
.bp-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);display:inline-block}
.bp-panel-tabs{display:flex;gap:3px;margin-bottom:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px;background:var(--dsw-alias-bg-base)}
.bp-panel-tab{flex:1;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:5px 4px;border-radius:6px;cursor:pointer}
.bp-panel-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.bp-panel-tab.active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:650}
.bp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.bp-fields{display:flex;flex-direction:column;gap:4px}
.bp-field-row{display:flex;align-items:center;gap:3px}
.bp-field-name{flex:1.2;min-width:0;padding:4px 6px}
.bp-field-type{flex:0.8;min-width:0;padding:4px 6px}
.bp-pk{display:flex;align-items:center;gap:2px;font-size:9.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.bp-pk input{width:11px;height:11px;margin:0}
.bp-add-field{width:100%;justify-content:center;margin-top:4px;height:26px;font-size:11px}
.bp-board,.bp-versions{display:flex;flex-direction:column;gap:8px}
.bp-board-empty{margin:8px 0}
.bp-child{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 9px}
.bp-child-top{display:flex;align-items:center;gap:6px;font-size:11.5px}
.bp-child-time{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:10.5px}
.bp-run-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}
.bp-run-dot.running{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent)}
.bp-child-id{margin-top:4px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-child-actions{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}
.bp-child-actions .bp-btn{height:24px;font-size:10.5px;padding:0 7px}
.bp-version{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 9px}
.bp-version-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.bp-version-top strong{font-size:12px}
.bp-version-meta{display:flex;gap:2px;flex-wrap:wrap;margin-top:3px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.bp-version-counts{margin-top:4px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.bp-diff-picker{display:flex;flex-direction:column;gap:5px}
.bp-diff-picker label{display:flex;flex-direction:column;gap:3px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.bp-diff-picker select{padding:5px 6px}
.bp-import{cursor:pointer}
.bp-diff{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;padding:14px 16px;background:var(--dsw-alias-bg-base)}
.bp-diff-head{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.bp-diff-head>div:first-child{display:flex;flex-direction:column;gap:2px}
.bp-diff-totals{margin-left:auto;display:flex;gap:8px;font-size:12px;font-weight:650}
.bp-plus{color:var(--dsw-alias-state-success-primary)}
.bp-minus{color:var(--dsw-alias-state-error-primary)}
.bp-warn{color:var(--dsw-alias-state-warn-primary)}
.bp-diff-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px;align-items:start}
.bp-diff-grid section{min-width:0}
.bp-diff-grid h3{font-size:12px;margin:0 0 8px;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.08em}
.bp-diff-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 8px;margin-bottom:6px}
.bp-diff-card-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px;font-size:11px}
.bp-diff-line{font-size:10.5px;line-height:1.45;word-break:break-word}
.bp-empty-diff{padding:20px 0;color:var(--dsw-alias-label-secondary);font-size:12px}
.bp-tabs{max-width:100%;overflow-x:auto;scrollbar-width:thin}
.bp-tab{white-space:nowrap}
.bp-import-backdrop{position:absolute;inset:0;background:rgba(8,12,20,.45);display:flex;align-items:center;justify-content:center;z-index:10}
.bp-import-dialog{width:min(680px,90%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:8px}
.bp-import-dialog p{margin:0}
.bp-import-text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.4;resize:vertical}
.bp-import-row{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}
.bp-check{display:flex;align-items:center;gap:4px}
.bp-check input{width:12px;height:12px;margin:0}
.bp-import-actions{display:flex;gap:6px;justify-content:flex-end}
.bp-back-label{font-size:11.5px}
@media (max-width:1400px){.bp-back-label{display:none}}
@media (max-width:1180px){.bp-right{display:none}.bp-left{width:300px;flex-basis:300px}}
@media (max-width:860px){.bp-left{display:none}.bp-shell{width:100vw;height:100vh;border-radius:0}.bp-open-label{display:none}}
@media (max-width:520px){.bp-empty-card{padding:20px}.bp-template-grid{grid-template-columns:1fr 1fr}}
@media (prefers-reduced-motion:reduce){.bp-spinner{animation:none}}
`

    function apply(ctx) {
      ctxRef = ctx
      try {
        dict = currentLocaleId().toLowerCase().startsWith('zh') ? ZH : EN
      } catch {
        dict = ZH
      }
      try {
        if (ctx.locale?.register) {
          ctx.locale.register(NS, 'en', EN)
          ctx.locale.register(NS, 'zh', ZH)
          translate = ctx.locale.bind(NS)
        }
      } catch {
        translate = key => dict[key] ?? EN[key] ?? key
      }
      try {
        if (ctx.locale?.subscribe) {
          ctx.effect(() => ctx.locale.subscribe(() => {
            dict = currentLocaleId().toLowerCase().startsWith('zh') ? ZH : EN
            for (const listener of listeners) listener()
          }))
        }
      } catch {}

      ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left',
        id: 'blueprint-studio.open',
        order: 30,
        label: () => t('open'),
      }, OpenButton)))

      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'blueprint-studio.overlay',
        order: 30,
        label: () => t('title'),
      }, StudioBoundary)))
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.workspaceFiles', 'remote.session', 'remote.commands'],
      apply,
    }
  },
})
