import { ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 跨画布/跨项目粘贴：复制时把节点载荷序列化进系统剪贴板，
// 粘贴端在本地内存剪贴板为空时按前缀识别并反序列化。
// 注意：这会把一段带前缀的 JSON 写入系统剪贴板的 text/plain，
// 因此用户复制节点后在其它文本框里 Ctrl+V 会粘贴出该 JSON 字符串，
// 这是支持跨项目粘贴的必要代价。
const FLOW_CLIPBOARD_MARKER = '__flow_clipboard__:'

interface FlowClipboardPayload {
  nodes: any[]
  edges: any[]
  subgraphs: Record<string, any>
  mode: string
}

function serializeFlowPayload(payload: FlowClipboardPayload): string {
  return FLOW_CLIPBOARD_MARKER + JSON.stringify({
    nodes: payload.nodes || [],
    edges: payload.edges || [],
    subgraphs: payload.subgraphs || {},
    mode: payload.mode || 'copy',
  })
}

function tryParseFlowPayload(text: unknown): FlowClipboardPayload | null {
  if (typeof text !== 'string' || !text.startsWith(FLOW_CLIPBOARD_MARKER)) return null
  let parsed: any
  try {
    parsed = JSON.parse(text.slice(FLOW_CLIPBOARD_MARKER.length))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  if (!Array.isArray(parsed.nodes)) return null
  for (const n of parsed.nodes) {
    if (!n || typeof n !== 'object') return null
    if (!n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number') return null
  }
  if (!Array.isArray(parsed.edges)) parsed.edges = []
  if (!parsed.subgraphs || typeof parsed.subgraphs !== 'object' || Array.isArray(parsed.subgraphs)) {
    parsed.subgraphs = {}
  }
  // 跨项目粘贴一律按 copy 处理，避免触发源项目的 cut 语义
  return { nodes: parsed.nodes, edges: parsed.edges, subgraphs: parsed.subgraphs, mode: 'copy' }
}

async function writeFlowPayloadToSystemClipboard(payload: FlowClipboardPayload): Promise<void> {
  try {
    if (!navigator?.clipboard?.writeText) return
    await navigator.clipboard.writeText(serializeFlowPayload(payload))
  } catch {
    // 忽略：跨项目粘贴是尽力而为，权限/焦点失败时不影响同画布粘贴
  }
}

export interface FlowClipboardDeps {
  // State refs
  nodes: Ref<any[]>
  edges: Ref<any[]>
  // Functions
  emit: (event: string, ...args: any[]) => void
  props: { allowSubgraphCreate?: boolean; subgraphDefinitions?: Record<string, any> }
  normalizeSubgraphName: (name: string) => string
  buildUniquePastedSubgraphLabel: (sourceLabel: string, occupiedNames: Set<string>) => string
  createRuntimeId: (prefix?: string) => string
  assignToGroupIfOverlapping: (node: any, x: number, y: number) => void
  registerGridChildIfNeeded: (nodeId: string) => boolean
  addNodes: (nodes: any[]) => void
  addEdges: (edges: any[]) => void
  saveHistory: () => void
  getExpandedSelectedNodes: () => any[]
  isPointInsideCanvas: (clientX: number, clientY: number) => boolean
  isTextInputLike: (target: any) => boolean
  isGenerationPanelInputLike: (target: any) => boolean
  getCanvasPastePosition: (event: any) => { x: number; y: number } | null
  lastMousePosition: Ref<{ x: number; y: number }>
  createUploadNodesFromFiles: (
    files: File[],
    position: { x: number; y: number },
    message: string,
  ) => Promise<unknown[]>
}

export function useFlowClipboard(deps: FlowClipboardDeps) {
  // 剪贴板
  const clipboard = ref<FlowClipboardPayload>({ nodes: [], edges: [], subgraphs: {}, mode: 'copy' })

  function collectSelectedClipboardPayload() {
    const selectedNodesExpanded = deps.getExpandedSelectedNodes()
    if (selectedNodesExpanded.length <= 0) return null
    const selectedIds = new Set(selectedNodesExpanded.map((node: any) => node.id))

    const selectedEdges = deps.edges.value.filter((edge: any) =>
      selectedIds.has(edge.source) && selectedIds.has(edge.target)
    )

    const payload: FlowClipboardPayload = {
      nodes: [...selectedIds].map((id: string) => {
        const n = deps.nodes.value.find((nd: any) => nd.id === id)
        if (!n) return null
        const parentAlsoCopied = n.parentNode && selectedIds.has(n.parentNode)
        return {
          ...JSON.parse(JSON.stringify(n)),
          position: {
            x: parentAlsoCopied ? n.position.x : (n.computedPosition?.x ?? n.position.x),
            y: parentAlsoCopied ? n.position.y : (n.computedPosition?.y ?? n.position.y)
          },
          parentNode: parentAlsoCopied ? n.parentNode : undefined
        }
      }).filter(Boolean),
      edges: JSON.parse(JSON.stringify(selectedEdges)),
      subgraphs: selectedNodesExpanded
        .filter((node: any) => node?.type === 'subgraph' && node?.data?.subgraphId)
        .reduce((acc: Record<string, any>, node: any) => {
          const subgraphId = String(node?.data?.subgraphId || '').trim()
          if (!subgraphId || acc[subgraphId]) return acc
          const subgraphDef = deps.props.subgraphDefinitions?.[subgraphId]
          if (!subgraphDef) return acc
          acc[subgraphId] = JSON.parse(JSON.stringify(subgraphDef))
          return acc
        }, {}),
      mode: 'copy',
    }
    // 同步写入系统剪贴板，供跨画布/跨项目粘贴
    void writeFlowPayloadToSystemClipboard(payload)
    return payload
  }

  async function readClipboardImageFiles(event: any): Promise<File[]> {
    const fromEvent = Array.from(event.clipboardData?.items || [])
      .filter((item: any) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item: any) => item.getAsFile())
      .filter(Boolean)

    if (fromEvent.length) return fromEvent

    if (!navigator.clipboard?.read) return []

    try {
      const clipboardItems = await navigator.clipboard.read()
      const files: File[] = []
      for (const item of clipboardItems) {
        const imageType = item.types.find((type: string) => type.startsWith('image/'))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        const ext = imageType.split('/')[1] || 'png'
        files.push(new File([blob], `pasted-image.${ext}`, { type: imageType }))
      }
      return files
    } catch {
      return []
    }
  }

  function addAnnotationNote(x: number, y: number, text: string) {
    const nodeId = deps.createRuntimeId()
    const newNode = {
      id: nodeId,
      type: 'annotation_note',
      position: { x, y },
      data: {
        label: text || '文字标注',
        content: text || '',
        mediaType: 'text',
      },
    }
    deps.addNodes([newNode])
  }

  function pasteInternalClipboardNodes(position: { x: number; y: number }, event: any) {
    if (clipboard.value.nodes.length === 0) return

    event.preventDefault()
    event.__flowCanvasPasteHandled = true

    if (!deps.props.allowSubgraphCreate && clipboard.value.nodes.some((node: any) => node?.type === 'subgraph')) {
      ElMessage.warning('子图内禁止粘贴包含子图节点的内容')
      return
    }

    const idMap = new Map()
    let deltaX = 50
    let deltaY = 50
    const subgraphIdMap = new Map()
    const subgraphPayload: Record<string, any> = {}
    const occupiedSubgraphNames = new Set(
      Object.values(deps.props.subgraphDefinitions || {})
        .map((subgraph: any) => deps.normalizeSubgraphName(subgraph?.name))
        .filter(Boolean)
    )

    const shouldRenamePastedSubgraphs = clipboard.value.mode !== 'cut'
    Object.entries(clipboard.value.subgraphs || {}).forEach(([oldSubgraphId, subgraphDef]: [string, any]) => {
      const nextSubgraphId = deps.createRuntimeId('sub')
      const sourceLabel = subgraphDef?.name || clipboard.value.nodes.find((node: any) => node?.data?.subgraphId === oldSubgraphId)?.data?.label || '子图'
      const nextLabel = shouldRenamePastedSubgraphs ? deps.buildUniquePastedSubgraphLabel(
        subgraphDef?.name || clipboard.value.nodes.find((node: any) => node?.data?.subgraphId === oldSubgraphId)?.data?.label || '子图',
        occupiedSubgraphNames as Set<string>
      ) : sourceLabel
      subgraphIdMap.set(oldSubgraphId, nextSubgraphId)
      subgraphPayload[nextSubgraphId] = {
        ...JSON.parse(JSON.stringify(subgraphDef || {})),
        id: nextSubgraphId,
        name: nextLabel,
      }
    })

    const rootNodes = clipboard.value.nodes.filter((n: any) => !n.parentNode)
    const minX = rootNodes.length > 0 ? Math.min(...rootNodes.map((n: any) => n.position.x)) : 0
    const minY = rootNodes.length > 0 ? Math.min(...rootNodes.map((n: any) => n.position.y)) : 0

    deltaX = position.x - minX
    deltaY = position.y - minY

    const newNodes = clipboard.value.nodes.map((node: any) => {
      const newId = deps.createRuntimeId('edge')
      idMap.set(node.id, newId)
      const nextNode = { ...node, id: newId, selected: true }
      if (node?.type === 'subgraph') {
        const oldSubgraphId = String(node?.data?.subgraphId || '').trim()
        const nextSubgraphId = subgraphIdMap.get(oldSubgraphId)
        const nextSubgraph = nextSubgraphId ? subgraphPayload[nextSubgraphId] : null
        nextNode.data = {
          ...(node.data || {}),
          ...(nextSubgraphId ? { subgraphId: nextSubgraphId } : {}),
          ...(nextSubgraph ? {
            label: nextSubgraph.name || node?.data?.label || '子图',
            nodeCount: Array.isArray(nextSubgraph.nodes) ? nextSubgraph.nodes.length : Number(node?.data?.nodeCount || 0) || 0,
          } : {}),
        }
      }
      return nextNode
    }).map((node: any) => {
      const parentAlsoCopied = node.parentNode && idMap.has(node.parentNode)

      if (parentAlsoCopied) {
        node.parentNode = idMap.get(node.parentNode)
        node.extent = undefined
      } else {
        const absX = node.position.x + deltaX
        const absY = node.position.y + deltaY
        deps.assignToGroupIfOverlapping(node, absX, absY)
      }
      return node
    })

    const newEdges = clipboard.value.edges.map((edge: any) => ({
      ...edge,
      id: `e${idMap.get(edge.source) || edge.source}-${idMap.get(edge.target) || edge.target}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
      selected: true
    }))

    deps.nodes.value.forEach((n: any) => n.selected = false)
    deps.edges.value.forEach((e: any) => e.selected = false)

    deps.addNodes(newNodes)
    // grid 模式：把落入 grid 组的粘贴节点登记到对应 gridOrder 空格
    newNodes.forEach((n: any) => deps.registerGridChildIfNeeded(n.id))
    deps.addEdges(newEdges)
    if (Object.keys(subgraphPayload).length > 0) {
      deps.emit('paste-subgraphs', { subgraphs: subgraphPayload })
    }

    clipboard.value = { nodes: newNodes, edges: newEdges, subgraphs: subgraphPayload, mode: clipboard.value.mode || 'copy' }
    setTimeout(deps.saveHistory, 50)
  }

  async function handleCanvasPaste(event: any) {
    if (deps.isTextInputLike(event.target)) return

    const position = deps.getCanvasPastePosition(event)
    if (!position) return

    // 跨画布/跨项目粘贴：本地内存剪贴板为空时，尝试从系统剪贴板解析带前缀的节点载荷
    if (clipboard.value.nodes.length === 0 && !deps.isTextInputLike(event.target)) {
      const sysText = event.clipboardData?.getData('text/plain')
      const sysPayload = tryParseFlowPayload(sysText)
      if (sysPayload && sysPayload.nodes.length > 0) {
        clipboard.value = { ...sysPayload, mode: 'copy' }
      }
    }

    // 内部剪贴板优先：有节点时直接粘贴节点
    if (clipboard.value.nodes.length > 0 && !deps.isTextInputLike(event.target)) {
      pasteInternalClipboardNodes(position, event)
      clipboard.value = { nodes: [], edges: [], subgraphs: {}, mode: 'copy' }
      return
    }

    const files = await readClipboardImageFiles(event)

    if (files.length) {
      event.__flowCanvasPasteHandled = true
      event.preventDefault()
      await deps.createUploadNodesFromFiles(files, position, `正在上传 ${files.length} 张截图...`)
      return
    }

    // 判断是否有纯文本（忽略本工具写入的节点载荷前缀串，避免误加为标注）
    const text = event.clipboardData?.getData('text/plain')?.trim()
    if (text && !text.startsWith(FLOW_CLIPBOARD_MARKER)) {
      event.__flowCanvasPasteHandled = true
      event.preventDefault()

      if (text.length > 100) {
        try {
          await ElMessageBox.confirm(
            `粘贴文本超过100字（当前${text.length}字），确认添加为文字标注？`,
            '确认添加',
            { confirmButtonText: '添加', cancelButtonText: '取消', type: 'info' },
          )
        } catch {
          return
        }
      }

      addAnnotationNote(position.x, position.y, text)
      return
    }
  }

  return {
    clipboard,
    collectSelectedClipboardPayload,
    pasteInternalClipboardNodes,
    handleCanvasPaste,
    readClipboardImageFiles,
    addAnnotationNote,
  }
}
