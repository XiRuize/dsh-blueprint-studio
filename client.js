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
      exportMarkdownLayer: 'Markdown (current layer)', exportMarkdownAll: 'Markdown (all layers)',
      exportHtmlLayer: 'HTML (current layer)', exportHtmlAll: 'HTML (all layers)',
      exporting: 'Exporting…', exportSaved: 'Saved {name}', exportFailed: 'Export failed',
      exportEmpty: 'The export returned no content.',
      exportTooLarge: 'The export exceeds the 5 MB limit ({size}). Narrow the scope and retry.',
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
      statusNeedsRework: 'Needs rework',
      verification: 'Verification', verificationTests: 'Tests', verificationReviewer: 'Review', verificationHuman: 'Human',
      verificationPassed: 'Passed', verificationFailed: 'Failed', verificationPending: 'Pending',
      verificationAllPassed: 'All layers passed', verificationIncomplete: 'Not all layers passed',
      verificationEvidence: 'Evidence', verificationNoEvidence: 'No evidence yet',
      verificationRecord: 'Record verification', verificationRole: 'Layer', verificationResult: 'Result',
      verificationEvidencePlaceholder: 'Optional evidence, e.g. test command or review note',
      verificationSaved: 'Verification recorded', verificationSaveFailed: 'Could not record verification',
      verificationRequiredForDone: 'All three verification layers must pass before a module can be marked done.',
      verificationHint: 'Verification is recorded by the Host verify command; it cannot be bypassed with a status change.',
      moduleAcceptanceMissing: 'No acceptance criteria yet',
      sequence: 'Sequence', er: 'ER', c4: 'C4', participant: 'Participant', relationship: 'Relationship',
      person: 'Person', container: 'Container', component: 'Component', database: 'Database',
      message: 'Message', cardinality: 'Cardinality', order: 'Order', technology: 'Technology',
      fields: 'Fields', addField: 'Add field', fieldName: 'Name', fieldType: 'Type', primaryKey: 'PK', nullable: 'Nullable',
      versions: 'Versions', board: 'Board', snapshot: 'Snapshot', compare: 'Compare', restore: 'Restore', current: 'Current',
      diffTitle: 'Version diff', noVersions: 'No archived versions yet. Save once to create the first snapshot.',
      added: 'added', removed: 'removed', changed: 'changed', selectTwo: 'Pick two versions to compare.',
      closeDiff: 'Back', versionRestored: 'Version restored', snapshotSaved: 'Snapshot saved', versionLoadFailed: 'Could not load versions',
      checks: 'Checks', checksHint: 'Validate diagram structure, module dependencies and requirement coverage.',
      checkLoading: 'Running self-check…', checkEmpty: 'No issues found. The blueprint is consistent.',
      checkFailed: 'Self-check failed', checkInvalid: 'The self-check result is not valid JSON.',
      checkCheckedAt: 'Checked {time}', checkTruncated: 'Showing the first {shown} issues; the rest were truncated.',
      checkError: 'Error', checkWarn: 'Warning', checkInfo: 'Info',
      checkGroupError: 'Errors ({count})', checkGroupWarn: 'Warnings ({count})', checkGroupInfo: 'Info ({count})',
      checkCoverage: 'Coverage', checkTotalRequirements: 'Requirements', checkCoveredRequirements: 'Covered',
      checkUncoveredRequirements: 'Uncovered', checkLayerCount: 'Layers',
      checkModulesWithoutRequirements: 'Modules without requirements', checkModulesMissingAcceptance: 'Modules missing acceptance',
      checkCoveragePercent: '{percent}% covered', checkNone: 'None', checkUnknown: 'Not available',
      checkLocateHint: 'Click to locate this issue', checkDiagram: 'Diagram', checkRequirement: 'Requirement',
      checkModule: 'Module', checkLayer: 'Layer',
      children: 'Subagents', noChildren: 'No child subagents yet.', running: 'running', idle: 'idle', refresh: 'Refresh',
      openSession: 'Open session', copyId: 'Copy session id', importDrawio: 'Import draw.io', importFailed: 'Import failed',
      openChild: 'Open child session', cancelChild: 'Cancel', runModule: 'Retry / run module', moduleStatusHint: 'Change module status; done requires all three verification layers. Draft saves automatically.',
      cancelRequested: 'Cancel request sent to the subagent', cancelFailed: 'Could not cancel the subagent',
      modulePromptSent: 'The agent will restart this module only.',
      importDiagram: 'Import diagram', importSource: 'Source', importSourceAuto: 'Auto detect', importSourceDrawio: 'draw.io',
      importSourceMermaid: 'Mermaid', importDetected: 'Detected: {kind}',
      importReplace: 'Replace current diagram? Choose Cancel to append instead.', exportDrawio: 'draw.io XML',
      importTitle: 'Import diagram', importHint: 'Paste draw.io XML or Mermaid, or choose a file. draw.io vertices/edges map to the current diagram; Mermaid maps to the matching diagram automatically.',
      importMermaidHint: 'Mermaid support: classDiagram, stateDiagram-v2, and flowchart TD/LR (flowcharts import into the plan flowchart). Comments and style directives are ignored. Limits: 200 KB input and 200 nodes.',
      importPlaceholder: '<mxfile>…</mxfile>', importAutoPlaceholder: 'Paste draw.io XML (<mxfile>…</mxfile>) or Mermaid such as classDiagram / stateDiagram-v2 / flowchart.',
      importMermaidPlaceholder: 'classDiagram\n  class Animal {\n    +String name\n    +move() void\n  }\n  class Dog\n  Animal <|-- Dog',
      importSuccess: 'Imported {nodes} nodes and {edges} edges into {diagram}',
      importErrorTooLarge: 'Import rejected: the input exceeds 200 KB.',
      importErrorTooManyNodes: 'Import rejected: more than 200 nodes would be created.',
      importErrorUnsupported: 'Unsupported Mermaid diagram. Use classDiagram, stateDiagram-v2, or flowchart TD/LR.',
      importErrorEmpty: 'No importable nodes were found.',
      importErrorMissingDiagram: 'The target diagram does not exist in this blueprint.',
      importErrorParse: 'Could not parse the pasted content.',
      replaceDiagram: 'Replace current diagram', appendDiagram: 'Append to current diagram', importAction: 'Import',
      diffBase: 'From', diffTarget: 'To', diffEmpty: 'No semantic changes between these versions.',
      diffAdded: 'Added', diffRemoved: 'Removed', diffModified: 'Modified',
      reviewQueue: 'Review queue', reviewHint: 'Accept writes the after value back to the current blueprint; reject keeps it unchanged.',
      reviewAccept: 'Accept', reviewReject: 'Reject', reviewAcceptAll: 'Accept all ({count})', reviewRejectAll: 'Reject all ({count})',
      reviewAcceptAllConfirm: 'Accept {count} review entries and write them to the current blueprint?',
      reviewRejectAllConfirm: 'Reject {count} review entries? The current blueprint stays unchanged.',
      reviewNeedsCurrent: 'Write-back is only available when the comparison target is Current. Restore a version or save as current first.',
      reviewAccepted: 'Accepted', reviewRejected: 'Rejected', reviewProgress: '{decided} / {count} decided',
      reviewSaved: 'Applied {count} review entries and saved.', reviewRejectedToast: 'Rejected {count} review entries.',
      reviewUndo: 'Undo this review', reviewUndoConfirm: 'Undo the last review write-back and save the blueprint again?',
      reviewUndone: 'Review write-back undone.',
      fieldsEmpty: 'No fields yet.', addEdge: 'Add edge', edgeKind: 'Kind', saveSnapshotHint: 'Archive the current blueprint as a version',
      boardHint: 'Child sessions of this conversation, refreshed every 5 seconds.', moduleOf: 'Module', versionAt: 'Time', versionBy: 'Source',
      textChanged: 'changed', sectionTitleChanged: 'Title changed', diagramMissing: 'Diagram only exists on one side',
      diffAddedNodes: 'Added nodes', diffRemovedNodes: 'Removed nodes', diffChangedNodes: 'Changed nodes',
      diffAddedEdges: 'Added edges', diffRemovedEdges: 'Removed edges', diffChangedEdges: 'Changed edges',
      diffShowDetails: 'Show details', diffHideDetails: 'Hide details',
      diagrams: 'Diagrams', undo: 'Undo', redo: 'Redo', undoDone: 'Undid the last blueprint change', redoDone: 'Redid the blueprint change',
      backToStart: 'Welcome', continueEditing: 'Continue editing current blueprint', historyHint: 'Ctrl+Z / Ctrl+Y',
      classDiagram: 'Class diagram', stateDiagram: 'State diagram', flowchart: 'Plan flowchart', classNode: 'Class', interface: 'Interface',
      classDiagram: 'Class diagram', stateDiagram: 'State diagram', classNode: 'Class', interface: 'Interface',
      flowchart: 'Plan flowchart', flowStart: 'Start', flowEnd: 'End', flowProcess: 'Step', flowDecision: 'Decision',
      flowGroup: 'Group', flowNote: 'Note', condition: 'Condition', owner: 'Owner', parentGroup: 'Parent group',
      noParentGroup: 'No group', collapsed: 'Collapsed', flow: 'Flow', dashed: 'Dashed', nodeVerification: 'Verification',
      stateNode: 'State', initial: 'Initial', final: 'Final', choice: 'Choice', members: 'Members',
      field: 'Field', method: 'Method', addMethod: 'Add method', transition: 'Transition',
      extends: 'Extends', implements: 'Implements', association: 'Association', dependency: 'Dependency',
      draftSaved: 'Draft saved', generationTimeout: 'The AI did not return a blueprint within 60 seconds. Retry, or check the connection and keep waiting.', retry: 'Retry', cancelWaiting: 'Cancel waiting',
      templatesTitle: 'Start from a template', templatesHint: 'One click creates a full draft — no AI call needed.',
      tplWeb: 'Web application', tplWebDesc: 'Frontend, backend, database and auth',
      tplPlan: 'Implementation plan', tplPlanDesc: 'Plan flowchart with decisions, groups, verification and rollback',
      tplCli: 'CLI tool', tplCliDesc: 'Command parsing, execution, config and output',
      tplPipeline: 'Data pipeline', tplPipelineDesc: 'Ingest, clean, store and schedule',
      tplPlugin: 'DSH plugin', tplPluginDesc: 'Host tool, client panel, storage and tests',
      templateApplied: 'Template applied', templateFailed: 'Could not apply the template',
      linkedRequirements: 'Linked requirements', requirementPickerHint: 'Pick the requirement items this node covers.', noRequirements: 'No requirement items yet.',
      linkedNodes: 'Linked nodes', noDiagramNodes: 'No nodes in this diagram.', moduleFiles: 'Files', moduleAcceptance: 'Acceptance',
      moduleFilesHint: 'One file path per line', moduleAcceptanceHint: 'One acceptance item per line',
      moduleTraceHint: 'Click a module to edit its linked nodes, files and acceptance.',
      requirementsFocusHint: 'Click a requirement to highlight linked nodes; click again to clear.',
      includeDescendants: 'Include descendant modules', layerSummary: '{visible} items in this layer · {unassigned} unassigned · {subtree} in subtree',
      layerGap: '{count} items belong to other layers', createLayer: 'Create sublayer', enterChildLayer: 'Open sublayer',
      layerCreated: 'Created layer {letter}', layerExists: 'This module already has a sublayer.', maxDepth: 'Maximum layer depth reached',
      backToParentLayer: 'Back to parent layer', currentLayer: 'Current layer', searchPlaceholder: 'Search requirements, modules and layers…',
      searchNoResults: 'No matches', searchRequirements: 'Requirements', searchModules: 'Modules', searchLayers: 'Layers',
      searchHint: '↑↓ to choose · Enter to open · Esc to close', layer: 'Layer', sublayerOf: 'Sublayer of',
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
      exportMarkdownLayer: 'Markdown（当前层）', exportMarkdownAll: 'Markdown（全部层）',
      exportHtmlLayer: 'HTML（当前层）', exportHtmlAll: 'HTML（全部层）',
      exporting: '导出中…', exportSaved: '已保存 {name}', exportFailed: '导出失败',
      exportEmpty: '导出结果为空。',
      exportTooLarge: '导出内容超过 5MB 上限（当前 {size}），请缩小范围后重试。',
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
      statusNeedsRework: '需返工',
      verification: '分层验证', verificationTests: '测试', verificationReviewer: '评审', verificationHuman: '人工',
      verificationPassed: '通过', verificationFailed: '失败', verificationPending: '待验证',
      verificationAllPassed: '三层全部通过', verificationIncomplete: '未全部通过',
      verificationEvidence: '证据', verificationNoEvidence: '暂无证据',
      verificationRecord: '记录验证', verificationRole: '层级', verificationResult: '结果',
      verificationEvidencePlaceholder: '可选证据，例如测试命令或评审意见',
      verificationSaved: '验证已记录', verificationSaveFailed: '记录验证失败',
      verificationRequiredForDone: '三层验证全部通过后才能把模块标记为完成。',
      verificationHint: '验证由 Host 的 verify 命令写入，不能通过修改状态绕过。',
      moduleAcceptanceMissing: '还没有验收标准',
      sequence: '时序图', er: 'ER 图', c4: 'C4 图', participant: '参与者', relationship: '关系',
      person: '角色', container: '容器', component: '组件', database: '数据库',
      message: '消息', cardinality: '基数', order: '顺序', technology: '技术栈',
      fields: '字段', addField: '新增字段', fieldName: '字段名', fieldType: '类型', primaryKey: '主键', nullable: '可空',
      versions: '版本', board: '看板', snapshot: '保存快照', compare: '对比', restore: '恢复', current: '当前',
      diffTitle: '版本对比', noVersions: '还没有历史版本。保存一次就会生成第一份快照。',
      added: '新增', removed: '删除', changed: '修改', selectTwo: '选择两个版本进行对比。',
      closeDiff: '返回', versionRestored: '已恢复版本', snapshotSaved: '快照已保存', versionLoadFailed: '版本加载失败',
      checks: '自检', checksHint: '检查图结构、模块依赖与需求承接情况。',
      checkLoading: '正在自检…', checkEmpty: '没有发现问题，蓝图保持一致。',
      checkFailed: '自检失败', checkInvalid: '自检结果不是有效的 JSON。',
      checkCheckedAt: '自检于 {time}', checkTruncated: '只显示前 {shown} 条问题，其余已截断。',
      checkError: '错误', checkWarn: '警告', checkInfo: '提示',
      checkGroupError: '错误（{count}）', checkGroupWarn: '警告（{count}）', checkGroupInfo: '提示（{count}）',
      checkCoverage: '覆盖摘要', checkTotalRequirements: '需求总数', checkCoveredRequirements: '已承接',
      checkUncoveredRequirements: '未承接', checkLayerCount: '层数',
      checkModulesWithoutRequirements: '无需求模块', checkModulesMissingAcceptance: '缺验收模块',
      checkCoveragePercent: '已承接 {percent}%', checkNone: '无', checkUnknown: '未知',
      checkLocateHint: '点击定位到蓝图中的对应位置', checkDiagram: '图', checkRequirement: '需求',
      checkModule: '模块', checkLayer: '层',
      children: '子代理', noChildren: '还没有子代理。', running: '运行中', idle: '空闲', refresh: '刷新',
      openSession: '打开会话', copyId: '复制会话 ID', importDrawio: '导入 draw.io', importFailed: '导入失败',
      openChild: '打开子会话', cancelChild: '取消', runModule: '重试/执行模块', moduleStatusHint: '修改模块状态；标记完成需三层验证通过。草稿会自动保存。',
      cancelRequested: '已向子代理发送取消信号', cancelFailed: '取消子代理失败',
      modulePromptSent: '已请求 AI 只重新启动该模块的子代理。',
      importDiagram: '导入图', importSource: '来源', importSourceAuto: '自动识别', importSourceDrawio: 'draw.io',
      importSourceMermaid: 'Mermaid', importDetected: '识别为：{kind}',
      importReplace: '替换当前图？选择“取消”则追加。', exportDrawio: 'draw.io XML',
      importTitle: '导入图', importHint: '粘贴 draw.io XML 或 Mermaid，也可选择文件；draw.io 会映射到当前图，Mermaid 会按图类型自动选择目标图。',
      importMermaidHint: 'Mermaid 支持：classDiagram、stateDiagram-v2、flowchart TD/LR（flowchart 导入到计划流程图）。注释与样式指令会被忽略。限制：输入 200KB、节点 200 个。',
      importPlaceholder: '<mxfile>…</mxfile>', importAutoPlaceholder: '粘贴 draw.io XML（<mxfile>…</mxfile>）或 Mermaid，例如 classDiagram / stateDiagram-v2 / flowchart。',
      importMermaidPlaceholder: 'classDiagram\n  class Animal {\n    +String name\n    +move() void\n  }\n  class Dog\n  Animal <|-- Dog',
      importSuccess: '已导入 {nodes} 个节点、{edges} 条连线到「{diagram}」',
      importErrorTooLarge: '导入已拒绝：内容超过 200KB。',
      importErrorTooManyNodes: '导入已拒绝：解析出的节点超过 200 个。',
      importErrorUnsupported: '不支持的 Mermaid 图，请使用 classDiagram、stateDiagram-v2 或 flowchart TD/LR。',
      importErrorEmpty: '没有找到可导入的节点。',
      importErrorMissingDiagram: '当前蓝图缺少目标图。',
      importErrorParse: '无法解析粘贴的内容。',
      replaceDiagram: '替换当前图', appendDiagram: '追加到当前图', importAction: '导入',
      diffBase: '基准', diffTarget: '对比', diffEmpty: '这两个版本之间没有语义变化。',
      diffAdded: '新增', diffRemoved: '删除', diffModified: '修改',
      reviewQueue: '待复核队列', reviewHint: '接受会把 before→after 的 after 写回当前蓝图；拒绝保持当前不变。',
      reviewAccept: '接受', reviewReject: '拒绝', reviewAcceptAll: '全部接受（{count}）', reviewRejectAll: '全部拒绝（{count}）',
      reviewAcceptAllConfirm: '接受 {count} 条并写回当前蓝图？',
      reviewRejectAllConfirm: '拒绝 {count} 条？当前蓝图保持不变。',
      reviewNeedsCurrent: '只有对比目标是“当前”版本时才能写回；请先恢复版本或另存为当前。',
      reviewAccepted: '已接受', reviewRejected: '已拒绝', reviewProgress: '已处理 {decided} / {count} 条',
      reviewSaved: '已应用 {count} 条复核并保存。', reviewRejectedToast: '已拒绝 {count} 条复核。',
      reviewUndo: '撤销本次复核', reviewUndoConfirm: '撤销上一次复核写回并重新保存蓝图？',
      reviewUndone: '已撤销本次复核写回。',
      fieldsEmpty: '还没有字段。', addEdge: '新增连线', edgeKind: '类型', saveSnapshotHint: '把当前蓝图归档为版本',
      boardHint: '当前会话的子代理，每 5 秒刷新。', moduleOf: '模块', versionAt: '时间', versionBy: '来源',
      textChanged: '已修改', sectionTitleChanged: '标题已修改', diagramMissing: '该图只存在于一侧',
      diffAddedNodes: '新增节点', diffRemovedNodes: '删除节点', diffChangedNodes: '修改节点',
      diffAddedEdges: '新增连线', diffRemovedEdges: '删除连线', diffChangedEdges: '修改连线',
      diffShowDetails: '展开', diffHideDetails: '收起',
      diagrams: '图解', undo: '撤销', redo: '重做', undoDone: '已撤销上一步蓝图修改', redoDone: '已重做蓝图修改',
      backToStart: '初始页', continueEditing: '继续编辑当前蓝图', historyHint: 'Ctrl+Z / Ctrl+Y',
      classDiagram: '类图', stateDiagram: '状态图', flowchart: '计划流程图', classNode: '类', interface: '接口',
      classDiagram: '类图', stateDiagram: '状态图', classNode: '类', interface: '接口',
      flowchart: '计划流程图', flowStart: '开始', flowEnd: '结束', flowProcess: '步骤', flowDecision: '判断',
      flowGroup: '分组', flowNote: '备注', condition: '条件', owner: '负责人', parentGroup: '所属分组',
      noParentGroup: '不分组', collapsed: '折叠', flow: '实线', dashed: '虚线', nodeVerification: '验证',
      stateNode: '状态', initial: '初始', final: '结束', choice: '选择', members: '成员',
      field: '字段', method: '方法', addMethod: '新增方法', transition: '转移',
      extends: '继承', implements: '实现', association: '关联', dependency: '依赖',
      draftSaved: '草稿已保存', generationTimeout: 'AI 未在 60 秒内返回蓝图。可以重试，或检查网络后继续等待。', retry: '重试', cancelWaiting: '取消等待',
      templatesTitle: '从模板开始', templatesHint: '一键生成完整草稿，不调用 AI。',
      tplWeb: 'Web 应用', tplWebDesc: '前端、后端、数据库与鉴权',
      tplPlan: '实施计划', tplPlanDesc: '含判断、分组、验证与回滚的计划流程图',
      tplCli: 'CLI 工具', tplCliDesc: '命令解析、执行、配置与输出',
      tplPipeline: '数据管道', tplPipelineDesc: '采集、清洗、存储与调度',
      tplPlugin: 'DSH 插件', tplPluginDesc: 'Host 工具、Client 面板、存储与测试',
      templateApplied: '已应用模板', templateFailed: '模板应用失败',
      linkedRequirements: '关联需求', requirementPickerHint: '选择该节点实现或覆盖的需求条目。', noRequirements: '还没有需求条目。',
      linkedNodes: '关联节点', noDiagramNodes: '当前图还没有节点。', moduleFiles: '涉及文件', moduleAcceptance: '验收标准',
      moduleFilesHint: '每行一个文件路径', moduleAcceptanceHint: '每行一条验收标准',
      moduleTraceHint: '点击模块可编辑关联节点、涉及文件与验收标准。',
      requirementsFocusHint: '点击需求条目会高亮关联节点；再次点击取消。',
      includeDescendants: '包含子孙模块', layerSummary: '本层 {visible} 条 · 未归属 {unassigned} · 子树 {subtree}',
      layerGap: '另有 {count} 条属于其他层', createLayer: '创建子层', enterChildLayer: '进入子层',
      layerCreated: '已创建层 {letter}', layerExists: '该模块已有子层。', maxDepth: '已达到最大层深',
      backToParentLayer: '返回上一层', currentLayer: '当前层', searchPlaceholder: '检索需求、模块与层…',
      searchNoResults: '没有匹配结果', searchRequirements: '需求', searchModules: '模块', searchLayers: '层',
      searchHint: '↑↓ 选择 · Enter 定位 · Esc 关闭', layer: '层', sublayerOf: '子层，父模块',
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
      activeLayerId: 'A',
      selected: null,
      focusRequirement: null,
      mode: 'select',
      connectFrom: null,
      lastText: '',
      lastLoaded: 0,
      remoteUpdated: false,
      panel: 'inspector',
      exporting: null,
      check: null,
      checkLoading: false,
      checkLoaded: false,
      checkError: null,
      checkAt: 0,
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
      lastSaveMode: null,
      draftSavedAt: 0,
      generationFailed: false,
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
    const AUTOSAVE_DELAY_MS = 1800
    const GENERATION_TIMEOUT_MS = 60000
    const GENERATION_POLL_MS = 2000
    let autosaveTimer = null
    let generationWatch = null
    let saveChain = Promise.resolve()
    // Serialize all writes (draft + explicit) so overlapping edits cannot race each other.
    function enqueueSave(task) {
      const run = saveChain.then(task, task)
      saveChain = run.then(() => undefined, () => undefined)
      return run
    }
    function clearAutosaveTimer() {
      if (autosaveTimer !== null) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
    }
    function scheduleAutosave() {
      if (!state.open || state.bp === null || state.sessionId === null) return
      clearAutosaveTimer()
      const sessionId = state.sessionId
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null
        if (!state.open || state.sessionId !== sessionId) return
        saveDraft(sessionId)
      }, AUTOSAVE_DELAY_MS)
    }
    function clearGenerationWatch() {
      if (generationWatch === null) return
      const watch = generationWatch
      generationWatch = null
      watch.stopped = true
      if (watch.interval !== null) clearInterval(watch.interval)
      if (watch.timeout !== null) clearTimeout(watch.timeout)
    }
    function cancelGenerationWait() {
      clearGenerationWatch()
      set({ aiBusy: null })
    }
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
        clearGenerationWatch()
        if (state.dirty && !initial) {
          set({ loading: false, remoteUpdated: true, lastText: text, generationFailed: false })
          return
        }
        const nextFingerprint = JSON.stringify({ ...parsed, updatedAt: 0 })
        const currentFingerprint = state.bp === null ? null : JSON.stringify({ ...state.bp, updatedAt: 0 })
        if (currentFingerprint === nextFingerprint) {
          set({ loading: false, lastText: text, missing: false, landing: false })
          return
        }
        resetHistory()
        const layers = layerList(parsed)
        const activeLayerId = layers.some(layer => layer.letter === state.activeLayerId) ? state.activeLayerId : layers[0]?.letter ?? 'A'
        const layerDiagrams = diagramsForLayer(parsed, activeLayerId)
        const keepTab = layerDiagrams.some(diagram => diagram.key === state.tab)
        const tab = keepTab
          ? state.tab
          : (layerDiagrams.find(diagram => diagramTypeOf(diagram) === 'module')?.key ?? layerDiagrams[0]?.key ?? null)
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
          generationFailed: false,
          lastSaveMode: null,
          activeLayerId,
          tab,
        })
      } catch (error) {
        set({ loading: false, error: String(error?.message ?? error) })
      }
    }

    function saveBlueprint({ silent = true } = {}) {
      if (state.bp === null || state.sessionId === null) return Promise.resolve(false)
      clearAutosaveTimer()
      const sessionId = state.sessionId
      return enqueueSave(async () => {
        if (state.bp === null || state.sessionId !== sessionId) return false
        const payload = JSON.stringify(state.bp)
        set({ saving: true })
        try {
          const api = remote()
          const line = `/blueprint save ${base64(payload)}`
          const result = await api.commands.execute(sessionId, line, [])
          if (!result.ok) throw new Error(result.error?.message ?? 'command failed')
          const outcome = result.value?.result
          if (outcome?.kind === 'error') throw new Error(outcome.text)
          if (state.sessionId !== sessionId) return true
          const upToDate = state.bp !== null && JSON.stringify(state.bp) === payload
          set({ saving: false, dirty: !upToDate, lastSaveMode: 'archive', error: null, lastLoaded: Date.now() })
          if (!silent) toast(t('savedToast'), 'success')
          loadVersions()
          if (!upToDate) scheduleAutosave()
          return true
        } catch (error) {
          if (state.sessionId !== sessionId) return false
          const message = String(error?.message ?? error)
          set({ saving: false, dirty: true, error: `${t('saveFailed')}: ${message}` })
          toast(`${t('saveFailed')}: ${message}`, 'error')
          return false
        }
      })
    }

    function saveDraft(sessionId) {
      if (state.bp === null || state.sessionId === null) return Promise.resolve(false)
      const targetSession = sessionId ?? state.sessionId
      return enqueueSave(async () => {
        if (!state.open || state.bp === null || state.sessionId !== targetSession) return false
        const payload = JSON.stringify(state.bp)
        set({ saving: true })
        try {
          const api = remote()
          const line = `/blueprint save ${base64(payload)} --draft`
          const result = await api.commands.execute(targetSession, line, [])
          if (!result.ok) throw new Error(result.error?.message ?? 'command failed')
          const outcome = result.value?.result
          if (outcome?.kind === 'error') throw new Error(outcome.text)
          if (state.sessionId !== targetSession) return true
          const upToDate = state.bp !== null && JSON.stringify(state.bp) === payload
          set({
            saving: false,
            dirty: !upToDate,
            lastSaveMode: 'draft',
            draftSavedAt: Date.now(),
            error: null,
          })
          // Edits arrived while the write was in flight: keep dirty and merge them into one new draft write.
          if (!upToDate) scheduleAutosave()
          return true
        } catch (error) {
          if (state.sessionId !== targetSession) return false
          const message = String(error?.message ?? error)
          set({ saving: false, dirty: true, error: `${t('saveFailed')}: ${message}` })
          return false
        }
      })
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
      const names = { usecase: '用例图', dfd: '数据流图', module: '模块图', sequence: '时序图', er: 'ER 图', c4: 'C4 图', class: '类图', state: '状态图' }
      const type = diagramTypeOf(diagram)
      const kind = names[type] ?? diagram.title
      return `当前会话已有工程蓝图。请先调用 blueprint(action="get") 读取用户可能手工修改过的最新版本，然后只扩充「${kind}」（key=${diagram.key}）：补齐缺失的节点、连线、字段或消息，保留现有内容和用户修改。最后调用 blueprint(action="update") 保存完整蓝图，不要删除其他栏目、图解或模块。完成后用一句话说明新增了什么。`
    }

    function dispatchPrompt() {
      const base = `用户已在蓝图面板确认工程蓝图，Host 已校验一次性确认令牌并完成分派。请执行：\n1. 调用 blueprint(action="get") 读取最新蓝图（用户可能手工改过）；\n2. 不要调用 blueprint(action="confirm") 或 blueprint(action="dispatch")：确认与分派只能由用户在面板完成，工具调用会被 Host 拒绝；\n3. 为 modules 中每个模块启动一个子代理：有依赖的按依赖顺序执行，无依赖的并行；每个子代理的提示词必须包含该模块的范围、摘要、依赖、验收标准，以及相关用例/数据流/接口；\n4. 不要让一个子代理包办所有模块，也不要自己直接实现全部模块；\n5. 所有子代理完成后，汇总每个模块的改动、验证结果与剩余风险，并用 blueprint(action="update") 更新模块状态。`
      const bp = state.bp
      if (bp === null) return base
      const blocks = []
      for (const module of bp.modules ?? []) {
        const nodeIds = Array.isArray(module.nodeIds) ? module.nodeIds : []
        const files = Array.isArray(module.files) ? module.files : []
        const acceptance = Array.isArray(module.acceptance) ? module.acceptance : []
        if (nodeIds.length === 0 && files.length === 0 && acceptance.length === 0) continue
        const deps = (module.dependsOn ?? []).map(id => bp.modules.find(item => item.id === id)?.name ?? id)
        const lines = [`模块「${module.name}」（id=${module.id}${deps.length > 0 ? `，依赖 ${deps.join('、')}` : ''}）`]
        if (module.summary) lines.push(`  范围摘要：${module.summary}`)
        if (nodeIds.length > 0) {
          lines.push('  关联节点：')
          for (const ref of nodeIds) {
            const resolved = resolveNodeRef(bp, ref)
            if (resolved === null) {
              lines.push(`    - ${ref}`)
            } else {
              const detail = resolved.node.description ? `：${resolved.node.description}` : ''
              lines.push(`    - ${resolved.diagram.title} / ${resolved.node.label}（${ref}）${detail}`)
            }
          }
        }
        if (files.length > 0) {
          lines.push('  涉及文件：')
          for (const file of files) lines.push(`    - ${file}`)
        }
        if (acceptance.length > 0) {
          lines.push('  验收标准：')
          for (const item of acceptance) lines.push(`    - ${item}`)
        }
        blocks.push(lines.join('\n'))
      }
      if (blocks.length === 0) return base
      return `${base}\n\n请把以下模块追踪信息原样带入对应子代理的提示词：\n\n${blocks.join('\n\n')}`
    }

    function modulePrompt(module) {
      const deps = module.dependsOn?.length ? `该模块依赖：${module.dependsOn.join('、')}。` : ''
      return `当前会话已有工程蓝图。请先调用 blueprint(action="get") 读取最新蓝图（用户可能手工修改过），然后只重新启动模块「${module.name}」（id=${module.id}）的子代理；不要重做全部模块，也不要自己直接实现该模块。\n模块摘要与验收标准：${module.summary ?? '（见蓝图中的模块定义）'}\n${deps}启动子代理后，把子代理 sessionId 写回该模块的 subagentSessionId 并设置 status 为 running；子代理完成后把 status 更新为 done 或 blocked，并在 summary 中补一行结果。最后用 blueprint(action="update") 保存完整蓝图，保留其他模块和用户修改。`
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
            tplDiagram('class', '类图', [], []),
            tplDiagram('state', '状态图', [], []),
            tplDiagram('flowchart', '计划流程图', [], []),
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
            tplDiagram('class', '类图', [], []),
            tplDiagram('state', '状态图', [], []),
            tplDiagram('flowchart', '计划流程图', [], []),
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
            tplDiagram('class', '类图', [], []),
            tplDiagram('state', '状态图', [], []),
            tplDiagram('flowchart', '计划流程图', [], []),
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
            tplDiagram('class', '类图', [], []),
            tplDiagram('state', '状态图', [], []),
            tplDiagram('flowchart', '计划流程图', [], []),
          ],
          modules: [
            tplModule('plugin-host', 'Host 工具', '注册带 schema 的工具并实现业务处理；验收：工具可被 Agent 调用且返回结构化结果。', []),
            tplModule('plugin-client', 'Client 面板', '通过 module-loader 注册面板、订阅状态并适配主题；验收：面板打开正常且无构建步骤。', ['plugin-host']),
            tplModule('plugin-store', '存储', '封装工作区文件读写、缺失初始化与原子写入；验收：并发写不产生半截文件。', []),
            tplModule('plugin-test', '测试', '补齐语法检查与单元测试，覆盖工具与存储边界；验收：`node --check` 与测试全部通过。', ['plugin-host', 'plugin-store']),
          ],
        }),
      },
      {
        key: 'plan', nameKey: 'tplPlan', descKey: 'tplPlanDesc',
        build: () => tplBlueprint({
          title: '实施计划',
          summary: '先确认范围与约束，再按依赖拆分步骤；判断分支、并行分组、验证与回滚都进入计划流程图，确认后才开始实现。',
          prompt: '为当前任务制定实施计划：列出目标/非目标、约束、现状、步骤、判断点、并行分组、验证与回滚；先生成 Plan Flowchart，确认前不要写代码。',
          sections: [
            tplSection('goals', '目标与价值', [
              '用一张自上而下的计划图对齐范围、步骤与验证。',
              '计划确认前不产生代码改动，避免方向错误后返工。',
            ]),
            tplSection('actors', '角色与场景', [
              '开发者：补充步骤、判断和验证方式。',
              '技术负责人：确认分支、并行边界与回滚方案。',
            ]),
            tplSection('functional', '功能需求', [
              '开始后先判断需求与约束是否明确；不明确则回到澄清。',
              '按依赖排序实施步骤，并按可并行文件边界分组。',
              '每个步骤写验证方式；关键判断写清 yes/no 分支。',
              '存在失败/回滚路径，避免只画成功路径。',
            ]),
            tplSection('nonfunctional', '非功能需求', [
              '计划图节点建议不超过 40，超出时拆分子计划。',
              '所有步骤必须有可执行的验证证据。',
            ]),
            tplSection('constraints', '约束与依赖', [
              '实施前必须先完成范围确认与用户确认门禁。',
              '不修改未列入步骤与文件边界的模块。',
            ]),
            tplSection('acceptance', '验收标准', [
              '计划图含 start/end、至少一个判断及带标签分支。',
              '每个 process 有 verification，且存在失败/回滚路径。',
              '确认后按分组分派，每个模块独立验收。',
            ]),
            tplSection('risks', '风险与开放问题', [
              '需求不清时直接实施，可能造成大范围返工。',
              '并行分组若共享文件，容易产生冲突。',
              '缺少回滚步骤时，失败后无法恢复到可验证状态。',
            ]),
          ],
          diagrams: [
            {
              key: 'flowchart',
              title: '实施计划',
              nodes: [
                { id: 'start', type: 'start', label: '开始' },
                { id: 'd-scope', type: 'decision', label: '范围已确认？', condition: '目标、约束、验收标准是否明确' },
                { id: 'p-clarify', type: 'process', label: '澄清需求与边界', verification: '范围与验收标准经用户确认' },
                { id: 'g-core', type: 'group', label: '核心实施' },
                { id: 'p-model', type: 'process', label: '改数据与接口', parentGroup: 'g-core', verification: '接口/单测通过' },
                { id: 'p-ui', type: 'process', label: '改界面与交互', parentGroup: 'g-core', verification: '关键路径 UI 冒烟通过' },
                { id: 'p-verify', type: 'process', label: '全量验证', verification: '测试、构建与回归通过' },
                { id: 'd-pass', type: 'decision', label: '验证通过？', condition: '测试与验收是否全部通过' },
                { id: 'p-rollback', type: 'process', label: '回滚并记录失败', verification: '工作区恢复到上一个可验证版本' },
                { id: 'end', type: 'end', label: '完成' },
              ],
              edges: [
                { from: 'start', to: 'd-scope', kind: 'flow' },
                { from: 'd-scope', to: 'p-clarify', label: '否', kind: 'flow' },
                { from: 'd-scope', to: 'p-model', label: '是', kind: 'flow' },
                { from: 'p-clarify', to: 'd-scope', label: '重新确认', kind: 'dashed' },
                { from: 'p-model', to: 'p-ui', kind: 'flow' },
                { from: 'p-ui', to: 'p-verify', kind: 'flow' },
                { from: 'p-verify', to: 'd-pass', kind: 'flow' },
                { from: 'd-pass', to: 'end', label: '是', kind: 'flow' },
                { from: 'd-pass', to: 'p-rollback', label: '否', kind: 'flow' },
                { from: 'p-rollback', to: 'd-scope', label: '重试', kind: 'dashed' },
              ],
            },
          ],
          modules: [
            tplModule('plan-core', '核心改动', '按计划图完成数据、接口与界面步骤，每步带验证证据。', []),
            tplModule('plan-verify', '验证与回滚', '执行全量验证，失败时按回滚步骤恢复并记录原因。', ['plan-core']),
            tplModule('plan-release', '计划收尾', '确认验收、更新文档与发布；未通过不得标记完成。', ['plan-verify']),
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
      class: { label: 'classNode', color: '#818cf8', w: 240, h: 96 },
      interface: { label: 'interface', color: '#a78bfa', w: 240, h: 110 },
      state: { label: 'stateNode', color: '#22d3ee', w: 170, h: 64 },
      initial: { label: 'initial', color: '#64748b', w: 34, h: 34 },
      final: { label: 'final', color: '#64748b', w: 40, h: 40 },
      choice: { label: 'choice', color: '#f59e0b', w: 48, h: 44 },
      start: { label: 'flowStart', color: '#22c55e', w: 140, h: 48 },
      end: { label: 'flowEnd', color: '#ef4444', w: 140, h: 48 },
      decision: { label: 'flowDecision', color: '#f59e0b', w: 180, h: 110 },
      group: { label: 'flowGroup', color: '#8b5cf6', w: 340, h: 220 },
      note: { label: 'flowNote', color: '#eab308', w: 200, h: 96 },
    }

    const DIAGRAM_TYPE_ORDER = ['usecase', 'dfd', 'module', 'sequence', 'er', 'c4', 'class', 'state', 'flowchart']
    const DIAGRAM_TITLE_KEYS = {
      usecase: 'usecase', dfd: 'dfd', module: 'module', sequence: 'sequence', er: 'er', c4: 'c4',
      class: 'classDiagram', state: 'stateDiagram', flowchart: 'flowchart',
    }
    const FLOW_TYPE_LABEL_KEYS = {
      start: 'flowStart', end: 'flowEnd', process: 'flowProcess',
      decision: 'flowDecision', group: 'flowGroup', note: 'flowNote',
    }

    // Root diagrams keep their legacy key ("usecase"); child layers use
    // "<letter>:<type>" ("B:module"). Everything downstream keys off the type.
    function deriveType(key) {
      const value = String(key ?? '').trim().toLowerCase()
      const index = value.indexOf(':')
      return index >= 0 ? value.slice(index + 1) : value
    }
    function diagramTypeOf(diagram) {
      if (diagram === null || diagram === undefined) return ''
      return String(diagram.type ?? deriveType(diagram.key)).trim().toLowerCase()
    }
    function diagramLayerId(diagram) {
      if (diagram === null || diagram === undefined) return 'A'
      const explicit = String(diagram.layerId ?? '').trim().toUpperCase()
      if (explicit !== '') return explicit
      const key = String(diagram.key ?? '')
      const index = key.indexOf(':')
      return index > 0 ? key.slice(0, index).trim().toUpperCase() : 'A'
    }
    function diagramKeyFor(layerId, type) {
      return layerId === 'A' ? type : `${layerId}:${type}`
    }
    function layerList(bp) {
      const layers = Array.isArray(bp?.layers) ? bp.layers : []
      const root = layers.find(layer => (layer.letter ?? layer.id) === 'A')
      if (root !== undefined) return layers
      return [{ id: 'A', letter: 'A', title: 'A', parentModuleId: null }, ...layers]
    }
    function layerByLetter(bp, letter) {
      return layerList(bp).find(layer => (layer.letter ?? layer.id) === letter)
    }
    function diagramsForLayer(bp, layerId) {
      return (bp?.diagrams ?? []).filter(diagram => diagramLayerId(diagram) === layerId)
    }
    function diagramTypeTitle(type) {
      return t(DIAGRAM_TITLE_KEYS[type] ?? type)
    }
    function preferredTabForLayer(bp, layerId) {
      const list = diagramsForLayer(bp, layerId)
      return list.find(diagram => diagramTypeOf(diagram) === 'module')?.key
        ?? list.find(diagram => diagramTypeOf(diagram) === 'usecase')?.key
        ?? list[0]?.key
        ?? null
    }
    function currentDiagramFor(bp, tab, layerId) {
      const byKey = (bp?.diagrams ?? []).find(diagram => diagram.key === tab)
      if (byKey !== undefined && (layerId === undefined || diagramLayerId(byKey) === layerId)) return byKey
      const list = diagramsForLayer(bp, layerId)
      return list.find(diagram => diagramTypeOf(diagram) === 'module')
        ?? list.find(diagram => diagramTypeOf(diagram) === 'usecase')
        ?? list[0]
    }
    function moduleById(bp, id) {
      return (bp?.modules ?? []).find(module => module.id === id)
    }
    function moduleForNode(bp, node, layerId) {
      if (node === null || node === undefined) return undefined
      const modules = bp?.modules ?? []
      if (node.moduleId !== undefined && node.moduleId !== null) {
        const direct = moduleById(bp, node.moduleId)
        if (direct !== undefined && (layerId === undefined || direct.layerId === layerId)) return direct
      }
      const label = String(node.label ?? '').trim().toLowerCase()
      if (label === '') return undefined
      const match = list => list.find(module => {
        const candidates = [module.id, module.name, module.code, `${module.code ?? ''} ${module.name ?? ''}`]
        return candidates.some(candidate => String(candidate ?? '').trim().toLowerCase() === label)
      })
      if (layerId !== undefined) {
        const local = match(modules.filter(module => module.layerId === layerId))
        if (local !== undefined) return local
      }
      return match(modules)
    }
    function ensureModuleLinks(bp) {
      for (const diagram of bp?.diagrams ?? []) {
        const layerId = diagramLayerId(diagram)
        for (const node of diagram.nodes ?? []) {
          if (node.type !== 'module') continue
          const module = moduleForNode(bp, node, layerId)
          if (module !== undefined && node.moduleId !== module.id) node.moduleId = module.id
        }
      }
    }
    function moduleNodeInDiagram(bp, diagram, module) {
      if (diagram === undefined || module === undefined) return undefined
      return (diagram.nodes ?? []).find(node => node.type === 'module' && moduleForNode(bp, node, diagramLayerId(diagram))?.id === module.id)
    }
    function letterForIndex(index) {
      let value = index
      let result = ''
      while (value > 0) {
        value -= 1
        result = String.fromCharCode(65 + (value % 26)) + result
        value = Math.floor(value / 26)
      }
      return result
    }
    function nextLayerLetter(layers) {
      const used = new Set((layers ?? []).map(layer => String(layer.letter ?? layer.id ?? '').toUpperCase()))
      let index = 1
      while (used.has(letterForIndex(index))) index += 1
      return letterForIndex(index)
    }
    function parentLayerId(bp, layerId) {
      const layer = layerByLetter(bp, layerId)
      if (layer === undefined || layer.parentModuleId === null || layer.parentModuleId === undefined) return null
      const module = moduleById(bp, layer.parentModuleId)
      return module?.layerId ?? null
    }
    function layerDepth(bp, layerId) {
      let depth = 1
      let current = layerByLetter(bp, layerId)
      const seen = new Set()
      while (current !== undefined && current.parentModuleId !== null && current.parentModuleId !== undefined) {
        if (seen.has(current.letter)) break
        seen.add(current.letter)
        const module = moduleById(bp, current.parentModuleId)
        if (module === undefined) break
        const parent = layerByLetter(bp, module.layerId)
        if (parent === undefined) break
        depth += 1
        current = parent
      }
      return depth
    }
    function layerPath(bp, layerId) {
      const path = []
      const seen = new Set()
      let current = layerByLetter(bp, layerId)
      while (current !== undefined && !seen.has(current.letter)) {
        seen.add(current.letter)
        path.unshift(current)
        const parent = parentLayerId(bp, current.letter)
        current = parent === null ? undefined : layerByLetter(bp, parent)
      }
      if (path.length === 0) path.push(layerList(bp)[0])
      return path
    }
    function descendantLayerIds(bp, rootId) {
      const children = new Map()
      for (const layer of layerList(bp)) {
        if (layer.parentModuleId === null || layer.parentModuleId === undefined) continue
        const module = moduleById(bp, layer.parentModuleId)
        if (module === undefined) continue
        const key = module.layerId ?? 'A'
        if (!children.has(key)) children.set(key, [])
        children.get(key).push(layer.letter)
      }
      const seen = new Set([rootId])
      const queue = [rootId]
      while (queue.length > 0) {
        const id = queue.shift()
        for (const child of children.get(id) ?? []) {
          if (seen.has(child)) continue
          seen.add(child)
          queue.push(child)
        }
      }
      return seen
    }
    function ensureLayerDiagram(layerId, type) {
      const bp = state.bp
      if (bp === null) return null
      const existing = diagramsForLayer(bp, layerId).find(diagram => diagramTypeOf(diagram) === type)
      if (existing !== undefined) return existing.key
      const key = diagramKeyFor(layerId, type)
      mutate(current => {
        if ((current.diagrams ?? []).some(diagram => diagram.key === key)) return
        current.diagrams = current.diagrams ?? []
        current.diagrams.push({ key, layerId, type, title: diagramTypeTitle(type), nodes: [], edges: [] })
      }, { undoLabel: 'add-diagram' })
      return key
    }
    function activateLayer(layerId, options = {}) {
      const bp = state.bp
      if (bp === null) return
      const layers = layerList(bp)
      const target = layers.find(layer => layer.letter === layerId) ?? layers[0]
      if (target === undefined) return
      let tab = options.tab
      if (tab !== undefined) {
        const found = (bp.diagrams ?? []).find(diagram => diagram.key === tab && diagramLayerId(diagram) === target.letter)
        if (found === undefined) tab = undefined
      }
      if (tab === undefined) tab = preferredTabForLayer(bp, target.letter)
      if (tab === null && options.ensure !== false) tab = ensureLayerDiagram(target.letter, 'module')
      set({
        activeLayerId: target.letter,
        tab,
        selected: options.selected ?? null,
        mode: 'select',
        connectFrom: null,
        ...(options.focusRequirement !== undefined ? { focusRequirement: options.focusRequirement } : {}),
      })
    }
    function createChildLayer(module) {
      const bp = state.bp
      if (bp === null || module === undefined) return
      const existing = (bp.layers ?? []).find(layer => layer.parentModuleId === module.id)
      if (existing !== undefined) {
        activateLayer(existing.letter)
        toast(t('layerExists'), 'info')
        return
      }
      if (layerDepth(bp, module.layerId) >= 4) {
        toast(t('maxDepth'), 'error')
        return
      }
      const letter = nextLayerLetter(bp.layers ?? [])
      const key = diagramKeyFor(letter, 'module')
      mutate(current => {
        current.layers = current.layers ?? []
        current.layers.push({ id: letter, letter, title: module.name || letter, parentModuleId: module.id })
        current.diagrams = current.diagrams ?? []
        current.diagrams.push({ key, layerId: letter, type: 'module', title: diagramTypeTitle('module'), nodes: [], edges: [] })
      }, { undoLabel: 'create-layer' })
      set({ activeLayerId: letter, tab: key, selected: null, focusRequirement: null, mode: 'select', connectFrom: null })
      toast(t('layerCreated', { letter }), 'success')
    }
    function searchGroups(bp, query) {
      const needle = String(query ?? '').trim().toLowerCase()
      if (bp === null || needle === '') return []
      const matches = (...values) => values.some(value => String(value ?? '').toLowerCase().includes(needle))
      const requirements = []
      for (const section of bp.sections ?? []) {
        for (const [index, item] of (section.items ?? []).entries()) {
          const module = item.moduleId === undefined ? undefined : moduleById(bp, item.moduleId)
          if (!matches(item.code, item.uid, item.text, section.title, module?.code)) continue
          requirements.push({
            kind: 'requirement',
            ref: requirementRef(section.key, item.id ?? index),
            module,
            label: `${item.code ?? ''} ${item.text ?? ''}`.trim(),
            sub: module === undefined ? section.title : `${section.title} · ${module.code ?? ''} ${module.name ?? ''}`.trim(),
          })
        }
      }
      const modules = []
      for (const module of bp.modules ?? []) {
        if (!matches(module.code, module.name, module.summary)) continue
        modules.push({
          kind: 'module',
          module,
          label: `${module.code ?? ''} ${module.name ?? ''}`.trim(),
          sub: module.summary || `${t('layer')} ${module.layerId ?? 'A'}`,
        })
      }
      const layers = []
      for (const layer of layerList(bp)) {
        if (!matches(layer.letter, layer.title)) continue
        const anchor = layer.parentModuleId === null || layer.parentModuleId === undefined ? undefined : moduleById(bp, layer.parentModuleId)
        layers.push({
          kind: 'layer',
          layer,
          label: `${layer.letter ?? layer.id}${layer.title ? ` · ${layer.title}` : ''}`,
          sub: anchor === undefined ? t('currentLayer') : `${t('sublayerOf')} ${anchor.code ?? ''} ${anchor.name ?? ''}`.trim(),
        })
      }
      const groups = [
        { key: 'requirements', title: t('searchRequirements'), items: requirements },
        { key: 'modules', title: t('searchModules'), items: modules },
        { key: 'layers', title: t('searchLayers'), items: layers },
      ].filter(group => group.items.length > 0)
      let remaining = 20
      for (const group of groups) {
        group.items = group.items.slice(0, Math.max(0, remaining))
        remaining -= group.items.length
      }
      return groups.filter(group => group.items.length > 0)
    }
    function navigateSearch(store, result) {
      const bp = store.bp
      if (bp === null || result === undefined) return
      if (result.kind === 'layer') {
        activateLayer(result.layer.letter)
        return
      }
      const module = result.module
      let layerId = module?.layerId ?? 'A'
      if (layerByLetter(bp, layerId) === undefined) layerId = 'A'
      const tab = ensureLayerDiagram(layerId, 'module')
      const latest = state.bp
      const diagram = (latest?.diagrams ?? []).find(item => item.key === tab)
      const node = module === undefined ? undefined : moduleNodeInDiagram(latest, diagram, module)
      set({
        activeLayerId: layerId,
        tab,
        selected: node === undefined ? null : { kind: 'node', id: node.id },
        mode: 'select',
        connectFrom: null,
        ...(result.kind === 'requirement' ? { focusRequirement: result.ref } : {}),
      })
    }

    function typesFor(key) {
      const type = deriveType(key)
      if (type === 'usecase') return ['actor', 'usecase', 'system']
      if (type === 'dfd') return ['entity', 'process', 'store']
      if (type === 'sequence') return ['participant', 'actor']
      if (type === 'er') return ['entity', 'relationship']
      if (type === 'c4') return ['person', 'system', 'container', 'component', 'database', 'external']
      if (type === 'class') return ['class', 'interface']
      if (type === 'state') return ['state', 'initial', 'final', 'choice']
      if (type === 'flowchart') return ['start', 'end', 'process', 'decision', 'group', 'note']
      return ['module', 'external']
    }
    function typeLabel(type, diagramType) {
      if (diagramType === 'flowchart' && FLOW_TYPE_LABEL_KEYS[type] !== undefined) return t(FLOW_TYPE_LABEL_KEYS[type])
      return t(TYPE_META[type]?.label ?? type)
    }
    function defaultEdgeKind(key) {
      const type = deriveType(key)
      if (type === 'usecase') return 'association'
      if (type === 'dfd') return 'flow'
      if (type === 'sequence') return 'sync'
      if (type === 'er') return 'relationship'
      if (type === 'c4') return 'uses'
      if (type === 'class') return 'association'
      if (type === 'state') return 'transition'
      if (type === 'flowchart') return 'flow'
      return 'depends'
    }
    function edgeKindsFor(key) {
      const type = deriveType(key)
      if (type === 'sequence') return ['sync', 'async', 'return']
      if (type === 'er') return ['relationship']
      if (type === 'c4') return ['uses', 'contains', 'realizes', 'depends']
      if (type === 'class') return ['extends', 'implements', 'association', 'dependency']
      if (type === 'state') return ['transition']
      if (type === 'flowchart') return ['flow', 'dashed']
      return ['association', 'include', 'extend', 'flow', 'depends']
    }
    function classGeometry(node) {
      const count = Array.isArray(node.fields) ? node.fields.length : 0
      const headerHeight = node.type === 'interface' ? 54 : 40
      return { w: node.w ?? 240, h: Math.max(80, headerHeight + Math.max(24, count * 19 + 12)) }
    }
    function sizeOf(node) {
      const meta = TYPE_META[node.type] ?? TYPE_META.usecase
      if (node.type === 'class' || node.type === 'interface') return classGeometry(node)
      if (node.type === 'entity' && Array.isArray(node.fields) && node.fields.length > 0) {
        return { w: node.w ?? 210, h: Math.max(96, 58 + node.fields.length * 19) }
      }
      return { w: node.w ?? meta.w, h: node.h ?? meta.h }
    }

    function requirementRef(sectionKey, itemId) {
      return `${sectionKey}:${itemId}`
    }
    function nodeRef(diagramKey, id) {
      return `${diagramKey}:${id}`
    }
    function splitRef(ref) {
      const text = String(ref ?? '')
      // Child-layer diagram keys contain a colon ("B:module"), so split on the last
      // colon to keep "<layer>:<type>:<nodeId>" resolvable.
      const index = text.lastIndexOf(':')
      if (index <= 0 || index === text.length - 1) return null
      return { key: text.slice(0, index), id: text.slice(index + 1) }
    }
    function resolveNodeRef(blueprint, ref) {
      const parts = splitRef(ref)
      if (parts === null) return null
      const diagram = blueprint.diagrams.find(item => item.key === parts.key)
      const node = diagram?.nodes.find(item => item.id === parts.id)
      return node === undefined ? null : { diagram, node }
    }
    function linesToList(value) {
      return String(value ?? '').split(/\r?\n/u).map(line => line.trim()).filter(line => line !== '')
    }
    function toggleTraceValue(current, ref) {
      const next = new Set(Array.isArray(current) ? current : [])
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return [...next]
    }

    // Plan Flowchart layout is deterministic and top-down: roots are explicit
    // start nodes or nodes without incoming edges, DFS back edges are ignored for
    // ranking (cycles can never inflate rank), and decision successors fan out
    // left/right around their parent. Groups are containers derived from the
    // bounding box of the nodes whose parentGroup points at them.
    const FLOW_LAYOUT_MAX_NODES = 300
    const FLOW_LAYOUT_MAX_EDGES = 4000

    function layoutFlowchartGroups(nodes) {
      const list = Array.isArray(nodes) ? nodes : []
      const groups = list.filter(node => node.type === 'group')
      if (groups.length === 0) return
      const byId = new Map(list.map(node => [node.id, node]))
      const childrenOf = new Map()
      for (const node of list) {
        const parent = node.parentGroup
        if (typeof parent !== 'string' || parent === '' || parent === node.id) continue
        if (!childrenOf.has(parent)) childrenOf.set(parent, [])
        childrenOf.get(parent).push(node)
      }
      const depthOf = group => {
        let depth = 0
        let current = group
        const seen = new Set([group.id])
        while (typeof current?.parentGroup === 'string' && current.parentGroup !== '') {
          if (seen.has(current.parentGroup) || depth > groups.length) break
          seen.add(current.parentGroup)
          const parent = byId.get(current.parentGroup)
          if (parent === undefined || parent.type !== 'group') break
          depth += 1
          current = parent
        }
        return depth
      }
      // Inner groups first so an outer group box includes the nested one.
      const ordered = [...groups].sort((left, right) => depthOf(right) - depthOf(left))
      let fallback = 0
      for (const group of ordered) {
        const children = childrenOf.get(group.id) ?? []
        if (children.length === 0) {
          if (typeof group.x !== 'number') group.x = 90 + (fallback % 4) * 40
          if (typeof group.y !== 'number') group.y = 100 + (fallback % 4) * 40
          fallback += 1
          if (typeof group.w !== 'number') group.w = TYPE_META.group.w
          if (typeof group.h !== 'number') group.h = TYPE_META.group.h
          continue
        }
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const child of children) {
          if (typeof child.x !== 'number' || typeof child.y !== 'number') continue
          const size = sizeOf(child)
          minX = Math.min(minX, child.x)
          minY = Math.min(minY, child.y)
          maxX = Math.max(maxX, child.x + size.w)
          maxY = Math.max(maxY, child.y + size.h)
        }
        if (!Number.isFinite(minX) || !Number.isFinite(minY)) continue
        group.x = minX - 36
        group.y = minY - 48
        group.w = Math.max(240, maxX - minX + 72)
        group.h = Math.max(130, maxY - minY + 84)
      }
    }

    function layoutFlowchart(diagram) {
      const nodes = diagram.nodes ?? []
      if (nodes.length === 0) return
      const byId = new Map(nodes.map(node => [node.id, node]))
      const body = nodes.filter(node => node.type !== 'group' && node.type !== 'note')
      const notes = nodes.filter(node => node.type === 'note')
      const centered = 520
      const marginX = 80
      const topY = 90
      const gapX = 64
      const gapY = 88

      const gridFallback = () => {
        body.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = marginX + (index % 5) * 230
          node.y = topY + Math.floor(index / 5) * 150
          node.w = size.w
          node.h = size.h
        })
        let right = marginX
        for (const node of body) right = Math.max(right, (node.x ?? 0) + sizeOf(node).w)
        notes.forEach((node, index) => {
          const size = sizeOf(node)
          node.x = body.length > 0 ? right + 80 : marginX
          node.y = topY + index * (size.h + 40)
          node.w = size.w
          node.h = size.h
        })
        layoutFlowchartGroups(nodes)
      }
      if (body.length > FLOW_LAYOUT_MAX_NODES) {
        gridFallback()
        return
      }

      const adjacency = new Map(body.map(node => [node.id, []]))
      const allEdges = []
      for (const edge of diagram.edges ?? []) {
        const from = byId.get(edge.from)
        const to = byId.get(edge.to)
        if (from === undefined || to === undefined) continue
        if (from.type === 'group' || from.type === 'note' || to.type === 'group' || to.type === 'note') continue
        if (edge.from === edge.to) continue
        if (allEdges.length >= FLOW_LAYOUT_MAX_EDGES) break
        allEdges.push(edge)
        adjacency.get(edge.from)?.push(edge)
      }

      // Iterative DFS: every edge that points at a node still on the stack is a
      // back edge and must not participate in ranking.
      const state = new Map(body.map(node => [node.id, 0]))
      const backEdges = new Set()
      for (const root of body) {
        if (state.get(root.id) !== 0) continue
        state.set(root.id, 1)
        const stack = [{ id: root.id, index: 0 }]
        while (stack.length > 0) {
          const top = stack[stack.length - 1]
          const outgoing = adjacency.get(top.id) ?? []
          if (top.index >= outgoing.length) {
            state.set(top.id, 2)
            stack.pop()
            continue
          }
          const edge = outgoing[top.index]
          top.index += 1
          const targetState = state.get(edge.to) ?? 2
          if (targetState === 1) {
            backEdges.add(edge)
          } else if (targetState === 0) {
            state.set(edge.to, 1)
            stack.push({ id: edge.to, index: 0 })
          }
        }
      }

      // Edges into a start node are ignored for ranking so start always stays at
      // rank 0 even if the author drew an incoming loop.
      const rankEdges = allEdges.filter(edge => !backEdges.has(edge) && byId.get(edge.to)?.type !== 'start')
      const rank = new Map(body.map(node => [node.id, 0]))
      const indegree = new Map(body.map(node => [node.id, 0]))
      const rankOut = new Map(body.map(node => [node.id, []]))
      for (const edge of rankEdges) {
        indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
        rankOut.get(edge.from)?.push(edge)
      }
      const queue = body.filter(node => (indegree.get(node.id) ?? 0) === 0).map(node => node.id)
      const processed = new Set()
      for (let head = 0; head < queue.length; head += 1) {
        const id = queue[head]
        if (processed.has(id)) continue
        processed.add(id)
        for (const edge of rankOut.get(id) ?? []) {
          rank.set(edge.to, Math.max(rank.get(edge.to) ?? 0, (rank.get(id) ?? 0) + 1))
          indegree.set(edge.to, (indegree.get(edge.to) ?? 1) - 1)
          if ((indegree.get(edge.to) ?? 0) === 0) queue.push(edge.to)
        }
      }
      // Defensive: any node the topological pass missed keeps rank 0 instead of
      // looping forever; DFS back-edge removal normally makes the graph a DAG.
      for (const node of body) if (!processed.has(node.id)) processed.add(node.id)
      for (const node of body) if (node.type === 'start') rank.set(node.id, 0)

      let maxRank = 0
      for (const value of rank.values()) maxRank = Math.max(maxRank, value)
      for (const node of body) if (node.type === 'end') rank.set(node.id, Math.min(maxRank + 1, body.length))

      const rows = new Map()
      const orderIndex = new Map(body.map((node, index) => [node.id, index]))
      for (const node of body) {
        const depth = rank.get(node.id) ?? 0
        if (!rows.has(depth)) rows.set(depth, [])
        rows.get(depth).push(node)
      }
      const incoming = new Map(body.map(node => [node.id, []]))
      for (const edge of rankEdges) incoming.get(edge.to)?.push(edge)

      const centers = new Map()
      let cursorY = topY
      const depths = [...rows.keys()].sort((left, right) => left - right)
      for (const depth of depths) {
        const row = rows.get(depth) ?? []
        const preferred = new Map()
        row.forEach((node, index) => {
          const direct = incoming.get(node.id) ?? []
          const branchParent = direct
            .map(edge => byId.get(edge.from))
            .find(parent => parent !== undefined && parent.type === 'decision')
          let value = null
          if (branchParent !== undefined) {
            const branches = rankOut.get(branchParent.id) ?? []
            if (branches.length >= 2) {
              const position = branches.findIndex(edge => edge.to === node.id)
              if (position >= 0) {
                const side = position % 2 === 0 ? 1 : -1
                const distance = 170 + Math.floor(position / 2) * 190
                value = (centers.get(branchParent.id) ?? centered) + side * distance
              }
            }
          }
          if (value === null) {
            const parentCenters = direct
              .map(edge => centers.get(edge.from))
              .filter(item => typeof item === 'number' && Number.isFinite(item))
            value = parentCenters.length > 0
              ? parentCenters.reduce((sum, item) => sum + item, 0) / parentCenters.length
              : centered + (index - (row.length - 1) / 2) * 260
          }
          preferred.set(node.id, value)
        })
        row.sort((left, right) => {
          const leftValue = preferred.get(left.id) ?? centered
          const rightValue = preferred.get(right.id) ?? centered
          if (leftValue !== rightValue) return leftValue - rightValue
          return (orderIndex.get(left.id) ?? 0) - (orderIndex.get(right.id) ?? 0)
        })
        let cursorX = -Infinity
        let rowHeight = 0
        for (const node of row) {
          const size = sizeOf(node)
          node.w = size.w
          node.h = size.h
          let x = (preferred.get(node.id) ?? centered) - size.w / 2
          if (Number.isFinite(cursorX) && x < cursorX + gapX) x = cursorX + gapX
          x = Math.max(marginX, x)
          node.x = x
          cursorX = x + size.w
          centers.set(node.id, x + size.w / 2)
          rowHeight = Math.max(rowHeight, size.h)
        }
        for (const node of row) node.y = cursorY + (rowHeight - (node.h ?? sizeOf(node).h)) / 2
        cursorY += rowHeight + gapY
      }

      let contentRight = marginX
      for (const node of body) contentRight = Math.max(contentRight, (node.x ?? 0) + sizeOf(node).w)
      notes.forEach((node, index) => {
        const size = sizeOf(node)
        node.x = body.length > 0 ? contentRight + 90 : marginX
        node.y = topY + index * (size.h + 40)
        node.w = size.w
        node.h = size.h
      })
      layoutFlowchartGroups(nodes)
    }

    // A group hides its descendants while collapsed. Nested groups inherit the
    // hidden state, and the map is scoped to this diagram only.
    function flowchartHiddenIds(nodes) {
      const hidden = new Set()
      const byId = new Map((nodes ?? []).map(node => [node.id, node]))
      for (const node of nodes ?? []) {
        let parentId = node.parentGroup
        const seen = new Set()
        while (typeof parentId === 'string' && parentId !== '' && !seen.has(parentId)) {
          seen.add(parentId)
          const parent = byId.get(parentId)
          if (parent === undefined) break
          if (parent.type === 'group' && parent.collapsed === true) {
            hidden.add(node.id)
            break
          }
          parentId = parent.parentGroup
        }
      }
      return hidden
    }

    function layoutDiagram(diagram) {
      const nodes = diagram.nodes ?? []
      if (nodes.length === 0) return
      const type = diagramTypeOf(diagram)
      const system = nodes.find(node => node.type === 'system')
      const gapX = 70
      const gapY = 56
      if (type === 'flowchart') {
        layoutFlowchart(diagram)
      } else if (type === 'usecase') {
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
      } else if (type === 'dfd') {
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
      } else if (type === 'module') {
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
      } else if (type === 'sequence') {
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
      } else if (type === 'er') {
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
      } else if (type === 'c4') {
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
      } else if (type === 'class') {
        const byId = new Map(nodes.map(node => [node.id, node]))
        const level = new Map(nodes.map(node => [node.id, 0]))
        for (let round = 0; round < 12; round += 1) {
          let changed = false
          for (const edge of diagram.edges ?? []) {
            if (edge.kind !== 'extends' && edge.kind !== 'implements') continue
            if (!byId.has(edge.from) || !byId.has(edge.to)) continue
            const next = (level.get(edge.to) ?? 0) + 1
            if ((level.get(edge.from) ?? 0) < next && next < 12) {
              level.set(edge.from, next)
              changed = true
            }
          }
          if (!changed) break
        }
        const rows = new Map()
        for (const node of nodes) {
          const depth = level.get(node.id) ?? 0
          if (!rows.has(depth)) rows.set(depth, [])
          rows.get(depth).push(node)
        }
        let y = 110
        for (const depth of [...rows.keys()].sort((left, right) => left - right)) {
          const list = rows.get(depth)
          let rowY = y
          for (let start = 0; start < list.length; start += 3) {
            const chunk = list.slice(start, start + 3)
            let x = 90
            let rowHeight = 0
            for (const node of chunk) {
              const size = sizeOf(node)
              node.x = x
              node.y = rowY
              node.w = size.w
              node.h = size.h
              x += size.w + 70
              rowHeight = Math.max(rowHeight, size.h)
            }
            rowY += rowHeight + 60
          }
          y = rowY + 12
        }
      } else if (type === 'state') {
        const rank = new Map(nodes.map(node => [node.id, 0]))
        for (let round = 0; round < 20; round += 1) {
          let changed = false
          for (const edge of diagram.edges ?? []) {
            if (!rank.has(edge.from) || !rank.has(edge.to)) continue
            const next = (rank.get(edge.from) ?? 0) + 1
            if ((rank.get(edge.to) ?? 0) < next && next < 20) {
              rank.set(edge.to, next)
              changed = true
            }
          }
          if (!changed) break
        }
        for (const node of nodes) if (node.type === 'initial') rank.set(node.id, 0)
        const maxRank = Math.max(0, ...nodes.filter(node => node.type !== 'initial' && node.type !== 'final').map(node => rank.get(node.id) ?? 0))
        for (const node of nodes) if (node.type === 'final') rank.set(node.id, maxRank + 1)
        const columns = new Map()
        const typeOrder = { initial: 0, state: 1, choice: 2, final: 3 }
        for (const node of nodes) {
          const depth = rank.get(node.id) ?? 0
          if (!columns.has(depth)) columns.set(depth, [])
          columns.get(depth).push(node)
        }
        for (const [depth, list] of columns) {
          list.sort((left, right) => (typeOrder[left.type] ?? 9) - (typeOrder[right.type] ?? 9))
          let y = 110
          for (const node of list) {
            const size = sizeOf(node)
            node.x = 90 + depth * 270
            node.y = y
            node.w = size.w
            node.h = size.h
            y += size.h + 56
          }
        }
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
      ensureModuleLinks(blueprint)
      for (const diagram of blueprint.diagrams ?? []) {
        const type = diagramTypeOf(diagram)
        const nodes = diagram.nodes ?? []
        const missing = nodes.some(node => typeof node.x !== 'number' || typeof node.y !== 'number')
        if (missing) {
          // Remember every hand-placed coordinate/size first. The existing layout
          // algorithm always computes the whole diagram, so restore all positions
          // that were already present and only keep coordinates for new nodes.
          const placed = nodes.map(node => ({
            node,
            x: node.x,
            y: node.y,
            w: node.w,
            h: node.h,
          }))
          layoutDiagram(diagram)
          for (const saved of placed) {
            // Restore each existing coordinate independently: a node that has
            // only x (or only y) still keeps that hand-placed value.
            if (typeof saved.x === 'number') saved.node.x = saved.x
            if (typeof saved.y === 'number') saved.node.y = saved.y
            if (typeof saved.w === 'number') saved.node.w = saved.w
            if (typeof saved.h === 'number') saved.node.h = saved.h
          }
        }
        if (type === 'sequence') {
          ;(diagram.edges ?? []).forEach((edge, index) => {
            if (typeof edge.order !== 'number') edge.order = index + 1
          })
          diagram.height = 170 + Math.max(1, (diagram.edges ?? []).length) * 56 + 90
        }
        if (type === 'flowchart') {
          // Groups are containers: recompute their box whenever this pass laid
          // out new nodes or a group is still missing geometry. A fully
          // hand-placed flowchart is never re-flowed.
          const groups = nodes.filter(node => node.type === 'group')
          const incomplete = groups.some(node =>
            typeof node.x !== 'number' || typeof node.y !== 'number'
            || typeof node.w !== 'number' || typeof node.h !== 'number')
          if (missing || incomplete) layoutFlowchartGroups(nodes)
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
      scheduleAutosave()
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
      scheduleAutosave()
      toast(t('redoDone'), 'info')
    }

    function mutate(fn, { layout = false, undoLabel = 'edit', undo = true } = {}) {
      const bp = state.bp
      if (bp === null) return
      if (undo) recordUndo(bp, undoLabel)
      fn(bp)
      if (layout) {
        const diagram = currentDiagramFor(bp, state.tab, state.activeLayerId)
        if (diagram !== undefined) layoutDiagram(diagram)
      }
      bp.updatedAt = Date.now()
      set({ bp: { ...bp }, dirty: true, ...historyFlags() })
      scheduleAutosave()
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
      if (name === 'search') return h('svg', common, h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'M15.5 15.5L21 21' }))
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
      if (status === 'needs-rework' || status === 'needs_rework') return t('statusNeedsRework')
      return t('statusPending')
    }

    const VERIFICATION_ROLES = ['tests', 'reviewer', 'human']
    const VERIFICATION_STATUSES = ['pending', 'passed', 'failed']
    const VERIFICATION_ROLE_KEYS = { tests: 'verificationTests', reviewer: 'verificationReviewer', human: 'verificationHuman' }
    const VERIFICATION_STATUS_KEYS = { passed: 'verificationPassed', failed: 'verificationFailed', pending: 'verificationPending' }

    function moduleVerification(module) {
      const raw = module?.verification
      const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
      const verification = {}
      for (const role of VERIFICATION_ROLES) {
        const entry = source[role] !== null && typeof source[role] === 'object' && !Array.isArray(source[role])
          ? source[role]
          : {}
        const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : 'pending'
        const evidence = Array.isArray(entry.evidence)
          ? entry.evidence.filter(item => typeof item === 'string' && item.trim() !== '')
          : []
        verification[role] = {
          status: VERIFICATION_STATUSES.includes(status) ? status : 'pending',
          evidence,
          at: typeof entry.at === 'number' && Number.isFinite(entry.at) ? entry.at : undefined,
        }
      }
      return verification
    }

    function verificationAllPassed(module) {
      const verification = moduleVerification(module)
      return VERIFICATION_ROLES.every(role => verification[role].status === 'passed')
    }

    function verificationRoleLabel(role) {
      return t(VERIFICATION_ROLE_KEYS[role] ?? 'verification')
    }

    function verificationStatusLabel(status) {
      return t(VERIFICATION_STATUS_KEYS[status] ?? 'verificationPending')
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
      clearAutosaveTimer()
      clearGenerationWatch()
      resetHistory()
      set({
        open: true, sessionId, path: pathFor(sessionId), bp: null, loading: true, missing: false,
        dirty: false, saving: false, selected: null, mode: 'select', connectFrom: null, error: null, lastText: '', tab: 'usecase',
        panel: 'inspector', versions: [], versionsLoaded: false, diff: null, children: [], childrenLoaded: false,
        exporting: null, check: null, checkLoading: false, checkLoaded: false, checkError: null, checkAt: 0,
        landing: false, canUndo: false, canRedo: false, historyVersion: state.historyVersion + 1,
        lastSaveMode: null, draftSavedAt: 0, generationFailed: false, aiBusy: null, toast: null,
      })
      loadBlueprint({ initial: true })
      loadVersions()
    }

    async function backToStart() {
      clearAutosaveTimer()
      if (state.dirty) {
        const ok = await saveBlueprint({ silent: true })
        if (!ok) return
      }
      set({ landing: true, selected: null, mode: 'select', connectFrom: null, diff: null, panel: 'inspector' })
    }

    async function closeStudio() {
      clearAutosaveTimer()
      if (state.dirty) {
        const ok = await saveBlueprint({ silent: true })
        if (!ok) return
      }
      clearGenerationWatch()
      set({ open: false, saving: false })
    }

    function EmptyState() {
      const store = useStore()
      const existing = store.bp !== null
      const [task, setTask] = useState(existing ? (store.bp.prompt ?? '') : '')
      useEffect(() => () => clearGenerationWatch(), [])
      const start = async () => {
        if (task.trim() === '') return
        const sessionId = state.sessionId
        if (sessionId === null) return
        try {
          set({ loading: true, error: null, generationFailed: false })
          await sendPrompt(generatePrompt(task.trim()), 'generating')
          if (!state.open || state.sessionId !== sessionId) return
          set({ loading: false, landing: false })
          // The agent will create the file. Poll until it appears, but never wait forever.
          clearGenerationWatch()
          const watch = { sessionId, interval: null, timeout: null, stopped: false }
          generationWatch = watch
          const stop = () => {
            if (watch.stopped) return
            watch.stopped = true
            if (watch.interval !== null) clearInterval(watch.interval)
            if (watch.timeout !== null) clearTimeout(watch.timeout)
            if (generationWatch === watch) generationWatch = null
          }
          watch.interval = setInterval(async () => {
            if (watch.stopped) return
            if (!state.open || state.sessionId !== sessionId) { stop(); return }
            const text = await readBlueprintText(sessionId).catch(() => null)
            if (watch.stopped) return
            if (text !== null && text.trim() !== '') {
              stop()
              await loadBlueprint()
            }
          }, GENERATION_POLL_MS)
          watch.timeout = setTimeout(() => {
            if (watch.stopped) return
            stop()
            if (!state.open || state.sessionId !== sessionId) return
            // Stop the client-side wait only; the regular studio poll still picks the file up if it appears later.
            set({ aiBusy: null, loading: false, error: t('generationTimeout'), generationFailed: true })
          }, GENERATION_TIMEOUT_MS)
        } catch (error) {
          clearGenerationWatch()
          set({ loading: false, error: String(error?.message ?? error), generationFailed: false })
        }
      }
      const applyTemplate = template => {
        try {
          const bp = template.build()
          ensureLayout(bp)
          resetHistory()
          set({
            bp, missing: false, dirty: true, tab: 'usecase', activeLayerId: 'A', landing: false,
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
            { key: 'class', title: t('classDiagram'), nodes: [], edges: [] },
            { key: 'state', title: t('stateDiagram'), nodes: [], edges: [] },
            { key: 'flowchart', title: t('flowchart'), nodes: [], edges: [] },
          ],
          modules: [],
          createdAt: now,
          updatedAt: now,
        }
        resetHistory()
        set({ bp, missing: false, dirty: true, tab: 'usecase', activeLayerId: 'A', landing: false, canUndo: false, canRedo: false })
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
            store.generationFailed && store.aiBusy === null
              ? h('button', { className: 'bp-btn bp-primary', disabled: task.trim() === '', onClick: start },
                h(Icon, { name: 'spark', size: 15 }), t('retry'))
              : null,
            h('button', { className: 'bp-btn', onClick: continueOrStart }, existing ? t('continueEditing') : t('manualStart'))),
          store.aiBusy ? h('div', { className: 'bp-waiting' }, h('span', { className: 'bp-spinner' }), t('waiting')) : null,
          store.error ? h('div', { className: 'bp-error' }, store.error) : null))
    }

    function Section({ section, store, linkedRefs, focusedRef, traceCounts, onToggleFocus, items, indices, moduleLabels }) {
      const [open, setOpen] = useState(true)
      const [adding, setAdding] = useState(false)
      const [draft, setDraft] = useState('')
      const visibleItems = Array.isArray(items) ? items : section.items
      const sourceIndices = Array.isArray(indices) ? indices : visibleItems.map((_, index) => index)
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
            h('em', null, t('sectionCount', { count: visibleItems.length }))),
          h('div', { className: 'bp-section-tools' },
            button('bp-ghost', () => setAdding(value => !value), h(Icon, { name: 'plus', size: 14 }), { title: t('addItem') }),
            button('bp-ghost bp-spark', () => expandSection(section), h(Icon, { name: 'spark', size: 14 }), { title: t('expandSection') }))),
        open ? h('div', { className: 'bp-section-body' },
          visibleItems.map((item, index) => {
            const sourceIndex = sourceIndices[index] ?? index
            const ref = requirementRef(section.key, item.id ?? sourceIndex)
            const linked = linkedRefs?.has(ref) === true
            const focused = focusedRef === ref
            const traceCount = traceCounts?.get(ref) ?? 0
            const moduleLabel = moduleLabels?.get(ref)
            return h('div', {
              className: `bp-item${linked ? ' linked' : ''}${focused ? ' focused' : ''}`,
              key: item.id ?? sourceIndex,
              title: t('requirementsFocusHint'),
              onClick: event => {
                if (event.target?.closest?.('.bp-item-del') !== null) return
                onToggleFocus?.(ref)
              },
            },
              h('textarea', {
                className: 'bp-item-input', value: item.text, rows: Math.max(1, Math.ceil((String(item.text ?? '').length * 2 + 8) / 34)),
                onChange: event => mutate(bp => {
                  const target = bp.sections.find(entry => entry.key === section.key)
                  if (target?.items[sourceIndex] !== undefined) target.items[sourceIndex].text = event.target.value
                }),
              }),
              moduleLabel ? h('span', { className: 'bp-item-module', title: moduleLabel }, moduleLabel) : null,
              traceCount > 0 ? h('span', {
                className: `bp-item-trace${focused ? ' active' : ''}`,
                title: `${t('linkedNodes')}: ${traceCount}`,
              }, String(traceCount)) : null,
              h('button', {
                type: 'button', className: 'bp-item-del', title: t('delete'),
                onClick: event => {
                  event.stopPropagation()
                  mutate(bp => {
                    const target = bp.sections.find(entry => entry.key === section.key)
                    if (target !== undefined) target.items.splice(sourceIndex, 1)
                  })
                  if (focused) onToggleFocus?.(ref)
                },
              }, h(Icon, { name: 'trash', size: 13 })))
          }),
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
      const [includeDescendants, setIncludeDescendants] = useState(false)
      if (bp === null) return null
      const activeLayerId = store.activeLayerId ?? 'A'
      const currentLayer = layerByLetter(bp, activeLayerId) ?? layerList(bp)[0]
      const currentDiagram = currentDiagramFor(bp, store.tab, activeLayerId)
      const selectedNode = store.selected?.kind === 'node'
        ? currentDiagram?.nodes.find(node => node.id === store.selected.id)
        : undefined
      const linkedRefs = new Set(Array.isArray(selectedNode?.requirementIds) ? selectedNode.requirementIds : [])
      const traceCounts = new Map()
      for (const diagram of bp.diagrams) {
        for (const node of diagram.nodes ?? []) {
          for (const ref of node.requirementIds ?? []) traceCounts.set(ref, (traceCounts.get(ref) ?? 0) + 1)
        }
      }
      const layerIds = includeDescendants ? descendantLayerIds(bp, activeLayerId) : new Set([activeLayerId])
      const moduleForItem = item => item?.moduleId === undefined ? undefined : moduleById(bp, item.moduleId)
      const itemLayer = item => {
        const module = moduleForItem(item)
        return module?.layerId ?? null
      }
      const isUnassigned = item => moduleForItem(item) === undefined
      const visibleItem = item => isUnassigned(item) || layerIds.has(itemLayer(item))
      const moduleLabels = new Map()
      let visibleCount = 0
      let unassignedCount = 0
      let subtreeCount = 0
      let foreignCount = 0
      const visibleSections = bp.sections.map(section => {
        const items = []
        const indices = []
        ;(section.items ?? []).forEach((item, index) => {
          const layerId = itemLayer(item)
          if (isUnassigned(item)) unassignedCount += 1
          else if (layerId !== activeLayerId && layerIds.has(layerId)) subtreeCount += 1
          else if (layerId !== null && !layerIds.has(layerId)) foreignCount += 1
          if (!visibleItem(item)) return
          items.push(item)
          indices.push(index)
          visibleCount += 1
          const module = moduleForItem(item)
          if (module !== undefined) moduleLabels.set(requirementRef(section.key, item.id ?? index), `${module.code ?? ''} ${module.name ?? ''}`.trim())
        })
        return { section, items, indices }
      })
      const toggleRequirementFocus = ref => {
        if (state.focusRequirement === ref) {
          set({ focusRequirement: null })
          return
        }
        const linkedDiagram = diagramsForLayer(bp, activeLayerId).find(diagram =>
          (diagram.nodes ?? []).some(node => (node.requirementIds ?? []).includes(ref)))
          ?? bp.diagrams.find(diagram =>
            (diagram.nodes ?? []).some(node => (node.requirementIds ?? []).includes(ref)))
        if (linkedDiagram === undefined) {
          set({ focusRequirement: ref })
          return
        }
        set({
          focusRequirement: ref,
          activeLayerId: diagramLayerId(linkedDiagram),
          tab: linkedDiagram.key,
          selected: null,
          mode: 'select',
          connectFrom: null,
        })
      }
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
          h('div', { className: 'bp-layer-chip', title: currentLayer.title ?? currentLayer.letter },
            h('strong', null, currentLayer.letter ?? currentLayer.id),
            h('span', null, currentLayer.title ?? '')),
          h('input', {
            className: 'bp-title-input', value: bp.title, placeholder: t('titlePlaceholder'),
            onChange: event => mutate(current => { current.title = event.target.value }),
          }),
          h('textarea', {
            className: 'bp-summary-input', value: bp.summary ?? '', rows: 2,
            placeholder: t('summaryPlaceholder'),
            onChange: event => mutate(current => { current.summary = event.target.value }),
          }),
          h('div', { className: 'bp-layer-summary' },
            h('div', null, t('layerSummary', { visible: visibleCount, unassigned: unassignedCount, subtree: subtreeCount })),
            h('label', { className: 'bp-check' },
              h('input', { type: 'checkbox', checked: includeDescendants, onChange: event => setIncludeDescendants(event.target.checked) }),
              t('includeDescendants')),
            foreignCount > 0 ? h('div', { className: 'bp-layer-gap' }, t('layerGap', { count: foreignCount })) : null)),
        h('div', { className: 'bp-sections' },
          visibleSections.map(entry => h(Section, {
            key: entry.section.key, section: entry.section, store,
            linkedRefs, focusedRef: store.focusRequirement, traceCounts,
            onToggleFocus: toggleRequirementFocus,
            items: entry.items, indices: entry.indices, moduleLabels,
          })),
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

    function flowConditionWidth(condition) {
      const lines = wrapLines(String(condition ?? ''), 200).slice(0, 2)
      if (lines.length === 0) return 0
      return Math.min(260, Math.max(...lines.map(line =>
        [...line].reduce((sum, char) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 11 : 6.5), 0))) + 18)
    }

    function NodeShape({ node, selected, highlighted, onPointerDown, onClick, onDoubleClick, onEnterChild, childLayer, diagramType, index, onToggleGroup }) {
      const size = sizeOf(node)
      const w = size.w
      const height = size.h
      const meta = TYPE_META[node.type] ?? TYPE_META.usecase
      const color = meta.color
      const lines = wrapLines(node.label, w - 24)
      const shape = []
      const isFlowchart = diagramType === 'flowchart'
      if (isFlowchart && node.type === 'group') {
        const collapsed = node.collapsed === true
        const headerHeight = 40
        shape.push(
          h('rect', {
            key: 'shape', x: 0, y: 0, width: w, height: collapsed ? headerHeight : height, rx: 12,
            fill: `color-mix(in srgb, ${color} 7%, transparent)`,
            stroke: color, strokeWidth: 1.6, strokeDasharray: '7 5',
            pointerEvents: 'none',
          }),
          h('rect', {
            key: 'head', x: 0, y: 0, width: w, height: headerHeight, rx: 12,
            fill: `color-mix(in srgb, ${color} 15%, transparent)`,
            pointerEvents: 'none',
          }),
          h('text', {
            key: 'marker', x: 13, y: 25, fill: color, fontSize: 13, fontWeight: 700, pointerEvents: 'none',
          }, collapsed ? '▶' : '▼'),
          h('text', {
            key: 'label', x: 32, y: 25, fill: 'var(--dsw-alias-label-primary)', fontSize: 12.5, fontWeight: 650, pointerEvents: 'none',
          }, String(node.label ?? '').length > Math.max(8, Math.floor((w - 60) / 7))
            ? `${String(node.label ?? '').slice(0, Math.max(8, Math.floor((w - 60) / 7)))}…`
            : String(node.label ?? '')),
          h('rect', {
            key: 'hit', x: 0, y: 0, width: w, height: headerHeight, rx: 12, fill: 'transparent',
            style: { cursor: 'pointer' },
            onPointerDown: event => event.stopPropagation(),
            onClick: event => {
              event.stopPropagation()
              if (onToggleGroup !== undefined) onToggleGroup(node)
              else onClick?.(event)
            },
          }),
          h('title', null, collapsed ? t('collapsed') : t('flowGroup')))
        if (!collapsed && height > headerHeight + 10) {
          shape.push(h('line', {
            key: 'rule', x1: 0, y1: headerHeight, x2: w, y2: headerHeight,
            stroke: color, strokeWidth: 1, opacity: 0.45, pointerEvents: 'none',
          }))
        }
      } else if (isFlowchart && node.type === 'note') {
        const fold = Math.min(20, height / 3)
        shape.push(
          h('path', {
            key: 'shape',
            d: `M0 0H${w - fold}L${w} ${fold}V${height}H0Z`,
            fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.6,
          }),
          h('path', {
            key: 'fold', d: `M${w - fold} 0V${fold}H${w}`,
            fill: `color-mix(in srgb, ${color} 22%, transparent)`, stroke: color, strokeWidth: 1.3,
          }),
          labelText(w / 2, height / 2 + (lines.length === 1 ? 4 : -2), lines, { size: 12 }))
      } else if (isFlowchart && (node.type === 'start' || node.type === 'end')) {
        shape.push(
          h('rect', {
            key: 'shape', x: 0, y: 0, width: w, height, rx: height / 2,
            fill: `color-mix(in srgb, ${color} 16%, transparent)`, stroke: color, strokeWidth: 1.8,
          }),
          labelText(w / 2, height / 2 + 4, lines, { weight: 650 }))
      } else if (isFlowchart && node.type === 'decision') {
        shape.push(
          h('polygon', {
            key: 'shape',
            points: `${w / 2},2 ${w - 2},${height / 2} ${w / 2},${height - 2} 2,${height / 2}`,
            fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.9,
          }),
          labelText(w / 2, height / 2 + (lines.length === 1 ? 4 : 0), wrapLines(node.label, w * 0.55), { weight: 600, size: 12 }))
        if (typeof node.condition === 'string' && node.condition.trim() !== '') {
          const conditionLines = wrapLines(node.condition, 200).slice(0, 2)
          const conditionWidth = flowConditionWidth(node.condition)
          const conditionTop = height / 2 - conditionLines.length * 7 - 3
          shape.push(h('g', { key: 'condition' },
            h('rect', {
              x: w + 10, y: conditionTop, width: conditionWidth, height: conditionLines.length * 14 + 8, rx: 6,
              fill: 'var(--dsw-alias-bg-base)', stroke: 'var(--dsw-alias-border-l1)',
            }),
            h('text', {
              x: w + 19, y: conditionTop + 15, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.8, fontWeight: 600,
            }, conditionLines.map((line, lineIndex) => h('tspan', {
              key: lineIndex, x: w + 19, dy: lineIndex === 0 ? 0 : 13,
            }, line)))))
        }
      } else if (isFlowchart && node.type === 'process') {
        shape.push(
          h('rect', {
            key: 'shape', x: 0, y: 0, width: w, height, rx: 8,
            fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8,
          }),
          h('rect', { key: 'bar', x: 0, y: 0, width: 5, height, rx: 2.5, fill: color }),
          labelText(w / 2, height / 2 + (lines.length === 1 ? 4 : -2), lines, { weight: 550 }))
      } else if (node.type === 'actor') {
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
      } else if (node.type === 'entity' && diagramType === 'er') {
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
      } else if (node.type === 'class' || node.type === 'interface') {
        const members = node.fields ?? []
        const isInterface = node.type === 'interface'
        const headerHeight = isInterface ? 54 : 40
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 6, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('rect', { key: 'header', x: 0, y: 0, width: w, height: headerHeight, rx: 6, fill: color, opacity: 0.16 }),
          h('line', { key: 'rule', x1: 0, y1: headerHeight, x2: w, y2: headerHeight, stroke: color, strokeWidth: 1.2, opacity: 0.5 }))
        if (isInterface) {
          shape.push(h('text', { key: 'stereotype', x: w / 2, y: 16, textAnchor: 'middle', fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5, fontWeight: 600 }, '<<interface>>'))
        }
        shape.push(h('text', {
          key: 'label', x: 12, y: isInterface ? 38 : 25, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 700,
        }, node.label))
        members.forEach((member, index) => {
          const y = headerHeight + 15 + index * 19
          const isMethod = member.kind === 'method'
          shape.push(h('text', {
            key: `m-${index}`, x: 12, y, fill: 'var(--dsw-alias-label-primary)', fontSize: 10.8,
            fontWeight: member.key ? 700 : 400,
          }, `${isMethod ? '+' : ''}${member.name}${isMethod ? '()' : ''}`))
          if (member.type) {
            shape.push(h('text', {
              key: `mt-${index}`, x: w - 12, y, textAnchor: 'end', fill: 'var(--dsw-alias-label-secondary)', fontSize: 10,
            }, member.type))
          }
        })
      } else if (node.type === 'initial') {
        shape.push(h('circle', {
          key: 'shape', cx: w / 2, cy: height / 2, r: Math.max(6, Math.min(w, height) / 2 - 2),
          fill: color, stroke: color, strokeWidth: 1.8,
        }))
      } else if (node.type === 'final') {
        shape.push(
          h('circle', { key: 'outer', cx: w / 2, cy: height / 2, r: Math.max(7, Math.min(w, height) / 2 - 2), fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 2 }),
          h('circle', { key: 'inner', cx: w / 2, cy: height / 2, r: Math.max(4, Math.min(w, height) / 2 - 7), fill: color }))
      } else if (node.type === 'choice') {
        shape.push(
          h('polygon', { key: 'shape', points: `${w / 2},2 ${w - 2},${height / 2} ${w / 2},${height - 2} 2,${height / 2}`, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          labelText(w / 2, height / 2 + 4, wrapLines(node.label, w - 8), { size: 10.5, weight: 600 }))
      } else if (node.type === 'state') {
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 16, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('rect', { key: 'bar', x: 10, y: 0, width: w - 20, height: 4, rx: 2, fill: color, opacity: 0.8 }),
          labelText(w / 2, height / 2 + (lines.length === 1 ? 4 : 0), lines, { weight: 600 }))
      } else if (node.type === 'person') {
        const cx = 24
        shape.push(
          h('rect', { key: 'shape', x: 0, y: 0, width: w, height, rx: 10, fill: 'var(--dsw-alias-bg-layer-1)', stroke: color, strokeWidth: 1.8 }),
          h('circle', { key: 'head', cx, cy: 24, r: 7, fill: 'none', stroke: color, strokeWidth: 1.8 }),
          h('path', { key: 'body', d: `M${cx - 11} 48c0-8 5-13 11-13s11 5 11 13`, fill: 'none', stroke: color, strokeWidth: 1.8 }),
          h('text', { key: 'label', x: 46, y: 28, fill: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 650 }, node.label))
        if (node.technology) shape.push(h('text', { key: 'tech', x: 46, y: 46, fill: 'var(--dsw-alias-label-secondary)', fontSize: 10.5 }, node.technology))
      } else if (node.type === 'container' || node.type === 'component' || node.type === 'database' || (node.type === 'external' && diagramType === 'c4')) {
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
      } else if (node.type === 'system' && diagramType === 'c4') {
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
      const outlineHeight = isFlowchart && node.type === 'group' && node.collapsed === true ? 40 : height
      return h('g', {
        transform: `translate(${node.x ?? 0} ${node.y ?? 0})`,
        className: `bp-node${selected ? ' selected' : ''}${highlighted ? ' linked' : ''}`,
        onPointerDown,
        onClick,
        onDoubleClick: childLayer !== undefined && childLayer !== null ? onDoubleClick : undefined,
        style: { cursor: childLayer !== undefined && childLayer !== null ? 'pointer' : 'grab' },
        'data-node-id': node.id,
        'data-node-index': index,
        'data-module-id': node.moduleId,
      },
        highlighted && !selected ? h('rect', {
          key: 'linked-halo', x: -6, y: -6, width: w + 12, height: outlineHeight + 12, rx: 12,
          fill: 'none', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 2, strokeDasharray: '4 4',
          className: 'bp-node-linked',
        }) : null,
        selected ? h('rect', { x: -6, y: -6, width: w + 12, height: outlineHeight + 12, rx: 12, fill: 'none', stroke: 'var(--dsw-alias-brand-primary)', strokeWidth: 1.4, strokeDasharray: '5 4' }) : null,
        shape,
        childLayer !== undefined && childLayer !== null ? h('g', {
          key: 'enter-child',
          className: 'bp-node-enter',
          transform: `translate(${w - 18} 4)`,
          onPointerDown: event => event.stopPropagation(),
          onClick: event => {
            event.stopPropagation()
            onEnterChild?.(childLayer)
          },
        },
          h('title', null, t('enterChildLayer')),
          h('circle', { cx: 10, cy: 10, r: 10, fill: 'var(--dsw-alias-brand-primary)', opacity: 0.92 }),
          h('text', { x: 10, y: 14, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: '#fff' }, '↗')) : null)
    }

    function rectEdgePoint(node, size, towardX, towardY) {
      const cx = (node.x ?? 0) + size.w / 2
      const cy = (node.y ?? 0) + size.h / 2
      const dx = towardX - cx
      const dy = towardY - cy
      if (dx === 0 && dy === 0) return { x: cx, y: cy }
      const scaleX = dx === 0 ? Infinity : size.w / 2 / Math.abs(dx)
      const scaleY = dy === 0 ? Infinity : size.h / 2 / Math.abs(dy)
      const scale = Math.min(scaleX, scaleY)
      return { x: cx + dx * scale, y: cy + dy * scale }
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
      if (diagramTypeOf(diagram) === 'class' || diagramTypeOf(diagram) === 'state') {
        const start = rectEdgePoint(from, a, x2, y2)
        const end = rectEdgePoint(to, b, x1, y1)
        return { x1: start.x, y1: start.y, x2: end.x, y2: end.y, mx: (start.x + end.x) / 2, my: (start.y + end.y) / 2 }
      }
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const shortX = x2 - Math.cos(angle) * Math.min(b.w, b.h) * 0.42
      const shortY = y2 - Math.sin(angle) * Math.min(b.w, b.h) * 0.42
      return { x1, y1, x2: shortX, y2: shortY, mx: (x1 + shortX) / 2, my: (y1 + shortY) / 2 }
    }

    // Orthogonal / polyline routing for plan flowcharts. Edges leave from a side
    // of the source rect and enter a side of the target rect, so branches and
    // merges keep clean vertical trunks.
    function flowchartEdgeGeometry(diagram, edge) {
      const from = diagram.nodes.find(node => node.id === edge.from)
      const to = diagram.nodes.find(node => node.id === edge.to)
      if (from === undefined || to === undefined) return null
      const a = sizeOf(from)
      const b = sizeOf(to)
      const fx = from.x ?? 0
      const fy = from.y ?? 0
      const tx = to.x ?? 0
      const ty = to.y ?? 0
      const fcx = fx + a.w / 2
      const tcx = tx + b.w / 2
      let points
      if (from.id === to.id) {
        const x = fx + a.w
        const y = fy + a.h / 2
        points = [{ x, y }, { x: x + 46, y }, { x: x + 46, y: y - 42 }, { x: fx + a.w - 12, y: y - 42 }]
      } else if (ty >= fy + a.h - 4) {
        const startY = fy + a.h
        if (Math.abs(fcx - tcx) < 2) {
          points = [{ x: fcx, y: startY }, { x: tcx, y: ty }]
        } else {
          const midY = (startY + ty) / 2
          points = [{ x: fcx, y: startY }, { x: fcx, y: midY }, { x: tcx, y: midY }, { x: tcx, y: ty }]
        }
      } else if (ty + b.h <= fy + 4) {
        const endY = ty + b.h
        if (Math.abs(fcx - tcx) < 2) {
          points = [{ x: fcx, y: fy }, { x: tcx, y: endY }]
        } else {
          const midY = (fy + endY) / 2
          points = [{ x: fcx, y: fy }, { x: fcx, y: midY }, { x: tcx, y: midY }, { x: tcx, y: endY }]
        }
      } else {
        const startY = fy + a.h / 2
        const endY = ty + b.h / 2
        if (tcx >= fcx) {
          const startX = fx + a.w
          const endX = tx
          const midX = (startX + endX) / 2
          points = [{ x: startX, y: startY }, { x: midX, y: startY }, { x: midX, y: endY }, { x: endX, y: endY }]
        } else {
          const startX = fx
          const endX = tx + b.w
          const midX = (startX + endX) / 2
          points = [{ x: startX, y: startY }, { x: midX, y: startY }, { x: midX, y: endY }, { x: endX, y: endY }]
        }
      }
      const middle = points.length >= 4
        ? { x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2 }
        : { x: (points[0].x + points[points.length - 1].x) / 2, y: (points[0].y + points[points.length - 1].y) / 2 }
      const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
      return {
        points,
        d,
        x1: points[0].x,
        y1: points[0].y,
        x2: points[points.length - 1].x,
        y2: points[points.length - 1].y,
        mx: middle.x,
        my: middle.y,
      }
    }

    function Edge({ diagram, edge, selected, onSelect }) {
      const isFlowchart = diagramTypeOf(diagram) === 'flowchart'
      const geo = isFlowchart ? flowchartEdgeGeometry(diagram, edge) : edgeGeometry(diagram, edge)
      if (geo === null) return null
      const dashed = isFlowchart
        ? edge.kind === 'dashed'
        : ['depends', 'include', 'return', 'implements', 'dependency'].includes(edge.kind)
      const relationKind = diagramTypeOf(diagram) === 'class' && ['extends', 'implements', 'association', 'dependency'].includes(edge.kind)
      const displayLabel = typeof edge.label === 'string' && edge.label.trim() !== ''
        ? edge.label
        : relationKind ? t(edge.kind) : ''
      const showLabel = displayLabel !== ''
      const width = showLabel ? Math.min(200, displayLabel.length * 12 + 14) : 0
      return h('g', {
        className: `bp-edge${selected ? ' selected' : ''}`,
        onClick: event => { event.stopPropagation(); onSelect() },
        style: { cursor: 'pointer' },
      },
        isFlowchart
          ? h('path', { d: geo.d, fill: 'none', stroke: 'transparent', strokeWidth: 14 })
          : h('line', { x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2, stroke: 'transparent', strokeWidth: 14 }),
        isFlowchart
          ? h('path', {
              d: geo.d, fill: 'none',
              stroke: selected ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
              strokeWidth: selected ? 2 : 1.5,
              strokeDasharray: dashed ? '6 4' : undefined,
              strokeLinejoin: 'round',
              markerEnd: 'url(#bp-arrow)',
            })
          : h('line', {
              x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2,
              stroke: selected ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
              strokeWidth: selected ? 2 : 1.5,
              strokeDasharray: dashed ? '6 4' : undefined,
              markerEnd: 'url(#bp-arrow)',
            }),
        showLabel ? h('g', null,
          h('rect', { x: geo.mx - width / 2, y: geo.my - 10, width, height: 20, rx: 6, fill: 'var(--dsw-alias-bg-base)', stroke: 'var(--dsw-alias-border-l1)' }),
          h('text', { x: geo.mx, y: geo.my + 4, textAnchor: 'middle', fontSize: 11, fill: 'var(--dsw-alias-label-secondary)' }, displayLabel)) : null,
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
      const hiddenIds = diagramTypeOf(diagram) === 'flowchart' ? flowchartHiddenIds(nodes) : new Set()
      const isFlowchart = diagramTypeOf(diagram) === 'flowchart'
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const node of nodes) {
        if (hiddenIds.has(node.id)) continue
        const size = sizeOf(node)
        minX = Math.min(minX, node.x ?? 0)
        minY = Math.min(minY, node.y ?? 0)
        const conditionExtra = isFlowchart && node.type === 'decision' && typeof node.condition === 'string' && node.condition.trim() !== ''
          ? flowConditionWidth(node.condition) + 10
          : 0
        maxX = Math.max(maxX, (node.x ?? 0) + size.w + conditionExtra)
        maxY = Math.max(maxY, (node.y ?? 0) + size.h)
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return { x: 70, y: 30, zoom: 1 }
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
      const diagram = currentDiagramFor(bp, store.tab, store.activeLayerId)
        ?? (bp?.diagrams ?? []).find(item => item.key === store.tab)
        ?? bp?.diagrams[0]
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
      }, [store.tab, store.activeLayerId])

      if (diagram === undefined) return null
      const tabKey = diagram.key
      const diagramType = diagramTypeOf(diagram)

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
          const target = current.diagrams.find(item => item.key === tabKey)
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
          const target = current.diagrams.find(item => item.key === tabKey)
          if (target === undefined) return
          const edge = { id, from, to, kind: defaultEdgeKind(diagramType) }
          if (diagramType === 'sequence') edge.order = (target.edges?.length ?? 0) + 1
          target.edges.push(edge)
        })
        set({ connectFrom: null, mode: 'select', selected: { kind: 'edge', id } })
      }

      const toggleGroup = node => {
        mutate(current => {
          const target = current.diagrams.find(item => item.key === tabKey)
          const found = target?.nodes.find(item => item.id === node.id)
          if (found !== undefined) found.collapsed = found.collapsed !== true
        }, { undoLabel: 'toggle-group' })
        set({ selected: { kind: 'node', id: node.id } })
      }

      const hiddenIds = diagramType === 'flowchart' ? flowchartHiddenIds(diagram.nodes ?? []) : new Set()
      const ordered = [...(diagram.nodes ?? [])]
        .filter(node => !hiddenIds.has(node.id))
        .sort((a, b) => {
          if (diagramType === 'flowchart') {
            const rank = node => (node.type === 'group' ? 0 : node.type === 'note' ? 2 : 1)
            return rank(a) - rank(b)
          }
          return a.type === 'system' ? -1 : b.type === 'system' ? 1 : 0
        })
      const visibleEdges = (diagram.edges ?? []).filter(edge =>
        !hiddenIds.has(edge.from) && !hiddenIds.has(edge.to))
      const focusedRequirement = store.focusRequirement
      const highlightedNodes = new Set(
        focusedRequirement === null || focusedRequirement === undefined
          ? []
          : (diagram.nodes ?? [])
              .filter(node => (node.requirementIds ?? []).includes(focusedRequirement))
              .map(node => node.id),
      )
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
            diagramType === 'sequence'
              ? h(SequenceLayer, {
                  diagram,
                  selectedId: store.selected?.kind === 'edge' ? store.selected.id : null,
                  onSelect: id => set({ selected: { kind: 'edge', id } }),
                })
              : visibleEdges.map(edge => h(Edge, {
                  key: edge.id, diagram, edge,
                  selected: store.selected?.kind === 'edge' && store.selected.id === edge.id,
                  onSelect: () => set({ selected: { kind: 'edge', id: edge.id } }),
                })),
            ordered.map((node, index) => {
              const module = node.type === 'module' ? moduleForNode(bp, node, diagramLayerId(diagram)) : undefined
              const displayNode = module === undefined
                ? node
                : { ...node, moduleId: module.id, label: `${module.code ?? ''} ${module.name ?? ''}`.trim() }
              const childLayer = module === undefined
                ? undefined
                : (bp.layers ?? []).find(layer => layer.parentModuleId === module.id)
              return h(NodeShape, {
                key: node.id, node: displayNode,
                diagramType,
                childLayer,
                onEnterChild: childLayer === undefined ? undefined : () => activateLayer(childLayer.letter),
                onDoubleClick: childLayer === undefined ? undefined : event => {
                  event.stopPropagation()
                  activateLayer(childLayer.letter)
                },
                onToggleGroup: diagramType === 'flowchart' ? toggleGroup : undefined,
                index,
                selected: store.selected?.kind === 'node' && store.selected.id === node.id,
                highlighted: highlightedNodes.has(node.id),
                onPointerDown: event => onNodeDown(displayNode, event),
                onClick: event => onNodeClick(displayNode, event),
              })
            }),
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
      const diagram = currentDiagramFor(bp, store.tab, store.activeLayerId)
      const diagramType = diagramTypeOf(diagram)
      const tabKey = diagram?.key ?? store.tab
      const node = selected?.kind === 'node' ? diagram?.nodes.find(item => item.id === selected.id) : undefined
      const edge = selected?.kind === 'edge' ? diagram?.edges.find(item => item.id === selected.id) : undefined

      const updateNode = patchFn => mutate(current => {
        const target = current.diagrams.find(item => item.key === tabKey)
        const found = target?.nodes.find(item => item.id === selected.id)
        if (found !== undefined) patchFn(found)
      })
      const updateEdge = patchFn => mutate(current => {
        const target = current.diagrams.find(item => item.key === tabKey)
        const found = target?.edges.find(item => item.id === selected.id)
        if (found !== undefined) patchFn(found)
      })

      if (node !== undefined) {
        const isErEntity = diagramType === 'er' && node.type === 'entity'
        const isClassNode = diagramType === 'class' && (node.type === 'class' || node.type === 'interface')
        const isC4 = diagramType === 'c4'
        const isFlowchart = diagramType === 'flowchart'
        const groupOptions = isFlowchart
          ? (diagram?.nodes ?? []).filter(item => item.type === 'group' && item.id !== node.id)
          : []
        return h('div', { className: 'bp-inspector' },
          h('div', { className: 'bp-kicker' }, t('inspector')),
          h('label', { className: 'bp-field' }, h('span', null, t('nodeLabel')),
            h('input', { className: 'bp-input', value: node.label, onChange: event => updateNode(found => { found.label = event.target.value }) })),
          h('label', { className: 'bp-field' }, h('span', null, t('nodeType')),
            h('select', { className: 'bp-input', value: node.type, onChange: event => updateNode(found => {
              found.type = event.target.value
              const meta = TYPE_META[event.target.value]
              if (meta) { found.w = meta.w; found.h = meta.h }
            }) }, typesFor(diagramType).map(type => h('option', { key: type, value: type }, typeLabel(type, diagramType))))),
          isFlowchart && node.type === 'decision' ? h('label', { className: 'bp-field' }, h('span', null, t('condition')),
            h('input', { className: 'bp-input', value: node.condition ?? '', onChange: event => updateNode(found => { found.condition = event.target.value }) })) : null,
          isFlowchart ? h('label', { className: 'bp-field' }, h('span', null, t('owner')),
            h('input', { className: 'bp-input', value: node.owner ?? '', onChange: event => updateNode(found => { found.owner = event.target.value }) })) : null,
          isFlowchart ? h('label', { className: 'bp-field' }, h('span', null, t('nodeVerification')),
            h('input', { className: 'bp-input', value: node.verification ?? '', onChange: event => updateNode(found => { found.verification = event.target.value }) })) : null,
          isFlowchart ? h('label', { className: 'bp-field' }, h('span', null, t('parentGroup')),
            h('select', {
              className: 'bp-input', value: node.parentGroup ?? '',
              onChange: event => updateNode(found => {
                const value = event.target.value
                if (value === '') delete found.parentGroup
                else found.parentGroup = value
              }),
            },
              h('option', { value: '' }, t('noParentGroup')),
              groupOptions.map(group => h('option', { key: group.id, value: group.id }, group.label ?? group.id)))) : null,
          isFlowchart && node.type === 'group' ? h('label', { className: 'bp-check' },
            h('input', {
              type: 'checkbox', checked: node.collapsed === true,
              onChange: event => updateNode(found => { found.collapsed = event.target.checked }),
            }), t('collapsed')) : null,
          isC4 ? h('label', { className: 'bp-field' }, h('span', null, t('technology')),
            h('input', { className: 'bp-input', value: node.technology ?? '', onChange: event => updateNode(found => { found.technology = event.target.value }) })) : null,
          node.type === 'system' || node.type === 'module' || node.type === 'usecase' || isC4
            ? h('label', { className: 'bp-field' }, h('span', null, t('notes')),
                h('textarea', { className: 'bp-input', rows: 3, value: node.description ?? '', onChange: event => updateNode(found => { found.description = event.target.value }) }))
            : null,
          h('div', { className: 'bp-field' },
            h('span', null, t('linkedRequirements')),
            h('div', { className: 'bp-req-hint' }, t('requirementPickerHint')),
            bp.sections.some(section => section.items.length > 0)
              ? h('div', { className: 'bp-req-list' },
                  bp.sections.map(section => h('div', { className: 'bp-req-group', key: section.key },
                    h('div', { className: 'bp-req-group-title' }, section.title),
                    section.items.length === 0
                      ? h('div', { className: 'bp-req-empty' }, '—')
                      : section.items.map((item, index) => {
                          const ref = requirementRef(section.key, item.id ?? index)
                          const checked = (node.requirementIds ?? []).includes(ref)
                          return h('label', { className: 'bp-req-option', key: ref, title: item.text },
                            h('input', {
                              type: 'checkbox', checked,
                              onChange: () => updateNode(found => {
                                found.requirementIds = toggleTraceValue(found.requirementIds, ref)
                              }),
                            }),
                            h('span', { className: 'bp-req-text' }, `${section.title} · ${item.text}`))
                        }))))
              : h('div', { className: 'bp-muted' }, t('noRequirements'))),
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
          isClassNode ? h('div', { className: 'bp-field' },
            h('span', null, t('members')),
            h('div', { className: 'bp-fields' },
              (node.fields ?? []).map((field, index) => h('div', { className: 'bp-field-row', key: index },
                h('select', {
                  className: 'bp-input bp-field-kind', value: field.kind === 'method' ? 'method' : 'field',
                  onChange: event => updateNode(found => {
                    if (found.fields?.[index] !== undefined) found.fields[index].kind = event.target.value
                  }),
                },
                  h('option', { value: 'field' }, t('field')),
                  h('option', { value: 'method' }, t('method'))),
                h('input', { className: 'bp-input bp-field-name', value: field.name, placeholder: t('fieldName'), onChange: event => updateNode(found => {
                  if (found.fields?.[index] !== undefined) found.fields[index].name = event.target.value
                }) }),
                h('input', { className: 'bp-input bp-field-type', value: field.type ?? '', placeholder: t('fieldType'), onChange: event => updateNode(found => {
                  if (found.fields?.[index] !== undefined) found.fields[index].type = event.target.value
                }) }),
                h('button', { type: 'button', className: 'bp-item-del', onClick: () => updateNode(found => {
                  found.fields = (found.fields ?? []).filter((_, itemIndex) => itemIndex !== index)
                }) }, h(Icon, { name: 'trash', size: 12 })))),
              h('div', { className: 'bp-field-actions' },
                h('button', { type: 'button', className: 'bp-btn bp-add-field', onClick: () => updateNode(found => {
                  found.fields = [...(found.fields ?? []), { name: `field_${(found.fields?.length ?? 0) + 1}`, type: 'text', kind: 'field' }]
                }) }, h(Icon, { name: 'plus', size: 13 }), t('addField')),
                h('button', { type: 'button', className: 'bp-btn bp-add-field', onClick: () => updateNode(found => {
                  found.fields = [...(found.fields ?? []), { name: `method_${(found.fields?.length ?? 0) + 1}`, type: 'void', kind: 'method' }]
                }) }, h(Icon, { name: 'plus', size: 13 }), t('addMethod')))))
            : null,
          h('button', { className: 'bp-btn bp-danger', onClick: deleteSelection }, h(Icon, { name: 'trash', size: 14 }), t('deleteNode')))
      }
      if (edge !== undefined) {
        const edgeKinds = edgeKindsFor(diagramType)
        return h('div', { className: 'bp-inspector' },
          h('div', { className: 'bp-kicker' }, t('inspector')),
          h('label', { className: 'bp-field' }, h('span', null, diagramType === 'sequence' ? t('message') : t('edgeLabel')),
            h('input', { className: 'bp-input', value: edge.label ?? '', onChange: event => updateEdge(found => { found.label = event.target.value }) })),
          h('label', { className: 'bp-field' }, h('span', null, t('edgeKind')),
            h('select', { className: 'bp-input', value: edge.kind ?? defaultEdgeKind(diagramType), onChange: event => updateEdge(found => { found.kind = event.target.value }) },
              edgeKinds.map(kind => h('option', { key: kind, value: kind }, t(kind))))),
          diagramType === 'er' ? h('label', { className: 'bp-field' }, h('span', null, t('cardinality')),
            h('input', { className: 'bp-input', value: edge.cardinality ?? '', placeholder: '1..*', onChange: event => updateEdge(found => { found.cardinality = event.target.value }) })) : null,
          diagramType === 'sequence' ? h('label', { className: 'bp-field' }, h('span', null, t('order')),
            h('input', { className: 'bp-input', type: 'number', value: edge.order ?? 1, onChange: event => updateEdge(found => { found.order = Number(event.target.value) || 1 }) })) : null,
          diagramType === 'c4' ? h('label', { className: 'bp-field' }, h('span', null, t('technology')),
            h('input', { className: 'bp-input', value: edge.technology ?? '', onChange: event => updateEdge(found => { found.technology = event.target.value }) })) : null,
          h('button', { className: 'bp-btn bp-danger', onClick: deleteSelection }, h(Icon, { name: 'trash', size: 14 }), t('deleteEdge')))
      }
      return h('div', { className: 'bp-inspector bp-muted' }, t('noSelection'))
    }

    function deleteSelection() {
      const selected = state.selected
      if (selected === null) return
      mutate(current => {
        const diagram = currentDiagramFor(current, state.tab, state.activeLayerId)
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

    function LineListEditor({ value, placeholder, rows, onCommit }) {
      const serialized = (Array.isArray(value) ? value : []).join('\n')
      const [draft, setDraft] = useState(serialized)
      useEffect(() => { setDraft(serialized) }, [serialized])
      return h('textarea', {
        className: 'bp-input', rows: rows ?? 3, value: draft, placeholder,
        onChange: event => setDraft(event.target.value),
        onBlur: () => onCommit(linesToList(draft)),
      })
    }

    function VerificationBadges({ module }) {
      const verification = moduleVerification(module)
      const complete = verificationAllPassed(module)
      return h('div', { className: 'bp-verification' },
        h('div', { className: 'bp-verification-head' },
          h('span', { className: 'bp-verification-title' }, t('verification')),
          h('span', { className: `bp-chip ${complete ? 'bp-chip-verify-passed' : 'bp-chip-verify-pending'}` },
            complete ? t('verificationAllPassed') : t('verificationIncomplete'))),
        h('div', { className: 'bp-verification-layers' },
          VERIFICATION_ROLES.map(role => {
            const entry = verification[role]
            const last = entry.evidence.length > 0 ? entry.evidence[entry.evidence.length - 1] : ''
            const title = entry.evidence.length > 0 ? entry.evidence.join('\n') : t('verificationNoEvidence')
            return h('div', { className: 'bp-verification-layer', key: role, title },
              h('span', { className: 'bp-verification-role' }, verificationRoleLabel(role)),
              h('span', { className: `bp-chip bp-chip-verify-${entry.status}` }, verificationStatusLabel(entry.status)),
              h('span', { className: 'bp-verification-evidence' },
                last === '' ? t('verificationNoEvidence') : `${t('verificationEvidence')}: ${last}`))
          })))
    }

    function VerificationEditor({ module, onRecord }) {
      const [role, setRole] = useState('tests')
      const [status, setStatus] = useState('passed')
      const [evidence, setEvidence] = useState('')
      const [busy, setBusy] = useState(false)
      const submit = async () => {
        if (busy) return
        setBusy(true)
        const saved = await onRecord(module, role, status, evidence.trim())
        setBusy(false)
        if (saved) setEvidence('')
      }
      return h('div', { className: 'bp-verification-editor', onClick: event => event.stopPropagation() },
        h('div', { className: 'bp-verification-title' }, t('verificationRecord')),
        h('div', { className: 'bp-verification-form' },
          h('label', { className: 'bp-verification-field' }, h('span', null, t('verificationRole')),
            h('select', {
              className: 'bp-input', value: role,
              onChange: event => setRole(event.target.value),
            }, VERIFICATION_ROLES.map(item => h('option', { key: item, value: item }, verificationRoleLabel(item))))),
          h('label', { className: 'bp-verification-field' }, h('span', null, t('verificationResult')),
            h('select', {
              className: 'bp-input', value: status,
              onChange: event => setStatus(event.target.value),
            }, ['passed', 'failed', 'pending'].map(item => h('option', { key: item, value: item }, verificationStatusLabel(item))))),
          h('input', {
            className: 'bp-input bp-verification-evidence-input',
            value: evidence,
            placeholder: t('verificationEvidencePlaceholder'),
            onChange: event => setEvidence(event.target.value),
            onKeyDown: event => { if (event.key === 'Enter') submit() },
          }),
          h('button', {
            type: 'button', className: 'bp-btn bp-primary bp-verification-submit',
            disabled: busy, onClick: submit,
          }, busy ? t('saving') : t('verificationRecord'))),
        h('div', { className: 'bp-muted bp-verification-hint' }, t('verificationHint')))
    }

    function ModulePanel({ store }) {
      const bp = store.bp
      const [selectedModuleId, setSelectedModuleId] = useState(null)
      if (bp === null) return null
      const currentDiagram = currentDiagramFor(bp, store.tab, store.activeLayerId)
      const selectedModule = selectedModuleId === null ? undefined : bp.modules.find(item => item.id === selectedModuleId)
      const editorDiagram = selectedModule === undefined || selectedModule === null
        ? currentDiagram
        : diagramsForLayer(bp, selectedModule.layerId ?? 'A').find(item => diagramTypeOf(item) === 'module') ?? currentDiagram
      const updateModule = (id, fn) => mutate(current => {
        const found = current.modules.find(item => item.id === id)
        if (found !== undefined) fn(found)
      })
      const toggleModuleNode = (module, ref) => updateModule(module.id, found => {
        found.nodeIds = toggleTraceValue(found.nodeIds, ref)
      })
      const selectModule = module => {
        const next = selectedModuleId === module.id ? null : module.id
        setSelectedModuleId(next)
        if (next === null) return
        const layerId = module.layerId ?? 'A'
        let layerDiagrams = diagramsForLayer(bp, layerId)
        let diagram = layerDiagrams.find(item => diagramTypeOf(item) === 'module')
        if (diagram === undefined) {
          const key = ensureLayerDiagram(layerId, 'module')
          diagram = (state.bp?.diagrams ?? []).find(item => item.key === key)
          layerDiagrams = diagramsForLayer(state.bp, layerId)
        }
        const node = moduleNodeInDiagram(state.bp ?? bp, diagram, module)
          ?? diagram?.nodes.find(entry => entry.label === module.name || entry.id === module.id)
        set({
          activeLayerId: layerId,
          tab: diagram?.key ?? preferredTabForLayer(state.bp ?? bp, layerId),
          selected: node === undefined ? null : { kind: 'node', id: node.id },
          mode: 'select',
          connectFrom: null,
        })
      }
      // Verification is written by the Host command, never by local mutation: save
      // pending edits first, run `/blueprint verify`, then reload the authoritative file.
      const recordVerification = async (module, role, status, evidence) => {
        try {
          if (state.dirty) {
            const saved = await saveBlueprint({ silent: true })
            if (!saved) return false
          }
          const suffix = evidence === '' ? '' : ` ${evidence}`
          await runBlueprintCommand(`verify ${module.id} ${role} ${status}${suffix}`)
          await loadBlueprint()
          toast(t('verificationSaved'), 'success')
          return true
        } catch (error) {
          toast(`${t('verificationSaveFailed')}: ${String(error?.message ?? error)}`, 'error')
          return false
        }
      }
      return h('div', { className: 'bp-modules' },
        h('div', { className: 'bp-kicker' }, t('modules')),
        h('div', { className: 'bp-muted bp-module-hint' }, t('moduleTraceHint')),
        bp.modules.length === 0 ? h('div', { className: 'bp-muted' }, t('noModules')) : null,
        bp.modules.map(module => {
          const selected = selectedModuleId === module.id
          const nodeIds = Array.isArray(module.nodeIds) ? module.nodeIds : []
          const files = Array.isArray(module.files) ? module.files : []
          const acceptance = Array.isArray(module.acceptance) ? module.acceptance : []
          return h('div', {
            className: `bp-module${selected ? ' selected' : ''}`, key: module.id,
            onClick: () => selectModule(module),
          },
            h('div', { className: 'bp-module-top' },
              h('strong', null, `${module.code ?? ''} ${module.name}`.trim()),
              h('span', { className: `bp-chip bp-chip-${module.status ?? 'pending'}` }, moduleStatusLabel(module.status))),
            module.summary ? h('p', null, module.summary) : null,
            module.dependsOn?.length ? h('div', { className: 'bp-module-deps' }, `${t('dependsOn')}: ${module.dependsOn.join(', ')}`) : null,
            nodeIds.length > 0 ? h('div', { className: 'bp-module-deps' },
              `${t('linkedNodes')}: ${nodeIds.map(ref => resolveNodeRef(bp, ref)?.node.label ?? ref).join('、')}`) : null,
            files.length > 0 ? h('div', { className: 'bp-module-deps' }, `${t('moduleFiles')}: ${files.length}`) : null,
            h('div', { className: 'bp-module-acceptance' },
              h('div', { className: 'bp-module-deps' }, t('moduleAcceptance')),
              acceptance.length === 0
                ? h('div', { className: 'bp-muted bp-acceptance-empty' }, t('moduleAcceptanceMissing'))
                : h('ul', { className: 'bp-acceptance-list' },
                    acceptance.map((item, index) => h('li', { key: index }, item)))),
            h(VerificationBadges, { module }),
            selected ? h('div', {
              className: 'bp-module-editor',
              onClick: event => event.stopPropagation(),
            },
              h('div', { className: 'bp-field' },
                h('span', null, t('linkedNodes')),
                (editorDiagram?.nodes ?? []).length === 0
                  ? h('div', { className: 'bp-muted' }, t('noDiagramNodes'))
                  : h('div', { className: 'bp-node-picker' },
                      (editorDiagram?.nodes ?? []).map(node => {
                        const ref = nodeRef(editorDiagram.key, node.id)
                        const checked = nodeIds.includes(ref)
                        return h('label', { className: 'bp-node-option', key: node.id, title: ref },
                          h('input', { type: 'checkbox', checked, onChange: () => toggleModuleNode(module, ref) }),
                          h('span', { className: 'bp-node-text' }, `${node.label} · ${ref}`))
                      }))),
              (() => {
                const childLayer = (bp.layers ?? []).find(layer => layer.parentModuleId === module.id)
                return h('div', { className: 'bp-module-layer' },
                  childLayer === undefined
                    ? button('bp-btn', () => createChildLayer(module), h(Icon, { name: 'plus', size: 13 }), {
                      title: layerDepth(bp, module.layerId) >= 4 ? t('maxDepth') : t('createLayer'),
                      disabled: layerDepth(bp, module.layerId) >= 4,
                    })
                    : button('bp-btn', () => activateLayer(childLayer.letter), h(Icon, { name: 'expand', size: 13 }), {
                      title: t('enterChildLayer'),
                    }),
                  h('span', { className: 'bp-muted' },
                    childLayer === undefined ? t('createLayer') : `${t('layer')} ${childLayer.letter}`))
              })(),
              h('label', { className: 'bp-field' }, h('span', null, t('moduleFiles')),
                h(LineListEditor, {
                  value: files, rows: 3, placeholder: t('moduleFilesHint'),
                  onCommit: items => updateModule(module.id, found => { found.files = items }),
                })),
              h('label', { className: 'bp-field' }, h('span', null, t('moduleAcceptance')),
                h(LineListEditor, {
                  value: acceptance, rows: 3, placeholder: t('moduleAcceptanceHint'),
                  onCommit: items => updateModule(module.id, found => { found.acceptance = items }),
                })),
              h(VerificationEditor, { module, onRecord: recordVerification })) : null)
        }))
    }

    function BoardPanel({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const childById = new Map(store.children.map(child => [child.sessionId, child]))
      const openChildSession = sessionId => {
        try {
          const ui = ctxRef?.get?.('uiWorkspace')
          if (ui?.openSession !== undefined) {
            ui.openSession({ kind: 'session', sessionId })
            return
          }
        } catch {}
        toast(sessionId, 'info')
      }
      const openChild = child => openChildSession(child.sessionId)
      const copy = async child => {
        try { await navigator.clipboard.writeText(child.sessionId); toast(t('copyId'), 'success') } catch {}
      }
      const setModuleStatus = (module, status) => {
        // done is a verified claim, not a free-form label. The Host aggregation owns it.
        if (status === 'done' && !verificationAllPassed(module)) {
          toast(t('verificationRequiredForDone'), 'error')
          return
        }
        mutate(current => {
          const target = current.modules.find(item => item.id === module.id)
          if (target !== undefined) target.status = status
        })
      }
      const cancelModule = async module => {
        const childSessionId = module.subagentSessionId
        if (!childSessionId) return
        try {
          await runBlueprintCommand(`cancel ${childSessionId}`)
          toast(t('cancelRequested'), 'success')
        } catch (error) {
          toast(`${t('cancelFailed')}: ${String(error?.message ?? error)}`, 'error')
        }
        await loadChildren()
      }
      const runModule = async module => {
        try {
          await sendPrompt(modulePrompt(module), 'dispatching')
          toast(t('modulePromptSent'), 'success')
        } catch (error) {
          toast(String(error?.message ?? error), 'error')
        }
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
        bp.modules.map(module => {
          const linkedChild = module.subagentSessionId ? childById.get(module.subagentSessionId) : undefined
          const displayStatus = linkedChild?.running === true ? 'running' : module.status ?? 'pending'
          return h('div', { className: 'bp-module', key: module.id },
            h('div', { className: 'bp-module-top' },
              h('strong', null, module.name),
              h('span', { className: `bp-chip bp-chip-${displayStatus}` }, moduleStatusLabel(displayStatus))),
            module.summary ? h('p', null, module.summary) : null,
            module.dependsOn?.length ? h('div', { className: 'bp-module-deps' }, `${t('dependsOn')}: ${module.dependsOn.join(', ')}`) : null,
            module.subagentSessionId ? h('div', { className: 'bp-child-id' },
              linkedChild !== undefined ? `${module.subagentSessionId} · ${linkedChild.running ? t('running') : t('idle')}` : module.subagentSessionId) : null,
            h('label', { className: 'bp-module-status-label', title: t('moduleStatusHint') },
              h('span', null, t('moduleStatus')),
              h('select', {
                className: 'bp-input bp-module-status',
                value: module.status ?? 'pending',
                title: t('moduleStatusHint'),
                onChange: event => setModuleStatus(module, event.target.value),
              }, ['pending', 'running', 'done', 'blocked', 'needs-rework'].map(status => h('option', {
                key: status,
                value: status,
                disabled: status === 'done' && !verificationAllPassed(module),
              }, moduleStatusLabel(status))))),
            h('div', { className: 'bp-child-actions' },
              module.subagentSessionId
                ? h(React.Fragment, null,
                    h('button', { type: 'button', className: 'bp-btn', onClick: () => openChildSession(module.subagentSessionId) }, t('openChild')),
                    h('button', { type: 'button', className: 'bp-btn bp-danger', onClick: () => cancelModule(module) }, t('cancelChild')))
                : h('button', { type: 'button', className: 'bp-btn', onClick: () => runModule(module) }, t('runModule'))))
        }))
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

    const CHECK_SEVERITY_ORDER = ['error', 'warn', 'info']
    const CHECK_SEVERITY_LABEL_KEYS = {
      error: 'checkError',
      warn: 'checkWarn',
      info: 'checkInfo',
    }
    const CHECK_SEVERITY_GROUP_KEYS = {
      error: 'checkGroupError',
      warn: 'checkGroupWarn',
      info: 'checkGroupInfo',
    }

    function isRecord(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    }

    function checkSeverityLabel(severity) {
      return t(CHECK_SEVERITY_LABEL_KEYS[severity] ?? 'checkInfo')
    }

    function normalizeCheckResult(value) {
      if (!isRecord(value)) throw new Error(t('checkInvalid'))
      const rules = Array.isArray(value.rules) ? value.rules.filter(isRecord) : []
      const severityByCode = new Map()
      for (const rule of rules) {
        const code = typeof rule.code === 'string' ? rule.code : ''
        const severity = CHECK_SEVERITY_ORDER.includes(rule.severity) ? rule.severity : ''
        if (code !== '' && severity !== '') severityByCode.set(code, severity)
      }
      const issues = (Array.isArray(value.issues) ? value.issues : []).filter(isRecord).map(issue => {
        const code = typeof issue.code === 'string' ? issue.code : ''
        const severity = CHECK_SEVERITY_ORDER.includes(issue.severity)
          ? issue.severity
          : severityByCode.get(code) ?? 'info'
        return {
          ...issue,
          code,
          severity,
          message: typeof issue.message === 'string' ? issue.message : String(issue.message ?? ''),
        }
      })
      const summary = { error: 0, warn: 0, info: 0 }
      let summaryUsable = isRecord(value.summary)
      if (summaryUsable) {
        for (const severity of CHECK_SEVERITY_ORDER) {
          const count = Number(value.summary[severity])
          if (!Number.isFinite(count) || count < 0) {
            summaryUsable = false
            break
          }
          summary[severity] = Math.floor(count)
        }
      }
      if (!summaryUsable) {
        summary.error = issues.filter(issue => issue.severity === 'error').length
        summary.warn = issues.filter(issue => issue.severity === 'warn').length
        summary.info = issues.filter(issue => issue.severity === 'info').length
      }
      return {
        issues,
        coverage: isRecord(value.coverage) ? value.coverage : null,
        summary,
        rules,
        // The Host already caps the list at 200; the length guard keeps an older or
        // hand-written payload honest without changing the report itself.
        truncated: value.truncated === true || issues.length > 200,
      }
    }

    function checkCounts(check) {
      const counts = { error: 0, warn: 0, info: 0 }
      if (check === null) return counts
      for (const severity of CHECK_SEVERITY_ORDER) {
        const count = Number(check.summary?.[severity])
        counts[severity] = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0
      }
      return counts
    }

    function coverageItemLabel(entry) {
      if (!isRecord(entry)) return String(entry ?? '').trim()
      const code = String(entry.code ?? '').trim()
      const name = String(entry.name ?? entry.title ?? entry.moduleId ?? '').trim()
      return [code, name].filter(Boolean).join(' ')
    }

    function coverageSnapshot(check, bp) {
      const empty = {
        total: null, covered: null, unassigned: null, layerCount: null,
        modulesWithout: null, modulesMissing: null,
        modulesWithoutNames: [], modulesMissingNames: [], percent: null,
      }
      const coverage = check === null ? null : check.coverage
      if (!isRecord(coverage)) return empty
      const global = isRecord(coverage.global) ? coverage.global : {}
      const layers = Array.isArray(coverage.layers) ? coverage.layers.filter(isRecord) : []
      const modules = Array.isArray(coverage.modules) ? coverage.modules.filter(isRecord) : []
      const number = value => {
        const parsed = Number(value)
        return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null
      }
      const requirementCountOf = module => {
        const direct = number(module.requirementCount)
        if (direct !== null) return direct
        return Array.isArray(module.requirementUids) ? module.requirementUids.length : null
      }
      const sum = values => values.reduce((totalValue, value) => totalValue + value, 0)
      const layerRequirements = layers.map(layer => number(layer.requirementCount)).filter(value => value !== null)
      const layerCovered = layers.map(layer => number(layer.coveredRequirementCount)).filter(value => value !== null)
      const unassignedList = Array.isArray(global.unassignedRequirements) ? global.unassignedRequirements : null
      let total = number(global.totalRequirements)
      let covered = number(global.coveredRequirements)
      let unassigned = unassignedList === null ? null : unassignedList.length
      if (total === null && layerRequirements.length > 0) total = sum(layerRequirements)
      if (covered === null && layerCovered.length > 0) covered = sum(layerCovered)
      if (total === null && covered !== null && unassigned !== null) total = covered + unassigned
      if (covered === null && total !== null && unassigned !== null) covered = Math.max(0, total - unassigned)
      if (unassigned === null && total !== null && covered !== null) unassigned = Math.max(0, total - covered)
      const globalWithout = Array.isArray(global.modulesWithoutRequirements) ? global.modulesWithoutRequirements : null
      const globalMissing = Array.isArray(global.modulesMissingAcceptance) ? global.modulesMissingAcceptance : null
      const derivedWithout = modules.filter(module => {
        const count = requirementCountOf(module)
        return count !== null && count === 0
      }).map(coverageItemLabel)
      const derivedMissing = modules.filter(module => module.hasAcceptance === false).map(coverageItemLabel)
      const modulesWithoutNames = globalWithout === null ? derivedWithout : globalWithout.map(coverageItemLabel)
      const modulesMissingNames = globalMissing === null ? derivedMissing : globalMissing.map(coverageItemLabel)
      let modulesWithout = globalWithout === null ? null : globalWithout.length
      let modulesMissing = globalMissing === null ? null : globalMissing.length
      if (modulesWithout === null && modules.length > 0) modulesWithout = derivedWithout.length
      if (modulesMissing === null && modules.length > 0) modulesMissing = derivedMissing.length
      let layerCount = Array.isArray(coverage.layers) ? coverage.layers.length : null
      if (layerCount === null && Array.isArray(bp?.layers)) layerCount = bp.layers.length
      const percent = total !== null && covered !== null
        ? (total > 0 ? Math.round((covered / total) * 100) : 100)
        : null
      return {
        total, covered, unassigned, layerCount,
        modulesWithout, modulesMissing,
        modulesWithoutNames: modulesWithoutNames.filter(name => name !== ''),
        modulesMissingNames: modulesMissingNames.filter(name => name !== ''),
        percent,
      }
    }

    function findRequirementByUid(bp, uid) {
      const target = String(uid ?? '').trim()
      if (target === '' || bp === null) return null
      for (const section of bp.sections ?? []) {
        if (!isRecord(section)) continue
        const items = Array.isArray(section.items) ? section.items : []
        for (const [index, item] of items.entries()) {
          if (!isRecord(item)) continue
          const ref = requirementRef(section.key, item.id ?? index)
          if (ref === target || String(item.uid ?? '').trim() === target) return { section, item, ref }
        }
      }
      return null
    }

    function issueCanLocate(bp, issue) {
      if (bp === null || !isRecord(issue)) return false
      if (typeof issue.layerId === 'string' && layerByLetter(bp, issue.layerId) !== undefined) return true
      if (typeof issue.diagramKey === 'string' && (bp.diagrams ?? []).some(diagram => diagram.key === issue.diagramKey)) return true
      if (typeof issue.moduleId === 'string' && moduleById(bp, issue.moduleId) !== undefined) return true
      if (typeof issue.requirementUid === 'string' && findRequirementByUid(bp, issue.requirementUid) !== null) return true
      return false
    }

    function locateIssue(issue) {
      const bp = state.bp
      if (bp === null || !isRecord(issue)) return
      const module = typeof issue.moduleId === 'string' ? moduleById(bp, issue.moduleId) : undefined
      const requirement = typeof issue.requirementUid === 'string' ? findRequirementByUid(bp, issue.requirementUid) : null
      let diagram = typeof issue.diagramKey === 'string'
        ? (bp.diagrams ?? []).find(item => item.key === issue.diagramKey)
        : undefined
      let layerId = diagram === undefined ? null : diagramLayerId(diagram)
      if (layerId === null && typeof issue.layerId === 'string' && layerByLetter(bp, issue.layerId) !== undefined) layerId = issue.layerId
      if (layerId === null && module !== undefined && layerByLetter(bp, module.layerId) !== undefined) layerId = module.layerId
      const focusRequirement = requirement?.ref ?? null
      if (layerId === null && focusRequirement !== null) {
        const linkedDiagram = (bp.diagrams ?? []).find(item =>
          (item.nodes ?? []).some(node => (node.requirementIds ?? []).includes(focusRequirement)))
        if (linkedDiagram !== undefined) {
          layerId = diagramLayerId(linkedDiagram)
          diagram = linkedDiagram
        } else if (isRecord(requirement?.item) && typeof requirement.item.moduleId === 'string') {
          const requirementModule = moduleById(bp, requirement.item.moduleId)
          if (requirementModule !== undefined) layerId = requirementModule.layerId
        }
      }
      if (layerId === null || layerByLetter(bp, layerId) === undefined) {
        // Nothing locatable: keep the click harmless instead of moving the view at random.
        if (focusRequirement !== null) set({ focusRequirement })
        return
      }
      const layerDiagrams = diagramsForLayer(bp, layerId)
      let activeDiagram = diagram === undefined ? undefined : diagram
      if (activeDiagram === undefined || diagramLayerId(activeDiagram) !== layerId) {
        activeDiagram = layerDiagrams.find(item => diagramTypeOf(item) === 'module') ?? layerDiagrams[0]
      }
      let selected = null
      const nodeId = isRecord(issue.details) ? issue.details.nodeId : undefined
      if (activeDiagram !== undefined && typeof nodeId === 'string') {
        const node = (activeDiagram.nodes ?? []).find(item => item.id === nodeId)
        if (node !== undefined) selected = { kind: 'node', id: node.id }
      }
      if (selected === null && module !== undefined) {
        const moduleDiagram = layerDiagrams.find(item => diagramTypeOf(item) === 'module')
        const node = moduleNodeInDiagram(bp, moduleDiagram, module)
        if (node !== undefined) {
          activeDiagram = moduleDiagram
          selected = { kind: 'node', id: node.id }
        }
      }
      if (selected === null && focusRequirement !== null) {
        const linkedDiagram = layerDiagrams.find(item =>
          (item.nodes ?? []).some(node => (node.requirementIds ?? []).includes(focusRequirement)))
        if (linkedDiagram !== undefined) {
          activeDiagram = linkedDiagram
          const linkedNode = (linkedDiagram.nodes ?? []).find(node => (node.requirementIds ?? []).includes(focusRequirement))
          if (linkedNode !== undefined) selected = { kind: 'node', id: linkedNode.id }
        }
      }
      set({
        activeLayerId: layerId,
        tab: activeDiagram?.key ?? preferredTabForLayer(bp, layerId) ?? state.tab,
        selected,
        mode: 'select',
        connectFrom: null,
        focusRequirement,
      })
    }

    async function loadChecks() {
      const sessionId = state.sessionId
      if (sessionId === null || state.checkLoading) return
      set({ checkLoading: true, checkError: null })
      try {
        const text = await runBlueprintCommand('check')
        if (state.sessionId !== sessionId) return
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new Error(t('checkInvalid'))
        }
        const normalized = normalizeCheckResult(parsed)
        set({ check: normalized, checkLoading: false, checkLoaded: true, checkError: null, checkAt: Date.now() })
      } catch (error) {
        if (state.sessionId !== sessionId) return
        const message = `${t('checkFailed')}: ${String(error?.message ?? error)}`
        set({ checkLoading: false, checkLoaded: true, checkError: message })
      }
    }

    function ChecksPanel({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const check = store.check
      const counts = checkCounts(check)
      const coverage = coverageSnapshot(check, bp)
      const issues = check === null ? [] : check.issues
      const bySeverity = severity => issues.filter(issue => issue.severity === severity)
      const groups = CHECK_SEVERITY_ORDER.map(severity => ({ severity, issues: bySeverity(severity) }))
      const ruleTitleByCode = new Map(
        (check?.rules ?? [])
          .filter(rule => typeof rule.code === 'string' && typeof rule.title === 'string')
          .map(rule => [rule.code, rule.title]),
      )
      const gapValue = (count, names) => {
        if (count === null) return t('checkUnknown')
        if (count === 0) return t('checkNone')
        const shown = names.slice(0, 2)
        return shown.length === 0 ? String(count) : `${count} · ${shown.join(', ')}${names.length > shown.length ? '…' : ''}`
      }
      const issueMeta = issue => {
        const values = []
        if (typeof issue.layerId === 'string' && issue.layerId !== '') values.push([t('checkLayer'), issue.layerId])
        if (typeof issue.moduleId === 'string' && issue.moduleId !== '') values.push([t('checkModule'), issue.moduleId])
        if (typeof issue.diagramKey === 'string' && issue.diagramKey !== '') values.push([t('checkDiagram'), issue.diagramKey])
        if (typeof issue.requirementUid === 'string' && issue.requirementUid !== '') values.push([t('checkRequirement'), issue.requirementUid])
        return values
      }
      const children = [
        h('div', { className: 'bp-panel-head' },
          h('div', { className: 'bp-kicker' }, t('checks')),
          h('button', {
            type: 'button', className: 'bp-ghost bp-btn',
            disabled: store.checkLoading,
            onClick: loadChecks,
          }, store.checkLoading ? h('span', { className: 'bp-spinner' }) : t('refresh'))),
        h('div', { className: 'bp-muted' },
          store.checkLoading
            ? t('checkLoading')
            : store.checkAt > 0
              ? t('checkCheckedAt', { time: new Date(store.checkAt).toLocaleTimeString() })
              : t('checksHint')),
      ]
      if (store.checkError) children.push(h('div', { className: 'bp-check-error' }, store.checkError))
      if (check !== null) {
        children.push(
          h('div', { className: 'bp-check-counts' },
            CHECK_SEVERITY_ORDER.map(severity => h('div', { className: `bp-check-count ${severity}`, key: severity },
              h('span', null, checkSeverityLabel(severity)),
              h('strong', null, counts[severity])))),
          h('div', { className: 'bp-check-card' },
            h('div', { className: 'bp-check-card-head' },
              h('span', { className: 'bp-check-section-title' }, t('checkCoverage')),
              coverage.percent === null
                ? null
                : h('span', { className: 'bp-check-percent' }, t('checkCoveragePercent', { percent: coverage.percent }))),
            h('div', { className: 'bp-check-stats' },
              h('div', { className: 'bp-check-stat' }, h('span', null, t('checkTotalRequirements')), h('strong', null, coverage.total === null ? t('checkUnknown') : coverage.total)),
              h('div', { className: 'bp-check-stat' }, h('span', null, t('checkCoveredRequirements')), h('strong', null, coverage.covered === null ? t('checkUnknown') : coverage.covered)),
              h('div', { className: 'bp-check-stat' }, h('span', null, t('checkUncoveredRequirements')), h('strong', null, coverage.unassigned === null ? t('checkUnknown') : coverage.unassigned)),
              h('div', { className: 'bp-check-stat' }, h('span', null, t('checkLayerCount')), h('strong', null, coverage.layerCount === null ? t('checkUnknown') : coverage.layerCount))),
            h('div', { className: 'bp-check-gaps' },
              h('div', {
                className: 'bp-check-gap',
                title: coverage.modulesWithoutNames.join(', '),
              }, h('span', null, t('checkModulesWithoutRequirements')), h('strong', null, gapValue(coverage.modulesWithout, coverage.modulesWithoutNames))),
              h('div', {
                className: 'bp-check-gap',
                title: coverage.modulesMissingNames.join(', '),
              }, h('span', null, t('checkModulesMissingAcceptance')), h('strong', null, gapValue(coverage.modulesMissing, coverage.modulesMissingNames))))),
        )
        if (check.truncated) children.push(h('div', { className: 'bp-check-truncated' }, t('checkTruncated', { shown: issues.length })))
        if (issues.length === 0) {
          children.push(h('div', { className: 'bp-check-empty' }, t('checkEmpty')))
        } else {
          children.push(h('div', { className: 'bp-check-issues' },
            groups.filter(group => group.issues.length > 0).map(group => h('div', { className: 'bp-check-group', key: group.severity },
              h('div', { className: `bp-check-group-title ${group.severity}` },
                t(CHECK_SEVERITY_GROUP_KEYS[group.severity], { count: group.issues.length })),
              group.issues.map((issue, index) => {
                const canLocate = issueCanLocate(bp, issue)
                const meta = issueMeta(issue)
                const props = {
                  key: `${group.severity}-${issue.code}-${index}`,
                  className: `bp-check-issue ${issue.severity}`,
                  title: canLocate ? t('checkLocateHint') : undefined,
                }
                if (canLocate) {
                  props.type = 'button'
                  props.onClick = () => locateIssue(issue)
                }
                const ruleTitle = ruleTitleByCode.get(issue.code)
                return h(canLocate ? 'button' : 'div', props,
                  h('div', { className: 'bp-check-issue-top' },
                    h('span', { className: `bp-check-sev ${issue.severity}` }, checkSeverityLabel(issue.severity)),
                    h('code', { className: 'bp-check-code', title: ruleTitle }, issue.code || '—')),
                  h('div', { className: 'bp-check-message' }, issue.message || ruleTitle || issue.code || '—'),
                  meta.length === 0 ? null : h('div', { className: 'bp-check-meta' },
                    meta.map(([label, value]) => h('span', { key: `${label}-${value}`, title: `${label}: ${value}` }, `${label} ${value}`))))
              })))))
        }
      } else if (!store.checkLoading && !store.checkError) {
        children.push(h('div', { className: 'bp-check-empty' }, t('checksHint')))
      }
      return h('div', { className: 'bp-checks' }, children)
    }

    function diffValueLabel(value) {
      if (value === undefined || value === null) return '—'
      if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }

    function edgeLabelText(edge) {
      const parts = []
      if (edge.label) parts.push(edge.label)
      if (edge.kind) parts.push(`[${edge.kind}]`)
      return `${edge.from} → ${edge.to}${parts.length === 0 ? '' : ` · ${parts.join(' ')}`}`
    }

    function DiagramDiffCard({ diagram }) {
      const [open, setOpen] = useState(true)
      const counts = [
        { key: 'addedNodes', className: 'bp-plus', count: diagram.addedNodes.length, label: t('diffAddedNodes') },
        { key: 'removedNodes', className: 'bp-minus', count: diagram.removedNodes.length, label: t('diffRemovedNodes') },
        { key: 'changedNodes', className: 'bp-warn', count: diagram.changedNodes.length, label: t('diffChangedNodes') },
        { key: 'addedEdges', className: 'bp-plus', count: diagram.addedEdges.length, label: t('diffAddedEdges') },
        { key: 'removedEdges', className: 'bp-minus', count: diagram.removedEdges.length, label: t('diffRemovedEdges') },
      ]
      if (diagram.changedEdges.length > 0) counts.push({ key: 'changedEdges', className: 'bp-warn', count: diagram.changedEdges.length, label: t('diffChangedEdges') })
      return h('div', { className: 'bp-diff-card' },
        h('button', { type: 'button', className: 'bp-diff-card-head bp-diff-toggle', onClick: () => setOpen(value => !value) },
          h('strong', null, diagram.title),
          h('span', { className: 'bp-muted' }, open ? t('diffHideDetails') : t('diffShowDetails'))),
        h('div', { className: 'bp-diff-chips' },
          counts.map(chip => h('span', { className: `bp-diff-chip ${chip.className}`, key: chip.key }, `${chip.label} ${chip.count}`))),
        diagram.diagramAdded ? h('div', { className: 'bp-plus bp-diff-line' }, `+ ${t('diagramMissing')}`) : null,
        diagram.diagramRemoved ? h('div', { className: 'bp-minus bp-diff-line' }, `− ${t('diagramMissing')}`) : null,
        open ? h('div', { className: 'bp-diff-body' },
          diagram.addedNodes.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-plus' }, `${t('diffAddedNodes')} · ${diagram.addedNodes.length}`),
            diagram.addedNodes.map((node, index) => h('div', { className: 'bp-diff-line bp-plus', key: `an-${node.id}-${index}` }, `+ ${node.label} (${node.type})`))),
          diagram.removedNodes.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-minus' }, `${t('diffRemovedNodes')} · ${diagram.removedNodes.length}`),
            diagram.removedNodes.map((node, index) => h('div', { className: 'bp-diff-line bp-minus', key: `rn-${node.id}-${index}` }, `− ${node.label} (${node.type})`))),
          diagram.changedNodes.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-warn' }, `${t('diffChangedNodes')} · ${diagram.changedNodes.length}`),
            diagram.changedNodes.map((node, index) => h('div', { className: 'bp-diff-line bp-warn', key: `cn-${node.id}-${index}` },
              h('div', null, `~ ${node.label} (${node.type})`),
              (node.changes ?? []).map((change, changeIndex) => h('div', { className: 'bp-diff-change', key: changeIndex },
                `${change.field}: ${diffValueLabel(change.before)} → ${diffValueLabel(change.after)}`))))),
          diagram.addedEdges.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-plus' }, `${t('diffAddedEdges')} · ${diagram.addedEdges.length}`),
            diagram.addedEdges.map((edge, index) => h('div', { className: 'bp-diff-line bp-plus', key: `ae-${edge.id}-${index}` }, `+ ${edgeLabelText(edge)}`))),
          diagram.removedEdges.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-minus' }, `${t('diffRemovedEdges')} · ${diagram.removedEdges.length}`),
            diagram.removedEdges.map((edge, index) => h('div', { className: 'bp-diff-line bp-minus', key: `re-${edge.id}-${index}` }, `− ${edgeLabelText(edge)}`))),
          diagram.changedEdges.length === 0 ? null : h('div', { className: 'bp-diff-group' },
            h('div', { className: 'bp-diff-group-title bp-warn' }, `${t('diffChangedEdges')} · ${diagram.changedEdges.length}`),
            diagram.changedEdges.map((edge, index) => h('div', { className: 'bp-diff-line bp-warn', key: `ce-${edge.id}-${index}` }, `~ ${edgeLabelText(edge)}`)))) : null)
    }

    function requirementDiffText(entry) {
      if (typeof entry === 'string') return entry
      return entry?.text ?? entry?.after ?? ''
    }

    function requirementDiffCode(entry) {
      return typeof entry === 'object' && entry !== null ? entry.code ?? '' : ''
    }

    // Flatten every requirement add/remove/modify in the diff into one queue row
    // so the review controls can apply all of them with a single action.
    function reviewQueueRows(diff) {
      const rows = []
      for (const section of diff.sections ?? []) {
        const push = (kind, entry, index) => {
          const object = typeof entry === 'object' && entry !== null ? entry : {}
          const id = object.id ?? ''
          const uid = object.uid ?? (id === '' ? '' : `${section.key}:${id}`)
          rows.push({
            key: `${section.key}:${kind}:${uid || id || index}:${index}`,
            kind,
            sectionKey: section.key,
            sectionTitle: section.title,
            uid,
            id,
            code: object.code ?? '',
            text: requirementDiffText(entry),
            before: kind === 'modified' ? object.before ?? '' : requirementDiffText(entry),
            after: kind === 'modified' ? object.after ?? '' : requirementDiffText(entry),
            wordDiff: kind === 'modified' ? object.wordDiff ?? [] : undefined,
          })
        }
        ;(section.added ?? []).forEach((entry, index) => push('added', entry, index))
        ;(section.removed ?? []).forEach((entry, index) => push('removed', entry, index))
        ;(section.modified ?? []).forEach((entry, index) => push('modified', entry, index))
      }
      return rows
    }

    function requirementUid(sectionKey, item) {
      const uid = typeof item?.uid === 'string' ? item.uid.trim() : ''
      if (uid !== '') return uid
      return `${sectionKey}:${typeof item?.id === 'string' ? item.id.trim() : ''}`
    }

    // Accepting a modified row writes the `after` text into the current blueprint,
    // accepting a removed row removes the item, and accepting an added row keeps
    // the current copy (the target of a writable comparison is always current).
    function applyReviewRows(bp, rows) {
      let changed = 0
      for (const row of rows) {
        if (row.kind === 'added') continue
        if (row.kind === 'modified') {
          let applied = false
          for (const section of bp.sections ?? []) {
            const list = Array.isArray(section.items) ? section.items : []
            const item = list.find(candidate => requirementUid(section.key, candidate) === row.uid
              && (row.id === '' || candidate.id === row.id))
            if (item === undefined) continue
            if (item.text !== row.after) {
              item.text = row.after
              changed += 1
            }
            applied = true
            break
          }
          if (applied) continue
        }
        if (row.kind === 'removed') {
          for (const section of bp.sections ?? []) {
            const list = Array.isArray(section.items) ? section.items : []
            const index = list.findIndex(item => requirementUid(section.key, item) === row.uid)
            if (index < 0) continue
            list.splice(index, 1)
            changed += 1
            break
          }
        }
      }
      return changed
    }

    function RequirementWordDiff({ segments }) {
      if (!Array.isArray(segments) || segments.length === 0) return null
      return h('span', null, segments.map((segment, index) => h('span', {
        key: index,
        className: segment.type === 'add' ? 'bp-seg-add' : segment.type === 'remove' ? 'bp-seg-remove' : undefined,
      }, segment.text)))
    }

    function ReviewQueue({ diff, store }) {
      const writable = diff.to === 'current' && store.bp !== null
      const rows = useMemo(() => reviewQueueRows(diff), [diff])
      const [decisions, setDecisions] = useState({})
      const [applying, setApplying] = useState(false)
      const [undoSnapshot, setUndoSnapshot] = useState(null)

      useEffect(() => {
        setDecisions({})
        setUndoSnapshot(null)
      }, [diff])

      if (rows.length === 0) return null
      const pending = rows.filter(row => decisions[row.key] === undefined)
      const decided = rows.length - pending.length

      const mark = (targets, decision) => {
        setDecisions(current => {
          const next = { ...current }
          for (const row of targets) next[row.key] = decision
          return next
        })
      }

      const decide = async (targets, decision, options = {}) => {
        if (!writable || targets.length === 0 || applying) return
        if (options.bulk === true) {
          const prompt = decision === 'accepted' ? 'reviewAcceptAllConfirm' : 'reviewRejectAllConfirm'
          if (!window.confirm(t(prompt, { count: targets.length }))) return
        }
        if (decision === 'rejected') {
          mark(targets, 'rejected')
          toast(t('reviewRejectedToast', { count: targets.length }), 'info')
          return
        }
        setApplying(true)
        const snapshot = cloneBlueprint(store.bp)
        mutate(bp => { applyReviewRows(bp, targets) }, { undoLabel: 'review' })
        mark(targets, 'accepted')
        setUndoSnapshot(snapshot)
        const saved = await saveBlueprint({ silent: true })
        setApplying(false)
        if (!saved) return
        toast(t('reviewSaved', { count: targets.length }), 'success')
      }

      const undoReview = async () => {
        if (undoSnapshot === null || applying) return
        if (!window.confirm(t('reviewUndoConfirm'))) return
        setApplying(true)
        setUndoSnapshot(null)
        setDecisions({})
        recordUndo(store.bp, 'review-undo')
        set({
          bp: cloneBlueprint(undoSnapshot),
          dirty: true,
          selected: null,
          mode: 'select',
          connectFrom: null,
          ...historyFlags(),
        })
        const saved = await saveBlueprint({ silent: true })
        setApplying(false)
        if (saved) toast(t('reviewUndone'), 'info')
      }

      return h('div', { className: 'bp-review' },
        h('div', { className: 'bp-review-head' },
          h('div', null,
            h('div', { className: 'bp-kicker' }, t('reviewQueue')),
            h('div', { className: 'bp-muted' }, writable ? t('reviewHint') : t('reviewNeedsCurrent')),
            decided > 0 ? h('div', { className: 'bp-muted' }, t('reviewProgress', { decided, count: rows.length })) : null),
          h('div', { className: 'bp-review-toolbar' },
            undoSnapshot !== null
              ? h('button', { type: 'button', className: 'bp-btn', disabled: applying, onClick: undoReview }, t('reviewUndo'))
              : null,
            h('button', {
              type: 'button', className: 'bp-btn bp-primary', disabled: !writable || pending.length === 0 || applying,
              onClick: () => decide(pending, 'accepted', { bulk: true }),
            }, t('reviewAcceptAll', { count: pending.length })),
            h('button', {
              type: 'button', className: 'bp-btn bp-danger', disabled: !writable || pending.length === 0 || applying,
              onClick: () => decide(pending, 'rejected', { bulk: true }),
            }, t('reviewRejectAll', { count: pending.length })))),
        h('div', { className: 'bp-review-list' }, rows.map(row => {
          const decision = decisions[row.key]
          return h('div', { className: `bp-review-row${decision === undefined ? '' : ' decided'}`, key: row.key },
            h('div', { className: 'bp-review-main' },
              h('div', { className: 'bp-review-meta' },
                h('span', { className: row.kind === 'added' ? 'bp-plus' : row.kind === 'removed' ? 'bp-minus' : 'bp-warn' },
                  row.kind === 'added' ? `+ ${t('diffAdded')}` : row.kind === 'removed' ? `− ${t('diffRemoved')}` : `~ ${t('diffModified')}`),
                row.code ? h('span', { className: 'bp-review-code' }, row.code) : null,
                h('span', { className: 'bp-review-section' }, row.sectionTitle),
                decision === undefined ? null : h('span', { className: 'bp-review-decision' }, decision === 'accepted' ? t('reviewAccepted') : t('reviewRejected'))),
              h('div', { className: 'bp-review-text' },
                row.kind === 'modified'
                  ? h(React.Fragment, null,
                      h('span', { className: 'bp-review-before' }, row.before),
                      h('span', { className: 'bp-review-arrow' }, ' → '),
                      h('span', { className: 'bp-review-after' }, h(RequirementWordDiff, {
                        segments: Array.isArray(row.wordDiff) && row.wordDiff.length > 0
                          ? row.wordDiff
                          : [{ type: 'same', text: row.after }],
                      })))
                  : h('span', { className: row.kind === 'added' ? 'bp-plus' : 'bp-minus' }, row.text))),
            h('div', { className: 'bp-review-actions' },
              h('button', {
                type: 'button', className: 'bp-btn', disabled: !writable || applying || decision !== undefined,
                onClick: () => decide([row], 'accepted'),
              }, t('reviewAccept')),
              h('button', {
                type: 'button', className: 'bp-btn bp-danger', disabled: !writable || applying || decision !== undefined,
                onClick: () => decide([row], 'rejected'),
              }, t('reviewReject'))))
        })))
    }

    function RequirementSectionCard({ section }) {
      const added = section.added ?? []
      const removed = section.removed ?? []
      const modified = section.modified ?? []
      const group = (key, title, className, list, render) => list.length === 0 ? null : h('div', { className: 'bp-diff-group', key },
        h('div', { className: `bp-diff-group-title ${className}` }, `${title} · ${list.length}`),
        list.map(render))
      return h('div', { className: 'bp-diff-card', key: section.key },
        h('div', { className: 'bp-diff-card-head' },
          h('strong', null, section.title),
          h('span', null, `${section.before} → ${section.after}`)),
        section.sectionAdded ? h('div', { className: 'bp-plus' }, `+ ${t('added')}`) : null,
        section.sectionRemoved ? h('div', { className: 'bp-minus' }, `− ${t('removed')}`) : null,
        section.titleChanged ? h('div', { className: 'bp-warn' }, `${t('sectionTitleChanged')}: ${section.titleChanged.from} → ${section.titleChanged.to}`) : null,
        group('added', t('diffAdded'), 'bp-plus', added, (entry, index) => h('div', { className: 'bp-diff-line bp-plus', key: `a-${index}` },
          `+ ${requirementDiffCode(entry) ? `${requirementDiffCode(entry)} · ` : ''}${requirementDiffText(entry)}`)),
        group('removed', t('diffRemoved'), 'bp-minus', removed, (entry, index) => h('div', { className: 'bp-diff-line bp-minus', key: `r-${index}` },
          `− ${requirementDiffCode(entry) ? `${requirementDiffCode(entry)} · ` : ''}${requirementDiffText(entry)}`)),
        group('modified', t('diffModified'), 'bp-warn', modified, (entry, index) => h('div', { className: 'bp-diff-line bp-warn', key: `m-${index}` },
          h('span', { className: 'bp-review-code' }, entry.code || entry.uid || ''),
          h('span', null, h(RequirementWordDiff, {
            segments: Array.isArray(entry.wordDiff) && entry.wordDiff.length > 0
              ? entry.wordDiff
              : [{ type: 'same', text: entry.after ?? '' }],
          })))))
    }

    function DiffPanel({ store }) {
      const diff = store.diff
      if (diff === null) return null
      const added = diff.totals?.added ?? 0
      const removed = diff.totals?.removed ?? 0
      const modified = diff.totals?.modified ?? 0
      const changed = diff.totals?.changed ?? 0
      const requirementsSection = h('section', null,
        h('h3', null, t('requirements')),
        diff.sections.length === 0 ? h('div', { className: 'bp-muted' }, '—') : null,
        diff.sections.map(section => h(RequirementSectionCard, { key: section.key, section })))
      const diagramsSection = h('section', null,
        h('h3', null, t('diagrams')),
        diff.diagrams.length === 0 ? h('div', { className: 'bp-muted' }, '—') : null,
        diff.diagrams.map(diagram => h(DiagramDiffCard, { key: diagram.key, diagram })))
      const modulesSection = h('section', null,
        h('h3', null, t('modules')),
        diff.modules.added.map(module => h('div', { className: 'bp-diff-line bp-plus', key: module.id }, `+ ${module.name}`)),
        diff.modules.removed.map(module => h('div', { className: 'bp-diff-line bp-minus', key: module.id }, `− ${module.name}`)),
        diff.modules.changed.map(module => h('div', { className: 'bp-diff-card', key: module.id },
          h('strong', null, module.name),
          module.changes.map((change, index) => h('div', {
            className: 'bp-diff-line bp-warn', key: index,
          }, `~ ${change.field}: ${change.from || '—'} → ${change.to || '—'}`)))))
      return h('div', { className: 'bp-diff' },
        h('div', { className: 'bp-diff-head' },
          h('div', null,
            h('div', { className: 'bp-kicker' }, t('diffTitle')),
            h('strong', null, `${diff.before?.title || t('current')} → ${diff.after?.title || t('current')}`)),
          h('div', { className: 'bp-diff-totals' },
            h('span', { className: 'bp-plus' }, `+${added}`),
            h('span', { className: 'bp-minus' }, `−${removed}`),
            modified > 0 ? h('span', { className: 'bp-warn' }, `~${modified} ${t('diffModified')}`) : null,
            changed > 0 ? h('span', { className: 'bp-warn' }, `~${changed} ${t('changed')}`) : null),
          h('button', { type: 'button', className: 'bp-btn', onClick: () => set({ diff: null }) }, t('closeDiff'))),
        added + removed + modified + changed === 0 ? h('div', { className: 'bp-empty-diff' }, t('diffEmpty')) : null,
        h(ReviewQueue, { diff, store }),
        h('div', { className: 'bp-diff-grid' }, requirementsSection, diagramsSection, modulesSection))
    }

    function ImportDialog({ store }) {
      const [text, setText] = useState('')
      const [replace, setReplace] = useState(true)
      const [error, setError] = useState(null)
      const [sourceKind, setSourceKind] = useState('auto')
      const close = () => set({ importOpen: false })
      const detected = text.trim() === '' ? null : detectImportSource(text, sourceKind)
      const accept = sourceKind === 'drawio'
        ? '.drawio,.xml,application/xml,text/xml'
        : sourceKind === 'mermaid'
          ? '.mmd,.mermaid,.txt,text/plain'
          : '.drawio,.xml,.mmd,.mermaid,.txt,application/xml,text/xml,text/plain'
      const placeholder = sourceKind === 'mermaid'
        ? t('importMermaidPlaceholder')
        : sourceKind === 'drawio'
          ? t('importPlaceholder')
          : t('importAutoPlaceholder')
      const sourceButton = (value, label) => h('button', {
        type: 'button', key: value,
        className: `bp-seg-btn${sourceKind === value ? ' active' : ''}`,
        onClick: () => { setSourceKind(value); setError(null) },
      }, label)
      const run = () => {
        try {
          if (text.trim() === '') throw new ImportFailure('empty')
          const format = detectImportSource(text, sourceKind)
          const bp = state.bp
          if (bp === null) throw new ImportFailure('missing-diagram')
          const layerId = state.activeLayerId ?? 'A'
          const current = currentDiagramFor(bp, state.tab, layerId)
          let parsed
          let targetKey
          if (format === 'drawio') {
            if (current === undefined) throw new ImportFailure('missing-diagram')
            parsed = parseDrawio(text, diagramTypeOf(current))
            targetKey = current.key
          } else {
            parsed = parseMermaid(text)
            targetKey = diagramKeyFor(layerId, parsed.diagramKey)
            if (!(bp.diagrams ?? []).some(item => item.key === targetKey)) ensureLayerDiagram(layerId, parsed.diagramKey)
          }
          if (parsed.nodes.length === 0) throw new ImportFailure('empty')
          const target = (state.bp?.diagrams ?? []).find(item => item.key === targetKey)
          if (target === undefined) throw new ImportFailure('missing-diagram')
          mutate(currentBp => {
            const diagram = currentBp.diagrams.find(item => item.key === targetKey)
            if (diagram === undefined) return
            if (replace) {
              diagram.nodes = parsed.nodes
              diagram.edges = parsed.edges
            } else {
              const stamp = Date.now().toString(36)
              const idMap = new Map()
              for (const node of parsed.nodes) {
                const next = { ...node, id: `${node.id}-${stamp}` }
                idMap.set(node.id, next.id)
                diagram.nodes.push(next)
              }
              for (const edge of parsed.edges) {
                diagram.edges.push({ ...edge, id: `${edge.id}-${stamp}`, from: idMap.get(edge.from), to: idMap.get(edge.to) })
              }
            }
            if (format === 'mermaid') layoutDiagram(diagram)
          }, { undoLabel: 'import' })
          set({ importOpen: false, tab: targetKey, selected: null, mode: 'select', connectFrom: null })
          toast(t('importSuccess', { nodes: parsed.nodes.length, edges: parsed.edges.length, diagram: target.title }), 'success')
        } catch (failure) {
          setError(importErrorMessage(failure))
        }
      }
      return h('div', { className: 'bp-import-backdrop', onClick: close },
        h('div', { className: 'bp-import-dialog', onClick: event => event.stopPropagation() },
          h('div', { className: 'bp-kicker' }, t('importTitle')),
          h('p', { className: 'bp-muted' }, t('importHint')),
          h('div', { className: 'bp-import-source' },
            h('span', null, t('importSource')),
            h('div', { className: 'bp-seg' },
              sourceButton('auto', t('importSourceAuto')),
              sourceButton('drawio', t('importSourceDrawio')),
              sourceButton('mermaid', t('importSourceMermaid')))),
          h('div', { className: 'bp-import-detected' },
            detected === null ? t(sourceKind === 'mermaid' ? 'importMermaidHint' : 'importHint')
              : `${t('importDetected', { kind: detected === 'drawio' ? 'draw.io' : 'Mermaid' })}${sourceKind === 'mermaid' ? ` · ${t('importMermaidHint')}` : ''}`),
          h('textarea', {
            className: 'bp-input bp-import-text', rows: 9, value: text,
            placeholder,
            onChange: event => { setText(event.target.value); setError(null) },
          }),
          h('div', { className: 'bp-import-row' },
            h('input', {
              type: 'file', accept,
              onChange: async event => {
                const file = event.target.files?.[0]
                if (file === undefined) return
                try { setText(await file.text()) } catch (failure) { setError(importErrorMessage(failure)) }
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
          h('button', { type: 'button', className: `bp-panel-tab${panel === 'versions' ? ' active' : ''}`, onClick: () => { set({ panel: 'versions' }); loadVersions() } }, t('versions')),
          h('button', { type: 'button', className: `bp-panel-tab${panel === 'checks' ? ' active' : ''}`, onClick: () => { set({ panel: 'checks' }); loadChecks() } }, t('checks'))),
        panel === 'board'
          ? h(BoardPanel, { store })
          : panel === 'versions'
            ? h(VersionsPanel, { store })
            : panel === 'checks'
              ? h(ChecksPanel, { store })
              : h(React.Fragment, null,
                  h(Inspector, { store }),
                  h('div', { className: 'bp-divider' }),
                  h(ModulePanel, { store })))
    }

    function LayerBreadcrumbs({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const activeLayerId = store.activeLayerId ?? 'A'
      const path = layerPath(bp, activeLayerId)
      const parent = parentLayerId(bp, activeLayerId)
      return h('div', { className: 'bp-breadcrumbs' },
        h('button', {
          type: 'button', className: 'bp-crumb-back', disabled: parent === null,
          title: parent === null ? t('currentLayer') : t('backToParentLayer'),
          onClick: () => { if (parent !== null) activateLayer(parent) },
        }, h(Icon, { name: 'back', size: 14 })),
        path.map((layer, index) => {
          const anchor = index === 0 ? undefined : moduleById(bp, layer.parentModuleId)
          const layerButton = h('button', {
            type: 'button', key: `layer-${layer.letter}`,
            className: `bp-crumb${layer.letter === activeLayerId ? ' active' : ''}`,
            title: layer.title ?? layer.letter,
            onClick: () => { if (layer.letter !== activeLayerId) activateLayer(layer.letter) },
          }, layer.letter ?? layer.id)
          if (index === 0) return layerButton
          return h(React.Fragment, { key: `path-${layer.letter}` },
            h('span', { className: 'bp-crumb-sep' }, '/'),
            anchor === undefined ? null : h('button', {
              type: 'button', className: 'bp-crumb-module',
              title: `${anchor.code ?? ''} ${anchor.name ?? ''}`.trim(),
              onClick: () => activateLayer(anchor.layerId ?? 'A'),
            }, `${anchor.code ?? ''} ${anchor.name ?? ''}`.trim()),
            h('span', { className: 'bp-crumb-sep' }, '/'),
            layerButton)
        }))
    }

    function LayerNav({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const layers = layerList(bp)
      if (layers.length <= 1) return null
      const activeLayerId = store.activeLayerId ?? 'A'
      return h('nav', { className: 'bp-layernav', 'aria-label': t('layer') },
        h('span', { className: 'bp-layernav-label' }, t('layer')),
        layers.map(layer => h('button', {
          type: 'button',
          key: layer.letter,
          className: `bp-layernav-item${layer.letter === activeLayerId ? ' active' : ''}`,
          title: `${layer.letter} · ${layer.title ?? ''}`.trim(),
          'aria-current': layer.letter === activeLayerId ? 'true' : undefined,
          onClick: () => { if (layer.letter !== activeLayerId) activateLayer(layer.letter) },
        }, layer.letter)))
    }

    function DiagramHeader({ store }) {
      const bp = store.bp
      if (bp === null) return null
      const activeLayerId = store.activeLayerId ?? 'A'
      const layerDiagrams = diagramsForLayer(bp, activeLayerId)
      const activeDiagram = currentDiagramFor(bp, store.tab, activeLayerId)
      const activeType = activeDiagram === undefined ? null : diagramTypeOf(activeDiagram)
      const tabs = DIAGRAM_TYPE_ORDER.map(type => {
        const diagram = layerDiagrams.find(item => diagramTypeOf(item) === type)
        return { type, diagram, key: diagram?.key ?? diagramKeyFor(activeLayerId, type) }
      })
      const openTab = type => {
        const existing = layerDiagrams.find(item => diagramTypeOf(item) === type)
        const key = existing?.key ?? ensureLayerDiagram(activeLayerId, type)
        set({ tab: key, selected: null, mode: 'select', connectFrom: null })
      }
      return h('div', { className: 'bp-diagram-head' },
        h(LayerBreadcrumbs, { store }),
        h('div', { className: 'bp-tabs' },
          tabs.map(tab => h('button', {
            type: 'button', key: tab.key,
            className: `bp-tab${(activeDiagram?.key ?? store.tab) === tab.key ? ' active' : ''}${tab.diagram === undefined ? ' missing' : ''}`,
            title: tab.diagram?.title ?? diagramTypeTitle(tab.type),
            onClick: () => openTab(tab.type),
          }, diagramTypeTitle(tab.type), h('em', null, `${tab.diagram?.nodes?.length ?? 0}`)))),
        h('div', { className: 'bp-tools' },
          h('div', { className: 'bp-seg' },
            button(`bp-seg-btn${store.mode === 'select' ? ' active' : ''}`, () => set({ mode: 'select', connectFrom: null }), h(Icon, { name: 'cursor', size: 14 }), { title: t('select') }),
            button(`bp-seg-btn${store.mode === 'connect' ? ' active' : ''}`, () => set({ mode: store.mode === 'connect' ? 'select' : 'connect', connectFrom: null }), h(Icon, { name: 'connect', size: 14 }), { title: t('connect') })),
          h('div', { className: 'bp-seg' },
            typesFor(activeType ?? (activeLayerId === 'A' ? 'usecase' : 'module')).map(type => h('button', {
              type: 'button', key: type, className: 'bp-seg-btn bp-add-type',
              title: `${t('addNode')} · ${typeLabel(type, activeType ?? (activeLayerId === 'A' ? 'usecase' : 'module'))}`,
              onClick: () => addNode(store, type),
            }, h('span', { className: 'bp-type-dot', style: { background: TYPE_META[type].color } }), typeLabel(type, activeType ?? (activeLayerId === 'A' ? 'usecase' : 'module'))))),
          h('button', { type: 'button', className: 'bp-btn bp-ghost bp-import', title: t('importDiagram'), onClick: () => set({ importOpen: true }) },
            h(Icon, { name: 'download', size: 15 }), h('span', { className: 'bp-import-label' }, t('importDiagram'))),
          button('bp-ghost', () => { layoutDiagram(activeDiagram); mutate(() => {}); }, h(Icon, { name: 'layout', size: 15 }), { title: t('autoLayout'), disabled: activeDiagram === undefined }),
          button('bp-ghost', () => expandDiagram(activeDiagram), h(Icon, { name: 'spark', size: 15 }), { title: t('expandDiagram'), disabled: activeDiagram === undefined })))
    }

    function addNode(store, type) {
      const bp = state.bp
      if (bp === null) return
      let diagram = currentDiagramFor(bp, state.tab, state.activeLayerId)
      if (diagram === undefined) {
        const key = ensureLayerDiagram(state.activeLayerId, type === 'module' || type === 'external' ? 'module' : 'usecase')
        diagram = (state.bp?.diagrams ?? []).find(item => item.key === key)
      }
      if (diagram === undefined) return
      const diagramType = diagramTypeOf(diagram)
      const tabKey = diagram.key
      const meta = TYPE_META[type] ?? TYPE_META.usecase
      const id = `n${Date.now().toString(36)}`
      const label = typeLabel(type, diagramType)
      mutate(current => {
        const target = current.diagrams.find(item => item.key === tabKey)
        if (target === undefined) return
        const sequence = diagramType === 'sequence'
        target.nodes.push({
          id, type, label,
          x: sequence ? 80 + target.nodes.length * 230 : 160 + (target.nodes.length % 4) * 40,
          y: sequence ? 64 : 120 + (target.nodes.length % 5) * 40,
          w: sequence ? (type === 'actor' ? 130 : 170) : meta.w,
          h: sequence ? (type === 'actor' ? 84 : 52) : meta.h,
          ...(diagramType === 'er' && type === 'entity' ? { fields: [{ name: 'id', type: 'uuid', key: true }] } : {}),
        })
      })
      set({ selected: { kind: 'node', id }, mode: 'select' })
    }

    const EXPORT_MAX_BYTES = 5 * 1024 * 1024

    function formatBytes(size) {
      const value = Number(size)
      if (!Number.isFinite(value) || value < 0) return '—'
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
      return `${(value / (1024 * 1024)).toFixed(1)} MB`
    }

    function exportFileStamp(date = new Date()) {
      const pad = value => String(value).padStart(2, '0')
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    }

    function safeFilePart(value, fallback) {
      const cleaned = String(value ?? '')
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .slice(0, 60)
      return cleaned === '' ? fallback : cleaned
    }

    function exportFileName(bp, format, scope) {
      const title = String(bp?.title ?? '').trim() || String(bp?.id ?? '').trim()
      const name = safeFilePart(title, 'blueprint')
      const range = scope === 'all' ? 'all' : safeFilePart(scope, 'A')
      const extension = format === 'html' ? 'html' : 'md'
      return `${name}-${range}-${exportFileStamp()}.${extension}`
    }

    async function exportDocument(format, scope) {
      const bp = state.bp
      const sessionId = state.sessionId
      if (bp === null || sessionId === null) return
      const key = `${format}:${scope}`
      if (state.exporting !== null) return
      set({ exporting: key, error: null })
      try {
        const text = await runBlueprintCommand(`export ${format} ${scope}`)
        if (state.sessionId !== sessionId) return
        if (typeof text !== 'string' || text.trim() === '') throw new Error(t('exportEmpty'))
        const size = new TextEncoder().encode(text).byteLength
        if (size > EXPORT_MAX_BYTES) throw new Error(t('exportTooLarge', { size: formatBytes(size) }))
        const name = exportFileName(state.bp ?? bp, format, scope)
        download(name, text, format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8')
        set({ error: null })
        toast(t('exportSaved', { name }), 'success')
      } catch (error) {
        if (state.sessionId !== sessionId) return
        const message = `${t('exportFailed')}: ${String(error?.message ?? error)}`
        set({ error: message })
        toast(message, 'error')
      } finally {
        if (state.exporting === key) set({ exporting: null })
      }
    }

    function exportJSON() {
      const bp = state.bp
      if (bp === null) return
      download(`${bp.id ?? 'blueprint'}.json`, JSON.stringify(bp, null, 2), 'application/json;charset=utf-8')
    }

    // Numeric entities keep quotes/brackets out of Mermaid syntax while still
    // round-tripping to the exact label text on import.
    function mermaidFlowText(value) {
      return String(value ?? '')
        .replace(/#/g, '#35;')
        .replace(/"/g, '#34;')
        .replace(/\[/g, '#91;')
        .replace(/\]/g, '#93;')
        .replace(/\{/g, '#123;')
        .replace(/\}/g, '#125;')
        .replace(/\(/g, '#40;')
        .replace(/\)/g, '#41;')
        .replace(/\|/g, '#124;')
        .replace(/\r?\n/g, ' ')
        .trim()
    }

    function mermaidFlowId(value, used) {
      let base = String(value ?? '').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^[-.]+|[-.]+$/g, '')
      if (base === '') base = 'node'
      if (!/^[A-Za-z_]/.test(base)) base = `n_${base}`
      let candidate = base
      let index = 2
      while (used.has(candidate)) candidate = `${base}_${index++}`
      used.add(candidate)
      return candidate
    }

    function flowchartMermaidSource(diagram) {
      const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : []
      const groups = nodes.filter(node => node.type === 'group')
      const groupIds = new Set(groups.map(node => node.id))
      const used = new Set()
      const ids = new Map()
      const idOf = node => {
        if (!ids.has(node.id)) ids.set(node.id, mermaidFlowId(node.id, used))
        return ids.get(node.id)
      }
      const lines = ['flowchart TD']
      for (const node of nodes) {
        if (node.type === 'note') lines.push(`  %% note ${mermaidFlowText(node.label).replace(/\r?\n/g, ' ')}`)
      }
      const children = new Map()
      const loose = []
      for (const node of nodes) {
        if (node.type === 'group') continue
        if (node.parentGroup !== undefined && groupIds.has(node.parentGroup)) {
          if (!children.has(node.parentGroup)) children.set(node.parentGroup, [])
          children.get(node.parentGroup).push(node)
        } else {
          loose.push(node)
        }
      }
      const emit = node => {
        const rawLabel = node.type === 'decision'
          ? node.label ?? node.condition
          : node.label ?? node.condition ?? node.id
        const label = mermaidFlowText(rawLabel ?? node.id)
        if (node.type === 'start' || node.type === 'end') lines.push(`  ${idOf(node)}(["${label}"])`)
        else if (node.type === 'decision') lines.push(`  ${idOf(node)}{"${label}"}`)
        else lines.push(`  ${idOf(node)}["${label}"]`)
      }
      for (const node of loose) emit(node)
      for (const group of groups) {
        lines.push(`  subgraph ${idOf(group)}["${mermaidFlowText(group.label || group.id)}"]`)
        for (const node of children.get(group.id) ?? []) emit(node)
        lines.push('  end')
      }
      for (const edge of Array.isArray(diagram?.edges) ? diagram.edges : []) {
        const from = ids.get(edge.from)
        const to = ids.get(edge.to)
        if (from === undefined || to === undefined) continue
        const label = mermaidFlowText(edge.label ?? '')
        const arrow = edge.kind === 'dashed' ? '-.->' : '-->'
        lines.push(`  ${from} ${arrow}${label === '' ? '' : `|${label}|`} ${to}`)
      }
      return lines.join('\n')
    }

    function exportMermaid() {
      const bp = state.bp
      if (bp === null) return
      const parts = []
      for (const diagram of bp.diagrams) {
        const diagramType = diagramTypeOf(diagram)
        if (diagramType === 'sequence') {
          const lines = ['sequenceDiagram']
          for (const node of diagram.nodes) lines.push(`  participant ${node.id} as ${node.label}`)
          for (const edge of [...diagram.edges].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
            const arrow = edge.kind === 'return' ? '-->>' : edge.kind === 'async' ? '-)' : '->>'
            lines.push(`  ${edge.from}${arrow}${edge.to}: ${(edge.label ?? '').replace(/\n/g, ' ')}`)
          }
          parts.push(`%% ${diagram.title}\n${lines.join('\n')}`)
          continue
        }
        if (diagramType === 'er') {
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
        if (diagramType === 'class') {
          const lines = ['classDiagram']
          for (const node of diagram.nodes) {
            lines.push(`  class ${node.id} {`)
            if (node.type === 'interface') lines.push('    <<interface>>')
            for (const field of node.fields ?? []) {
              if (field.kind === 'method') lines.push(`    +${field.name}()${field.type ? ` ${field.type}` : ''}`)
              else lines.push(`    +${field.type ? `${field.type} ` : ''}${field.name}`)
            }
            lines.push('  }')
          }
          for (const edge of diagram.edges) {
            const label = edge.label ? ` : ${String(edge.label).replace(/\n/g, ' ')}` : ''
            if (edge.kind === 'extends' || edge.kind === 'implements') lines.push(`  ${edge.to} ${edge.kind === 'implements' ? '<|..' : '<|--'} ${edge.from}${label}`)
            else lines.push(`  ${edge.from} ${edge.kind === 'dependency' ? '..>' : '-->'} ${edge.to}${label}`)
          }
          parts.push(`%% ${diagram.title}\n${lines.join('\n')}`)
          continue
        }
        if (diagramType === 'state') {
          const lines = ['stateDiagram-v2']
          const nodeById = new Map(diagram.nodes.map(node => [node.id, node]))
          for (const node of diagram.nodes) {
            if (node.type === 'initial' || node.type === 'final') continue
            const label = String(node.label).replace(/["\n]/g, ' ')
            lines.push(label !== node.id ? `  state "${label}" as ${node.id}` : `  state ${node.id}`)
          }
          for (const edge of diagram.edges) {
            const from = nodeById.get(edge.from)
            const to = nodeById.get(edge.to)
            if (from === undefined || to === undefined) continue
            const fromToken = from.type === 'initial' ? '[*]' : edge.from
            const toToken = to.type === 'final' ? '[*]' : edge.to
            const label = edge.label ? ` : ${String(edge.label).replace(/\n/g, ' ')}` : ''
            lines.push(`  ${fromToken} --> ${toToken}${label}`)
          }
          parts.push(`%% ${diagram.title}\n${lines.join('\n')}`)
          continue
        }
        if (diagramType === 'flowchart') {
          parts.push(`%% ${diagram.title}\n${flowchartMermaidSource(diagram)}`)
          continue
        }
        const header = diagramType === 'module' || diagramType === 'c4' ? 'graph TD' : 'flowchart LR'
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
      if (node.type === 'class' || node.type === 'interface') return 'rounded=0;whiteSpace=wrap;html=1;'
      if (node.type === 'state') return 'rounded=1;arcSize=50;whiteSpace=wrap;html=1;'
      if (node.type === 'initial') return 'ellipse;whiteSpace=wrap;html=1;fillColor=#64748b;'
      if (node.type === 'final') return 'ellipse;whiteSpace=wrap;html=1;'
      if (node.type === 'choice') return 'rhombus;whiteSpace=wrap;html=1;'
      if (node.type === 'person') return 'shape=actor;whiteSpace=wrap;html=1;'
      if (node.type === 'external') return 'rounded=1;dashed=1;whiteSpace=wrap;html=1;'
      if (node.type === 'container' || node.type === 'component') return 'rounded=1;whiteSpace=wrap;html=1;'
      return 'rounded=1;whiteSpace=wrap;html=1;'
    }

    function exportDrawio() {
      const bp = state.bp
      const diagram = currentDiagramFor(bp, state.tab, state.activeLayerId)
      if (bp === null || diagram === undefined) return
      const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
      for (const node of diagram.nodes) {
        const size = sizeOf(node)
        const fields = (node.fields ?? []).map(field => field.kind === 'method'
          ? `${field.name}()${field.type ? `: ${field.type}` : ''}`
          : `${field.key ? 'PK ' : ''}${field.name}${field.type ? `: ${field.type}` : ''}`).join('\n')
        const label = xmlEscape([node.label, fields].filter(Boolean).join('\n'))
        cells.push(`<mxCell id="${xmlEscape(node.id)}" value="${label}" style="${drawioStyle(node)}" vertex="1" parent="1"><mxGeometry x="${Math.round(node.x ?? 0)}" y="${Math.round(node.y ?? 0)}" width="${Math.round(size.w)}" height="${Math.round(size.h)}" as="geometry"/></mxCell>`)
      }
      for (const edge of diagram.edges) {
        cells.push(`<mxCell id="${xmlEscape(edge.id)}" value="${xmlEscape(edge.label ?? '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;${edge.kind === 'depends' || edge.kind === 'return' ? 'dashed=1;' : ''}" edge="1" parent="1" source="${xmlEscape(edge.from)}" target="${xmlEscape(edge.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`)
      }
      const xml = `<mxfile host="dsh-blueprint-studio"><diagram name="${xmlEscape(diagram.title)}" id="bp-${Date.now().toString(36)}"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
      download(`${bp.id ?? 'blueprint'}-${String(diagram.key).replace(/:/g, '-')}.drawio`, xml, 'application/xml;charset=utf-8')
    }

    function drawioTypeFor(style, diagramKey) {
      const value = String(style ?? '').toLowerCase()
      if (diagramKey === 'sequence') return 'participant'
      if (diagramKey === 'class') return value.includes('interface') ? 'interface' : 'class'
      if (diagramKey === 'state') {
        if (value.includes('rhombus')) return 'choice'
        if (value.includes('ellipse')) return 'initial'
        return 'state'
      }
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

    const MAX_IMPORT_BYTES = 200 * 1024
    const MAX_IMPORT_NODES = 200

    class ImportFailure extends Error {
      constructor(code, detail) {
        super(code)
        this.name = 'ImportFailure'
        this.code = code
        if (detail !== undefined && detail !== null) this.detail = String(detail)
      }
    }

    function importErrorMessage(error) {
      if (error?.code === undefined) return String(error?.message ?? error)
      const keys = {
        'too-large': 'importErrorTooLarge',
        'too-many-nodes': 'importErrorTooManyNodes',
        unsupported: 'importErrorUnsupported',
        empty: 'importErrorEmpty',
        'missing-diagram': 'importErrorMissingDiagram',
      }
      const key = keys[error.code] ?? 'importErrorParse'
      const detail = typeof error.detail === 'string' && error.detail.trim() !== ''
        ? ` (${error.detail.trim().replace(/\s+/g, ' ').slice(0, 80)})`
        : ''
      return `${t(key)}${detail}`
    }

    function utf8Length(input) {
      let bytes = 0
      for (const char of String(input ?? '')) {
        const code = char.codePointAt(0) ?? 0
        bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
      }
      return bytes
    }

    function detectImportSource(input, requested) {
      if (requested === 'drawio' || requested === 'mermaid') return requested
      const text = String(input ?? '').replace(/^\uFEFF/, '').trimStart()
      return /^<\?xml[^>]*\?>\s*<mx(?:file|GraphModel)\b/i.test(text) || /^<mx(?:file|GraphModel)\b/i.test(text)
        ? 'drawio'
        : 'mermaid'
    }

    function decodeMermaidEntities(value) {
      return String(value ?? '')
        .replace(/#quot;/gi, '"')
        .replace(/#(\d+);/g, (whole, code) => {
          const point = Number(code)
          return Number.isFinite(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : whole
        })
    }

    function cleanMermaidLabel(value) {
      let label = String(value ?? '').trim()
      if ((label.startsWith('"') && label.endsWith('"')) || (label.startsWith("'") && label.endsWith("'"))) {
        label = label.slice(1, -1)
      }
      return decodeMermaidEntities(label.replace(/\\"/g, '"')).trim()
    }

    function cleanMermaidToken(value) {
      return cleanMermaidLabel(value).replace(/:::[A-Za-z0-9_-]+$/g, '').replace(/<<[^>]*>>/g, '').trim()
    }

    function mermaidNodeId(token, used) {
      const cleaned = cleanMermaidToken(token)
      let base = cleaned.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '')
      if (base === '') base = `mm${used.size + 1}`
      if (!/^[A-Za-z_]/.test(base)) base = `mm-${base}`
      let candidate = base
      let index = 2
      while (used.has(candidate)) candidate = `${base}-${index++}`
      used.add(candidate)
      return candidate
    }

    function isMermaidDecoration(line) {
      return /^(?:%%|classDef\b|style\b|linkStyle\b|click\b|cssClass\b|direction\b|accTitle\b|accDescr\b|subgraph\b|end\b|note\b|link\b|callback\b)/.test(line)
    }

    function pushMermaidEdge(edges, from, to, kind, label) {
      if (from === undefined || to === undefined || from === to) return
      const edge = { id: `mm-e-${edges.length + 1}`, from, to, kind }
      if (label !== undefined && label !== '') edge.label = label
      edges.push(edge)
    }

    function parseClassMember(raw) {
      let line = String(raw ?? '').trim().replace(/^[+\-#~]\s*/, '').trim()
      if (line === '') return null
      line = line.replace(/[;$*]+$/g, '').trim()
      if (line === '') return null
      const open = line.indexOf('(')
      if (open >= 0) {
        const close = line.indexOf(')', open)
        if (close >= 0) {
          const head = line.slice(0, open).trim()
          const params = line.slice(open + 1, close).trim()
          let tail = line.slice(close + 1).trim()
          if (tail.startsWith(':')) tail = tail.slice(1).trim()
          const name = head.split(/\s+/).filter(Boolean).pop() ?? ''
          if (name === '') return null
          const field = { name, kind: 'method' }
          if (tail !== '') field.type = tail
          if (params !== '') field.note = `(${params})`
          return field
        }
      }
      const colon = line.indexOf(':')
      if (colon >= 0) {
        const left = line.slice(0, colon).trim()
        const type = line.slice(colon + 1).trim()
        const parts = left.split(/\s+/).filter(Boolean)
        const name = parts.pop() ?? ''
        if (name === '') return null
        const field = { name, kind: 'field' }
        if (type !== '') field.type = type
        else if (parts.length > 0) field.type = parts.join(' ')
        return field
      }
      const parts = line.split(/\s+/).filter(Boolean)
      if (parts.length === 0) return null
      if (parts.length === 1) return { name: parts[0], kind: 'field' }
      return { name: parts[parts.length - 1], type: parts.slice(0, -1).join(' '), kind: 'field' }
    }

    function parseClassRelation(line) {
      const match = /^(.*?)\s*(<\|--|<\|\.\.|--\|>|\.\.\|>|\.\.>|-->|--o|o--|--\*|\*--|\.\.|--)\s*(.*)$/.exec(line)
      if (match === null) return null
      const operator = match[2]
      const left = match[1].trim()
      let right = match[3].trim()
      let label = ''
      const colon = right.indexOf(':')
      if (colon >= 0) {
        label = right.slice(colon + 1).trim()
        right = right.slice(0, colon).trim()
      }
      const endpoint = value => value.replace(/"[^"]*"/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/)[0] ?? ''
      const leftToken = cleanMermaidToken(endpoint(left))
      const rightToken = cleanMermaidToken(endpoint(right))
      if (leftToken === '' || rightToken === '') return null
      let kind = 'association'
      if (operator === '<|--' || operator === '--|>') kind = 'extends'
      else if (operator === '<|..' || operator === '..|>') kind = 'implements'
      else if (operator === '..>') kind = 'dependency'
      const pointsLeft = operator === '<|--' || operator === '<|..'
      return { from: pointsLeft ? rightToken : leftToken, to: pointsLeft ? leftToken : rightToken, kind, label }
    }

    function parseClassDiagram(lines) {
      const nodes = []
      const edges = []
      const byToken = new Map()
      const used = new Set()
      let current = null
      const ensure = (token, label) => {
        const key = cleanMermaidToken(token)
        if (key === '') return undefined
        const found = byToken.get(key)
        if (found !== undefined) {
          if (label !== undefined && label !== '') found.label = cleanMermaidLabel(label)
          return found
        }
        if (nodes.length >= MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
        const node = {
          id: mermaidNodeId(key, used),
          type: 'class',
          label: label === undefined || label === '' ? key : cleanMermaidLabel(label),
        }
        nodes.push(node)
        byToken.set(key, node)
        return node
      }
      const addMember = (node, raw) => {
        const line = String(raw ?? '').trim()
        if (line === '') return
        const annotation = /^<<\s*([^>]+?)\s*>>$/.exec(line)
        if (annotation !== null) {
          const stereotype = annotation[1].trim()
          if (/^interface$/i.test(stereotype)) node.type = 'interface'
          node.stereotype = stereotype
          return
        }
        if (isMermaidDecoration(line)) return
        const member = parseClassMember(line)
        if (!Array.isArray(node.fields)) node.fields = []
        if (member === null) node.fields.push({ name: line, note: 'unparsed member' })
        else node.fields.push(member)
      }
      for (const raw of lines) {
        const line = String(raw ?? '').trim()
        if (line === '') continue
        if (current !== null) {
          if (line.startsWith('}')) { current = null; continue }
          addMember(current, line)
          continue
        }
        if (isMermaidDecoration(line)) continue
        const open = /^class\s+([^\s{]+)(?:\s*\["([^"]*)"\])?\s*\{\s*$/.exec(line)
        if (open !== null) {
          current = ensure(open[1], open[2])
          continue
        }
        const declaration = /^class\s+([^\s{]+)(?:\s*\["([^"]*)"\])?\s*$/.exec(line)
        if (declaration !== null) {
          ensure(declaration[1], declaration[2])
          continue
        }
        if (/^class\s+/.test(line)) {
          const body = line.slice(6).trim()
          const token = body.split(/[\s,]+/)[0] ?? ''
          if (token !== '') ensure(token)
          continue
        }
        if (/^(?:title|config)\b/.test(line)) continue
        const relation = parseClassRelation(line)
        if (relation === null) continue
        const from = ensure(relation.from)
        const to = ensure(relation.to)
        if (from === undefined || to === undefined) continue
        pushMermaidEdge(edges, from.id, to.id, relation.kind, relation.label)
      }
      return { nodes, edges }
    }

    function parseStateDiagram(lines) {
      const nodes = []
      const edges = []
      const byToken = new Map()
      const used = new Set()
      let initial = null
      let final = null
      const ensureState = (token, label, type) => {
        const key = cleanMermaidToken(token)
        if (key === '') return undefined
        const found = byToken.get(key)
        if (found !== undefined) {
          if (label !== undefined && label !== '') found.label = cleanMermaidLabel(label)
          if (type === 'choice') found.type = 'choice'
          return found
        }
        if (nodes.length >= MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
        const node = {
          id: mermaidNodeId(key, used),
          type: type === 'choice' ? 'choice' : 'state',
          label: label === undefined || label === '' ? key : cleanMermaidLabel(label),
        }
        nodes.push(node)
        byToken.set(key, node)
        return node
      }
      const ensureTerminal = kind => {
        if (kind === 'initial' && initial !== null) return initial
        if (kind === 'final' && final !== null) return final
        if (nodes.length >= MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
        const node = kind === 'initial'
          ? { id: mermaidNodeId('initial', used), type: 'initial', label: 'Initial' }
          : { id: mermaidNodeId('final', used), type: 'final', label: 'Final' }
        nodes.push(node)
        if (kind === 'initial') initial = node
        else final = node
        return node
      }
      for (const raw of lines) {
        let line = String(raw ?? '').trim()
        if (line === '' || line === '}') continue
        if (isMermaidDecoration(line)) continue
        const declared = /^state\s+"((?:[^"\\]|\\.)*)"\s+as\s+([^\s{]+)(?:\s*<<([^>]+)>>)?/.exec(line)
        if (declared !== null) {
          ensureState(declared[2], declared[1].replace(/\\"/g, '"'), /choice/i.test(declared[3] ?? '') ? 'choice' : 'state')
          continue
        }
        const simple = /^state\s+([^\s{]+)(?:\s*<<([^>]+)>>)?\s*\{?\s*$/.exec(line)
        if (simple !== null) {
          ensureState(simple[1], undefined, /choice/i.test(simple[2] ?? '') ? 'choice' : 'state')
          continue
        }
        const transition = /^(.*?)\s*-->\s*(.*)$/.exec(line)
        if (transition === null) continue
        let right = transition[2].trim()
        let label = ''
        const colon = right.indexOf(':')
        if (colon >= 0) {
          label = right.slice(colon + 1).trim()
          right = right.slice(0, colon).trim()
        }
        const leftToken = cleanMermaidToken(transition[1])
        const rightToken = cleanMermaidToken(right)
        if (leftToken === '' || rightToken === '') continue
        const from = leftToken === '[*]' ? ensureTerminal('initial') : ensureState(leftToken)
        const to = rightToken === '[*]' ? ensureTerminal('final') : ensureState(rightToken)
        if (from === undefined || to === undefined) continue
        pushMermaidEdge(edges, from.id, to.id, 'transition', label)
      }
      return { nodes, edges }
    }

    const FLOWCHART_END_LABEL = /^(?:结束|完成|终止|end|done|finish|finished|complete|completed)$/i

    function firstFlowToken(value) {
      const token = String(value ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? ''
      return cleanMermaidToken(token)
    }

    // A stadium is the only Mermaid shape that can represent start/end, so when
    // the label does not say "done" it is treated as the start of the flow.
    function flowTerminalType(label) {
      return FLOWCHART_END_LABEL.test(String(label ?? '').trim()) ? 'end' : 'start'
    }

    function flowShapeDescriptor(shape) {
      if (shape.startsWith('([') && shape.endsWith('])')) return { kind: 'stadium', label: shape.slice(2, -2) }
      if (shape.startsWith('[[') && shape.endsWith(']]')) return { unsupported: 'subroutine' }
      if (shape.startsWith('[(') && shape.endsWith(')]')) return { unsupported: 'cylinder' }
      if ((shape.startsWith('[/') && shape.endsWith('/]')) || (shape.startsWith('[\\') && shape.endsWith('\\]'))) {
        return { unsupported: 'parallelogram' }
      }
      if (shape.startsWith('>') && shape.endsWith(']')) return { unsupported: 'asymmetric' }
      if (shape.startsWith('[') && shape.endsWith(']')) return { kind: 'process', label: shape.slice(1, -1) }
      if (shape.startsWith('((') && shape.endsWith('))')) return { unsupported: 'circle' }
      if (shape.startsWith('(') && shape.endsWith(')')) return { kind: 'process', label: shape.slice(1, -1) }
      if (shape.startsWith('{{') && shape.endsWith('}}')) return { unsupported: 'hexagon' }
      if (shape.startsWith('{') && shape.endsWith('}')) return { kind: 'decision', label: shape.slice(1, -1) }
      return { unsupported: 'unknown' }
    }

    function flowGroupSpec(raw) {
      const value = String(raw ?? '').trim()
      const explicit = /^([A-Za-z0-9_\u4e00-\u9fff][\w\u4e00-\u9fff.-]*)\s*\[([\s\S]*)\]$/.exec(value)
      if (explicit !== null) {
        return { token: cleanMermaidToken(explicit[1]), label: cleanMermaidLabel(explicit[2]) }
      }
      return { token: cleanMermaidToken(value), label: cleanMermaidLabel(value) }
    }

    function isFlowchartDecoration(line) {
      return /^(?:classDef\b|style\b|linkStyle\b|click\b|cssClass\b|direction\b|accTitle\b|accDescr\b|note\b|link\b|callback\b|title\b|config\b)/.test(line)
    }

    function parseFlowchart(lines) {
      const nodes = []
      const edges = []
      const byToken = new Map()
      const used = new Set()
      const groupStack = []
      const ensure = (token, label, kind, parentGroup) => {
        const key = cleanMermaidToken(token)
        if (key === '') return undefined
        const found = byToken.get(key)
        if (found !== undefined) {
          if (found.type !== 'group') {
            if (label !== undefined && label !== '') found.label = cleanMermaidLabel(label)
            if (kind !== undefined) {
              found.type = kind
              if (kind === 'decision') found.condition = found.label
              else if (found.condition !== undefined) delete found.condition
            }
            if (parentGroup !== undefined && found.parentGroup === undefined) found.parentGroup = parentGroup
          }
          return found
        }
        if (nodes.length >= MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
        const labelText = label === undefined || label === '' ? key : cleanMermaidLabel(label)
        const node = { id: mermaidNodeId(key, used), type: kind ?? 'process', label: labelText }
        if (node.type === 'decision') node.condition = labelText
        if (parentGroup !== undefined) node.parentGroup = parentGroup
        nodes.push(node)
        byToken.set(key, node)
        return node
      }
      const definition = /([A-Za-z0-9_\u4e00-\u9fff][\w\u4e00-\u9fff.-]*)\s*(\[\[[\s\S]*?\]\]|\[\([\s\S]*?\)\]|\(\[(?:"(?:\\.|[^"\\])*"|[^\]\n]*)\]\)|\[\/[\s\S]*?\/\]|\[\\[\s\S]*?\\\]|\[(?:"(?:\\.|[^"\\])*"|[^\]\n]*)\]|\(\([\s\S]*?\)\)|\((?:"(?:\\.|[^"\\])*"|[^)\n]*)\)|\{\{(?:"(?:\\.|[^"\\])*"|[^}\n]*)\}\}|\{(?:"(?:\\.|[^"\\])*"|[^}\n]*)\}|>(?:"(?:\\.|[^"\\])*"|[^\]\n]*)\])/g
      for (const raw of lines) {
        let line = String(raw ?? '').trim()
        if (line === '') continue
        if (/^end\s*;?\s*$/.test(line)) {
          if (groupStack.length > 0) groupStack.pop()
          continue
        }
        if (/^subgraph\b/.test(line)) {
          if (groupStack.length > 0) throw new ImportFailure('nested-subgraph', line.slice(0, 80))
          const spec = flowGroupSpec(line.replace(/^subgraph\b\s*/, ''))
          const label = spec.label === '' ? spec.token : spec.label
          if (label === '') throw new ImportFailure('empty-subgraph', line.slice(0, 80))
          if (nodes.length >= MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
          const token = spec.token === '' ? label : spec.token
          const group = { id: mermaidNodeId(token, used), type: 'group', label }
          nodes.push(group)
          byToken.set(cleanMermaidToken(token), group)
          groupStack.push(group)
          continue
        }
        if (isFlowchartDecoration(line)) continue
        const parentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1].id : undefined
        line = line.replace(definition, (whole, token, shape) => {
          const descriptor = flowShapeDescriptor(shape)
          if (descriptor.unsupported !== undefined) {
            throw new ImportFailure('unsupported-shape', `${descriptor.unsupported} shape near "${line.slice(0, 60)}"`)
          }
          const label = cleanMermaidLabel(descriptor.label)
          ensure(token, label, descriptor.kind === 'stadium' ? flowTerminalType(label) : descriptor.kind, parentGroup)
          return token
        })
        line = line.replace(/;+\s*$/, '')
        if (line === '') continue
        // Inline edge labels: "A -- yes --> B" and "A -. retry .-> B".
        line = line.replace(/--\s+([^>\n]+?)\s+-->/g, (whole, label) => `-->|${String(label).trim().replace(/\|/g, ' ')}|`)
        line = line.replace(/-\.\s+([^.\n]+?)\s+\.->/g, (whole, label) => `-.->|${String(label).trim().replace(/\|/g, ' ')}|`)
        line = line.replace(/==\s+([^=\n]+?)\s+==>/g, (whole, label) => `==>|${String(label).trim().replace(/\|/g, ' ')}|`)
        const connectors = []
        const connectorPattern = /(-\.->|-->|---|==>|--x|--o)/g
        let match
        while ((match = connectorPattern.exec(line)) !== null) {
          const info = { kind: match[1] === '-.->' ? 'dashed' : 'flow', end: match.index + match[0].length, start: match.index, label: '' }
          const pipe = /^\s*\|([^|]*)\|/.exec(line.slice(info.end))
          if (pipe !== null) {
            info.label = cleanMermaidLabel(pipe[1])
            info.end += pipe[0].length
          }
          connectors.push(info)
        }
        if (connectors.length === 0) {
          const token = firstFlowToken(line)
          if (/^[A-Za-z0-9_\u4e00-\u9fff][\w\u4e00-\u9fff.-]*$/.test(token)) ensure(token, undefined, undefined, parentGroup)
          continue
        }
        const endpoints = [line.slice(0, connectors[0].start)]
        for (let index = 0; index < connectors.length; index += 1) {
          const end = index + 1 < connectors.length ? connectors[index + 1].start : line.length
          endpoints.push(line.slice(connectors[index].end, end))
        }
        for (let index = 0; index < connectors.length; index += 1) {
          const from = ensure(firstFlowToken(endpoints[index]), undefined, undefined, parentGroup)
          const to = ensure(firstFlowToken(endpoints[index + 1]), undefined, undefined, parentGroup)
          if (from !== undefined && to !== undefined) {
            pushMermaidEdge(edges, from.id, to.id, connectors[index].kind, connectors[index].label)
          }
        }
      }
      if (groupStack.length > 0) throw new ImportFailure('unclosed-subgraph', groupStack[groupStack.length - 1].label)
      return { nodes, edges }
    }

    function parseMermaid(input) {
      const text = String(input ?? '').replace(/^\uFEFF/, '')
      if (utf8Length(text) > MAX_IMPORT_BYTES) throw new ImportFailure('too-large', '200 KB')
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '' && !line.startsWith('%%'))
      let headerIndex = -1
      let kind = null
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]
        if (/^classDiagram(?:-v2)?\b/i.test(line)) { kind = 'class'; headerIndex = index; break }
        if (/^stateDiagram(?:-v2)?\b/i.test(line)) { kind = 'state'; headerIndex = index; break }
        if (/^(?:flowchart|graph)(?:\s+[A-Za-z]{2})?\b/i.test(line)) { kind = 'flowchart'; headerIndex = index; break }
        if (isMermaidDecoration(line) || /^---$/.test(line)) continue
        throw new ImportFailure('unsupported', line)
      }
      if (kind === null) throw new ImportFailure('unsupported', '')
      const body = lines.slice(headerIndex + 1)
      const parsed = kind === 'class'
        ? parseClassDiagram(body)
        : kind === 'state'
          ? parseStateDiagram(body)
          : parseFlowchart(body)
      if (parsed.nodes.length === 0) throw new ImportFailure('empty')
      if (parsed.nodes.length > MAX_IMPORT_NODES) throw new ImportFailure('too-many-nodes')
      if (parsed.edges.length > 4000) parsed.edges = parsed.edges.slice(0, 4000)
      return {
        kind,
        diagramKey: kind === 'class' ? 'class' : kind === 'state' ? 'state' : 'flowchart',
        nodes: parsed.nodes,
        edges: parsed.edges,
      }
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
    function confirmTokenFromCommand(text) {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('确认命令没有返回可解析的令牌，请重试。')
      }
      if (parsed === null || typeof parsed !== 'object' || typeof parsed.token !== 'string' || parsed.token.trim() === '') {
        throw new Error('确认命令没有返回一次性令牌，请重试。')
      }
      return parsed.token.trim()
    }

    async function dispatch() {
      const bp = state.bp
      if (bp === null) return
      if (bp.modules.length === 0) { toast(t('dispatchBlocked'), 'error'); return }
      let stage = 'save'
      try {
        // Already successfully gated/dispatched on the Host: retry only the prompt so a
        // transient prompt failure does not force the user to re-confirm (tokens are one-time).
        if (bp.status === 'dispatched') {
          stage = 'prompt'
          await sendPrompt(dispatchPrompt(), 'dispatching')
          toast(t('dispatching'), 'success')
          return
        }
        clearAutosaveTimer()
        if (state.dirty) {
          const saved = await saveBlueprint({ silent: true })
          if (!saved) throw new Error('蓝图保存失败，未执行确认与分派，请重试。')
        }
        if (state.bp === null) return
        stage = 'confirm'
        const confirmation = await runBlueprintCommand('confirm')
        const token = confirmTokenFromCommand(confirmation)
        stage = 'dispatch'
        await runBlueprintCommand(`dispatch ${token}`)
        // The Host has already written status=dispatched. Update the local view without
        // writing again: a later save with a stale status must not roll the gate back.
        set({
          bp: state.bp === null ? null : { ...state.bp, status: 'dispatched' },
          dirty: false,
          error: null,
          lastLoaded: Date.now(),
        })
        stage = 'prompt'
        await sendPrompt(dispatchPrompt(), 'dispatching')
        toast(t('dispatching'), 'success')
      } catch (error) {
        const detail = String(error?.message ?? error)
        const message = stage === 'dispatch'
          ? `确认成功，但分派失败，请再次点击「确认并分派」重试：${detail}`
          : stage === 'prompt'
            ? `确认并分派成功，但发送提示失败，请再次点击「确认并分派」重试发送：${detail}`
            : detail
        set({ error: message })
        toast(message, 'error')
      }
    }

    function GlobalSearch({ store }) {
      const bp = store.bp
      const [query, setQuery] = useState('')
      const [open, setOpen] = useState(false)
      const [active, setActive] = useState(0)
      const inputRef = useRef(null)
      const groups = useMemo(() => searchGroups(bp, query), [bp, query])
      const flat = useMemo(() => groups.flatMap(group => group.items), [groups])
      useEffect(() => { setActive(0) }, [query])
      if (bp === null) return null
      const choose = result => {
        if (result === undefined) return
        setOpen(false)
        setQuery('')
        navigateSearch(store, result)
      }
      const onKeyDown = event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) setOpen(true)
          if (flat.length === 0) return
          setActive(current => {
            const next = event.key === 'ArrowDown' ? current + 1 : current - 1
            if (next < 0) return flat.length - 1
            if (next >= flat.length) return 0
            return next
          })
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          choose(flat[active])
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          setQuery('')
          inputRef.current?.blur()
        }
      }
      let resultIndex = -1
      const showPanel = open && query.trim() !== ''
      return h('div', {
        className: 'bp-search',
        onBlur: event => {
          if (event.currentTarget.contains(event.relatedTarget)) return
          setOpen(false)
        },
      },
        h('span', { className: 'bp-search-icon' }, h(Icon, { name: 'search', size: 14 })),
        h('input', {
          ref: inputRef,
          className: 'bp-search-input',
          value: query,
          placeholder: t('searchPlaceholder'),
          'aria-label': t('searchPlaceholder'),
          onChange: event => { setQuery(event.target.value); setOpen(true) },
          onFocus: () => { if (query.trim() !== '') setOpen(true) },
          onKeyDown,
        }),
        query !== '' ? h('button', {
          type: 'button', className: 'bp-search-clear', title: t('close'),
          onClick: () => { setQuery(''); setOpen(false); inputRef.current?.focus() },
        }, h(Icon, { name: 'close', size: 13 })) : null,
        showPanel ? h('div', { className: 'bp-search-panel', role: 'listbox' },
          groups.length === 0 ? h('div', { className: 'bp-search-empty' }, t('searchNoResults')) : null,
          groups.map(group => h('div', { className: 'bp-search-group', key: group.key },
            h('div', { className: 'bp-search-group-title' }, `${group.title} · ${group.items.length}`),
            group.items.map(result => {
              resultIndex += 1
              const index = resultIndex
              return h('button', {
                type: 'button', key: `${group.key}-${index}`,
                className: `bp-search-item${index === active ? ' active' : ''}`,
                role: 'option', 'aria-selected': index === active,
                title: result.label,
                onMouseEnter: () => setActive(index),
                onClick: () => choose(result),
              },
                h('span', { className: `bp-search-kind ${result.kind}` }, result.kind === 'requirement' ? 'R' : result.kind === 'module' ? 'M' : 'L'),
                h('span', { className: 'bp-search-text' }, result.label),
                h('span', { className: 'bp-search-sub' }, result.sub ?? ''))
            }))),
          h('div', { className: 'bp-search-hint' }, t('searchHint'))) : null)
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
          h('span', { className: 'bp-muted' }, store.saving ? t('saving') : store.dirty ? t('unsaved') : store.lastSaveMode === 'draft' ? t('draftSaved') : t('saved'))) : null,
        bp !== null ? h(GlobalSearch, { store }) : null,
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
              h('button', { type: 'button', onClick: exportDrawio }, t('exportDrawio')),
              h('div', { className: 'bp-menu-sep' }),
              h('button', {
                type: 'button', disabled: store.exporting !== null,
                onClick: () => exportDocument('md', store.activeLayerId ?? 'A'),
              }, store.exporting === `md:${store.activeLayerId ?? 'A'}` ? t('exporting') : t('exportMarkdownLayer')),
              h('button', {
                type: 'button', disabled: store.exporting !== null,
                onClick: () => exportDocument('md', 'all'),
              }, store.exporting === 'md:all' ? t('exporting') : t('exportMarkdownAll')),
              h('button', {
                type: 'button', disabled: store.exporting !== null,
                onClick: () => exportDocument('html', store.activeLayerId ?? 'A'),
              }, store.exporting === `html:${store.activeLayerId ?? 'A'}` ? t('exporting') : t('exportHtmlLayer')),
              h('button', {
                type: 'button', disabled: store.exporting !== null,
                onClick: () => exportDocument('html', 'all'),
              }, store.exporting === 'html:all' ? t('exporting') : t('exportHtmlAll')))) : null,
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

      // A closed panel or a session switch must never let an old debounce write into the new session.
      useEffect(() => () => {
        clearAutosaveTimer()
        clearGenerationWatch()
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
            else {
              const parent = (state.activeLayerId ?? 'A') === 'A' ? null : parentLayerId(state.bp, state.activeLayerId)
              if (parent !== null) activateLayer(parent)
              else closeStudio()
            }
            return
          }
          if ((event.key === 'Backspace' || (event.altKey && event.key === 'ArrowLeft')) && state.selected === null && (state.activeLayerId ?? 'A') !== 'A') {
            event.preventDefault()
            const parent = parentLayerId(state.bp, state.activeLayerId)
            if (parent !== null) activateLayer(parent)
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
          h(LayerNav, { store }),
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
            h('button', { type: 'button', className: 'bp-link', onClick: cancelGenerationWait }, t('cancelWaiting'))) : null,
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
.bp-layernav{display:flex;align-items:center;gap:4px;padding:5px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:0 0 auto;overflow-x:auto;scrollbar-width:thin}
.bp-layernav-label{font-size:11px;color:var(--dsw-alias-label-secondary);margin-right:4px;white-space:nowrap}
.bp-layernav-item{border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;font-weight:650;letter-spacing:.05em;padding:2px 9px;border-radius:7px;cursor:pointer;line-height:20px}
.bp-layernav-item:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-layernav-item.active{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent)}
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
.bp-item{display:flex;align-items:flex-start;gap:4px;margin:2px 0;border-radius:8px;transition:background .12s,box-shadow .12s}
.bp-item.linked{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.bp-item.focused{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.bp-item-trace{flex:0 0 auto;min-width:17px;height:17px;margin-top:4px;padding:0 4px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:9.5px;font-weight:650}
.bp-item-trace.active{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
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
.bp-node-linked{animation:bp-pulse 1.7s ease-in-out infinite;pointer-events:none}
@keyframes bp-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.bp-canvas-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:13px;pointer-events:none;text-align:center;padding:20px}
.bp-canvas-hint{position:absolute;left:12px;bottom:10px;font-size:11px;color:var(--dsw-alias-label-secondary);opacity:.8;pointer-events:none}
.bp-zoom{position:absolute;right:12px;bottom:8px;display:flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);padding:2px}
.bp-zoom .bp-btn{width:26px;height:26px;padding:0;justify-content:center}
.bp-zoom span{font-size:11px;color:var(--dsw-alias-label-secondary);min-width:38px;text-align:center}
.bp-right{width:292px;flex:0 0 292px;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);overflow:auto;padding:14px}
.bp-inspector .bp-field{display:block;margin-bottom:10px}
.bp-field span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.bp-field textarea{resize:vertical}
.bp-req-hint{font-size:10px;line-height:1.4;color:var(--dsw-alias-label-secondary);opacity:.85;margin:-1px 0 5px}
.bp-req-list{max-height:230px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px;background:var(--dsw-alias-bg-base)}
.bp-req-group{margin-bottom:7px}
.bp-req-group:last-child{margin-bottom:0}
.bp-req-group-title{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-label-secondary);margin:1px 3px 3px}
.bp-req-option{display:flex;align-items:flex-start;gap:5px;padding:3px 4px;border-radius:5px;cursor:pointer;font-size:11px;line-height:1.4}
.bp-req-option:hover{background:var(--dsw-alias-bg-layer-2)}
.bp-req-option input{width:12px;height:12px;margin:1px 0 0;flex:0 0 auto}
.bp-req-option .bp-req-text{display:inline;margin:0;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-primary);word-break:break-word}
.bp-req-empty{font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.7;padding:0 4px}
.bp-inspector .bp-danger{margin-top:4px}
.bp-divider{height:1px;background:var(--dsw-alias-border-l1);margin:16px 0}
.bp-modules{display:flex;flex-direction:column;gap:8px}
.bp-module{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 10px;cursor:pointer}
.bp-module:hover{border-color:var(--dsw-alias-border-l2)}
.bp-module-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.bp-module strong{font-size:12.5px}
.bp-module p{margin:5px 0 0;font-size:11.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.bp-module-deps{margin-top:6px;font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.85}
.bp-module-hint{margin-bottom:2px}
.bp-module.selected{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,transparent)}
.bp-module-editor{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l2);cursor:default}
.bp-module-editor .bp-field{display:block;margin-bottom:8px}
.bp-module-editor .bp-field span{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:4px}
.bp-module-editor .bp-field textarea{font-size:11px}
.bp-node-picker{max-height:180px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px;background:var(--dsw-alias-bg-layer-1)}
.bp-node-option{display:flex;align-items:flex-start;gap:5px;padding:3px 4px;border-radius:5px;cursor:pointer;font-size:11px;line-height:1.4}
.bp-node-option:hover{background:var(--dsw-alias-bg-layer-2)}
.bp-node-option input{width:12px;height:12px;margin:1px 0 0;flex:0 0 auto}
.bp-node-option .bp-node-text{display:inline;margin:0;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-primary);word-break:break-word}
.bp-module-status-label{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.bp-module-status{width:auto;min-width:84px;max-width:118px;height:24px;padding:0 4px;font-size:10.5px}
.bp-module-acceptance{margin-top:6px}
.bp-acceptance-list{margin:3px 0 0;padding-left:16px;font-size:10.5px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.bp-acceptance-list li{margin:1px 0}
.bp-acceptance-empty{font-size:10px;opacity:.7;margin-top:2px}
.bp-verification{margin-top:7px;padding:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}
.bp-verification-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px}
.bp-verification-title{font-size:10.5px;font-weight:650;color:var(--dsw-alias-label-secondary)}
.bp-verification-layers{display:flex;flex-direction:column;gap:3px}
.bp-verification-layer{display:flex;align-items:center;gap:5px;min-width:0;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.bp-verification-role{flex:0 0 auto;min-width:28px}
.bp-verification-evidence{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75}
.bp-verification-editor{margin-top:8px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l2)}
.bp-verification-form{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.bp-verification-field{display:block;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.bp-verification-field span{display:block;margin-bottom:3px}
.bp-verification-field .bp-input{height:26px;padding:0 5px;font-size:10.5px}
.bp-verification-evidence-input{grid-column:1 / -1;height:26px;padding:0 5px;font-size:10.5px}
.bp-verification-submit{grid-column:1 / -1;justify-content:center;height:26px;font-size:10.5px}
.bp-verification-hint{font-size:10px;line-height:1.4;margin-top:5px;opacity:.75}
.bp-chip-needs-rework{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,transparent)}
.bp-chip-verify-passed{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}
.bp-chip-verify-failed{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
.bp-chip-verify-pending{color:var(--dsw-alias-label-secondary)}
.bp-chip{font-size:10px;padding:1px 6px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.bp-chip-running{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}
.bp-chip-blocked{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}
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
.bp-menu-pop button:disabled{opacity:.5;cursor:not-allowed;background:transparent}
.bp-menu-sep{height:1px;background:var(--dsw-alias-border-l1);margin:4px 3px}
.bp-open{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 9px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;position:relative}
.bp-open:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-open.bp-has{color:var(--dsw-alias-brand-primary)}
.bp-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);display:inline-block}
.bp-panel-tabs{display:flex;gap:3px;margin-bottom:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:2px;background:var(--dsw-alias-bg-base)}
.bp-panel-tab{flex:1;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:5px 4px;border-radius:6px;cursor:pointer}
.bp-panel-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.bp-panel-tab.active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:650}
.bp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.bp-checks{display:flex;flex-direction:column;gap:8px}
.bp-check-counts{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.bp-check-count{display:flex;flex-direction:column;gap:1px;padding:6px 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}
.bp-check-count span{font-size:10px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-check-count strong{font-size:16px;line-height:1.15;font-weight:700}
.bp-check-count.error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent)}
.bp-check-count.error strong{color:var(--dsw-alias-state-error-primary)}
.bp-check-count.warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 38%,transparent)}
.bp-check-count.warn strong{color:var(--dsw-alias-state-warn-primary)}
.bp-check-count.info{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}
.bp-check-count.info strong{color:var(--dsw-alias-brand-primary)}
.bp-check-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);padding:8px 9px;display:flex;flex-direction:column;gap:7px}
.bp-check-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px}
.bp-check-section-title{font-size:10px;font-weight:700;letter-spacing:.05em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.bp-check-percent{font-size:10.5px;color:var(--dsw-alias-state-success-primary);font-weight:650;white-space:nowrap}
.bp-check-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.bp-check-stat{display:flex;flex-direction:column;gap:1px;min-width:0}
.bp-check-stat span{font-size:9.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-check-stat strong{font-size:13px;line-height:1.2}
.bp-check-gaps{display:flex;flex-direction:column;gap:4px;border-top:1px dashed var(--dsw-alias-border-l1);padding-top:6px}
.bp-check-gap{display:flex;align-items:baseline;justify-content:space-between;gap:6px;font-size:10px;color:var(--dsw-alias-label-secondary);min-width:0}
.bp-check-gap span{flex:0 0 auto}
.bp-check-gap strong{font-weight:600;color:var(--dsw-alias-label-primary);font-size:10px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-check-truncated{font-size:10.5px;line-height:1.45;color:var(--dsw-alias-state-warn-primary);padding:5px 7px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,transparent);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent)}
.bp-check-issues{display:flex;flex-direction:column;gap:8px}
.bp-check-group{display:flex;flex-direction:column;gap:4px}
.bp-check-group-title{font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.bp-check-group-title.error{color:var(--dsw-alias-state-error-primary)}
.bp-check-group-title.warn{color:var(--dsw-alias-state-warn-primary)}
.bp-check-group-title.info{color:var(--dsw-alias-brand-primary)}
.bp-check-issue{display:block;width:100%;box-sizing:border-box;text-align:left;border:1px solid var(--dsw-alias-border-l1);border-left-width:3px;border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;padding:6px 8px}
button.bp-check-issue{cursor:pointer}
button.bp-check-issue:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.bp-check-issue.error{border-left-color:var(--dsw-alias-state-error-primary)}
.bp-check-issue.warn{border-left-color:var(--dsw-alias-state-warn-primary)}
.bp-check-issue.info{border-left-color:var(--dsw-alias-brand-primary)}
.bp-check-issue-top{display:flex;align-items:center;gap:5px;min-width:0}
.bp-check-sev{flex:0 0 auto;font-size:9px;font-weight:700;letter-spacing:.03em;padding:0 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.bp-check-sev.error{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent)}
.bp-check-sev.warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 38%,transparent)}
.bp-check-sev.info{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent)}
.bp-check-code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9.5px;color:var(--dsw-alias-label-secondary);margin-left:auto}
.bp-check-message{margin-top:3px;font-size:11px;line-height:1.45;word-break:break-word}
.bp-check-meta{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
.bp-check-meta span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;line-height:1.5;padding:0 4px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.bp-check-empty{padding:16px 4px;text-align:center;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-state-success-primary)}
.bp-check-error{font-size:11px;line-height:1.5;white-space:pre-wrap;padding:7px 8px;border-radius:8px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);color:var(--dsw-alias-state-error-primary)}
.bp-fields{display:flex;flex-direction:column;gap:4px}
.bp-field-row{display:flex;align-items:center;gap:3px}
.bp-field-kind{flex:0 0 62px;width:62px;padding:4px 2px}
.bp-field-actions{display:flex;gap:4px;margin-top:4px}
.bp-field-actions .bp-add-field{margin-top:0}
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
.bp-diff-toggle{width:100%;background:none;border:0;padding:0;cursor:pointer;color:inherit;font:inherit;text-align:left}
.bp-diff-toggle:hover strong{text-decoration:underline}
.bp-diff-chips{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 4px}
.bp-diff-chip{font-size:10px;line-height:1.4;padding:1px 5px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);white-space:nowrap}
.bp-diff-body{display:flex;flex-direction:column;gap:4px}
.bp-diff-group{display:flex;flex-direction:column;gap:1px}
.bp-diff-group-title{font-size:10px;font-weight:650;letter-spacing:.02em;margin-top:2px}
.bp-diff-change{font-size:10px;line-height:1.4;padding-left:10px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.bp-review{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 10px;margin-top:12px}
.bp-review-head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;flex-wrap:wrap}
.bp-review-head .bp-kicker{margin-bottom:3px}
.bp-review-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bp-review-list{display:flex;flex-direction:column;gap:5px;margin-top:8px;max-height:300px;overflow:auto}
.bp-review-row{display:flex;gap:8px;align-items:flex-start;padding:6px 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}
.bp-review-row.decided{opacity:.68}
.bp-review-main{flex:1;min-width:0}
.bp-review-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-secondary)}
.bp-review-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;padding:0 4px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);margin-right:5px;white-space:nowrap}
.bp-review-section{font-size:10px}
.bp-review-decision{font-size:10px;font-weight:650;color:var(--dsw-alias-brand-primary)}
.bp-review-text{font-size:11px;line-height:1.5;margin-top:3px;word-break:break-word}
.bp-review-before{color:var(--dsw-alias-label-secondary);text-decoration:line-through}
.bp-review-arrow{color:var(--dsw-alias-label-secondary)}
.bp-review-actions{display:flex;gap:4px;flex:0 0 auto}
.bp-review-actions .bp-btn{height:24px;font-size:10.5px;padding:0 7px}
.bp-seg-add{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 20%,transparent);border-radius:2px;text-decoration:none}
.bp-seg-remove{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,transparent);border-radius:2px;text-decoration:line-through}
.bp-empty-diff{padding:20px 0;color:var(--dsw-alias-label-secondary);font-size:12px}
.bp-tabs{max-width:100%;overflow-x:auto;scrollbar-width:thin;flex-wrap:nowrap;min-width:0}
.bp-tab{white-space:nowrap}
.bp-import-backdrop{position:absolute;inset:0;background:rgba(8,12,20,.45);display:flex;align-items:center;justify-content:center;z-index:10}
.bp-import-dialog{width:min(680px,90%);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:8px}
.bp-import-dialog p{margin:0}
.bp-import-source{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.bp-import-source .bp-seg-btn{font-size:11px;padding:4px 8px}
.bp-import-detected{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.bp-import-text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.4;resize:vertical}
.bp-import-row{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}
.bp-check{display:flex;align-items:center;gap:4px}
.bp-check input{width:12px;height:12px;margin:0}
.bp-import-actions{display:flex;gap:6px;justify-content:flex-end}
.bp-search{position:relative;flex:0 1 280px;min-width:180px;margin-left:auto}
.bp-search~.bp-actions{margin-left:0}
.bp-search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);display:flex;color:var(--dsw-alias-label-secondary);pointer-events:none}
.bp-search-input{width:100%;box-sizing:border-box;height:30px;padding:0 28px 0 28px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.bp-search-input:focus{border-color:var(--dsw-alias-brand-primary)}
.bp-search-clear{position:absolute;right:4px;top:5px;width:20px;height:20px;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.bp-search-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-search-panel{position:absolute;left:0;right:0;top:36px;z-index:20;max-height:380px;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,.26);padding:5px}
.bp-search-group+.bp-search-group{margin-top:4px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:4px}
.bp-search-group-title{font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);padding:4px 7px 3px;text-transform:uppercase}
.bp-search-item{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;padding:5px 7px;cursor:pointer}
.bp-search-item:hover,.bp-search-item.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent)}
.bp-search-kind{flex:0 0 17px;height:17px;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;font-size:9.5px;font-weight:700;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.bp-search-kind.requirement{color:var(--dsw-alias-brand-primary)}
.bp-search-kind.module{color:var(--dsw-alias-state-success-primary)}
.bp-search-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-search-sub{flex:0 1 42%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:10px;text-align:right}
.bp-search-empty{padding:12px 8px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.bp-search-hint{padding:5px 7px 2px;font-size:9.5px;color:var(--dsw-alias-label-secondary);opacity:.8}
.bp-breadcrumbs{display:flex;align-items:center;gap:3px;flex:0 0 100%;min-width:0;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.bp-crumb-back{flex:0 0 auto;width:24px;height:24px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.bp-crumb-back:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-crumb-back:disabled{opacity:.35;cursor:default}
.bp-crumb{flex:0 0 auto;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:2px 7px;cursor:pointer;white-space:nowrap}
.bp-crumb:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.bp-crumb.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);font-weight:650}
.bp-crumb-module{flex:0 1 auto;min-width:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;padding:2px 4px;cursor:pointer}
.bp-crumb-module:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,transparent)}
.bp-crumb-sep{flex:0 0 auto;color:var(--dsw-alias-label-secondary);opacity:.5;font-size:10px}
.bp-layer-chip{display:flex;align-items:center;gap:6px;margin:2px 0 4px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.bp-layer-chip strong{flex:0 0 auto;padding:1px 6px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent);color:var(--dsw-alias-brand-primary);font-size:10.5px}
.bp-layer-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-layer-summary{margin-top:6px;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:3px}
.bp-layer-summary .bp-check{font-size:10px;color:var(--dsw-alias-label-secondary)}
.bp-layer-gap{color:var(--dsw-alias-state-warn-primary)}
.bp-item-module{flex:0 0 auto;max-width:74px;margin-top:4px;padding:0 4px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:9px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-tab.missing{opacity:.55;border-style:dashed}
.bp-tab.missing:hover{opacity:.85}
.bp-node-enter{cursor:pointer}
.bp-module-layer{display:flex;align-items:center;gap:7px;margin-top:2px;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l2)}
.bp-module-layer .bp-btn{height:26px;font-size:10.5px;padding:0 8px}
.bp-module-layer .bp-muted{font-size:10px}
.bp-back-label{font-size:11.5px}
@media (max-width:1400px){.bp-back-label{display:none}}
@media (max-width:1180px){.bp-right{display:none}.bp-left{width:300px;flex-basis:300px}}
@media (max-width:860px){.bp-left{display:none}.bp-shell{width:100vw;height:100vh;border-radius:0}.bp-open-label{display:none}}
@media (max-width:520px){.bp-empty-card{padding:20px}.bp-template-grid{grid-template-columns:1fr 1fr}}
@media (prefers-reduced-motion:reduce){.bp-spinner{animation:none}.bp-node-linked{animation:none;opacity:.85}}
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
      __test: {
        DIAGRAM_TYPE_ORDER,
        Edge,
        ImportFailure,
        MAX_IMPORT_BYTES,
        MAX_IMPORT_NODES,
        NodeShape,
        TEMPLATES,
        defaultEdgeKind,
        detectImportSource,
        edgeKindsFor,
        ensureLayout,
        flowchartMermaidSource,
        flowchartHiddenIds,
        importErrorMessage,
        layoutDiagram,
        layoutFlowchart,
        layoutFlowchartGroups,
        parseMermaid,
        typesFor,
      },
    }
  },
})
