import { normalizeBatchGridItems } from '@/utils/batchGridItems'
import { normalizeTextureMaterialItems } from '@/utils/textureMaterialItems'
import { buildTextureMaterialPorts } from '@/composables/flow/textureMaterialConsumerNode'
export type WorkflowMediaType = 'image' | 'video' | 'audio' | 'text' | '3d_model'

export type WorkflowNodeKind = 'file_input' | 'aigc_result' | 'generate' | 'annotation' | 'director_3d'

export type WorkflowRequest = {
  capability: string
  mode: string
  params: Record<string, any>
}

export type PortDirection = 'input' | 'output'

export type NodePort = {
  id: string
  label?: string
  mediaType: WorkflowMediaType
  direction: PortDirection
  visible?: boolean
  disabled?: boolean
  multiple?: boolean
}

const FILE_INPUT_NODE_TYPES = new Set([
  'file_input',
  'text_generation',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
  'aigc_result',
])

const GENERATION_CARD_NODE_TYPES = new Set([
  'text_generation',
  'image_generation',
  'video_generation',
  'model_generation',
  'audio_generation',
])

export function isFileInputNodeType(nodeType = ''): boolean {
  return FILE_INPUT_NODE_TYPES.has(nodeType)
}

const NODE_KIND_BY_TYPE: Record<string, WorkflowNodeKind> = {
  generate: 'generate',
  aigc_result: 'aigc_result',
  annotation_note: 'annotation',
  location_marker: 'annotation',
  director_3d: 'director_3d',
  batch_grid: 'file_input',
  texture_material: 'file_input',
  file_input: 'file_input',
  text_generation: 'file_input',
  image_generation: 'file_input',
  video_generation: 'file_input',
  model_generation: 'file_input',
  audio_generation: 'file_input',
}

const MEDIA_TYPE_BY_NODE_TYPE: Record<string, WorkflowMediaType> = {
  annotation_note: 'text',
  location_marker: 'text',
  file_input: 'image',
  text_generation: 'text',
  image_generation: 'image',
  video_generation: 'video',
  model_generation: '3d_model',
  audio_generation: 'audio',
  director_3d: 'text',
  batch_grid: 'image',
  texture_material: 'image',
}

const NODE_TYPE_BY_MEDIA_TYPE: Record<WorkflowMediaType, string> = {
  image: 'file_input',
  video: 'file_input',
  audio: 'file_input',
  text: 'file_input',
  '3d_model': 'file_input',
}

const DEFAULT_CAPABILITY_BY_NODE_TYPE: Record<string, string> = {
  text_generation: 'chat',
  image_generation: 'image_generation',
  video_generation: 'video_generation',
  model_generation: 'model_generation',
  audio_generation: 'audio_generation',
  file_input: 'image_generation',
}

const DEFAULT_PORTS_BY_NODE_TYPE: Record<string, { inputs: NodePort[]; outputs: NodePort[] }> = {
  annotation_note: {
    inputs: [],
    outputs: [],
  },
  location_marker: {
    inputs: [],
    outputs: [],
  },
  file_input: {
    inputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true }],
    outputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'output', visible: true }],
  },
  text_generation: {
    inputs: [{ id: 'text', label: 'Text', mediaType: 'text', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  image_generation: {
    inputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  video_generation: {
    inputs: [{ id: 'video', label: 'Video', mediaType: 'video', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  model_generation: {
    inputs: [{ id: '3d_model', label: '3D Model', mediaType: '3d_model', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  audio_generation: {
    inputs: [{ id: 'audio', label: 'Audio', mediaType: 'audio', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  aigc_result: {
    inputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true }],
    outputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'output', visible: true }],
  },
  generate: {
    inputs: [{ id: 'input', label: 'Input', mediaType: 'image', direction: 'input', visible: true, multiple: true }],
    outputs: [],
  },
  director_3d: {
    inputs: [
      { id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true, multiple: true },
    ],
    outputs: [{ id: 'text', label: 'Text', mediaType: 'text', direction: 'output', visible: true }],
  },
  batch_grid: {
    inputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true, multiple: true }],
    outputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'output', visible: true }],
  },
  texture_material: {
    inputs: buildTextureMaterialPorts().inputs as any,
    outputs: buildTextureMaterialPorts().outputs as any,
  },
}

function cloneObject<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeString(value: any): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim()
}

function readPositiveNumber(value: any): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function normalizeDisplaySize(value: any): { width: number; height: number } | null {
  if (!isPlainObject(value)) return null
  const width = readPositiveNumber(value.width)
  const height = readPositiveNumber(value.height)
  if (!width || !height) return null
  return { width, height }
}

export function sanitizeWorkflowRequestParams(value: any): Record<string, any> {
  const params = isPlainObject(value) ? cloneObject(value) : {}
  delete params.allow_generate_count
  delete params.task_id
  delete params.query_id
  delete params.record_id
  delete params.aigc_record_id
  delete params.vendor
  delete params.vendor_id
  delete params.vendors
  delete params.events_url
  delete params.status
  delete params.progress
  delete params.file_urls
  delete params.reference_urls
  delete params.reference_files
  delete params.files
  delete params.file_url
  delete params.image_urls
  delete params.image_first_frame
  delete params.image_last_frame
  return params
}

function getFileExtension(url: string): string {
  return normalizeString(url).split(/[?#]/)[0].split('.').pop()?.toLowerCase() || ''
}

export function getNodeKindByType(nodeType = ''): WorkflowNodeKind {
  return NODE_KIND_BY_TYPE[nodeType] || 'file_input'
}

function resolveNodeKind(nodeType = '', data?: Record<string, any>): WorkflowNodeKind {
  const explicit = normalizeString(data?.nodeKind) as WorkflowNodeKind
  if (explicit === 'file_input' || explicit === 'aigc_result' || explicit === 'generate' || explicit === 'annotation' || explicit === 'director_3d') {
    return explicit
  }
  if (nodeType === 'annotation_note') {
    return 'annotation'
  }
  if (nodeType === 'director_3d') {
    return 'director_3d'
  }
  if (nodeType === 'aigc_result') {
    return 'aigc_result'
  }
  if (GENERATION_CARD_NODE_TYPES.has(nodeType)) {
    return 'file_input'
  }
  if (getNodeRecordId(data)) {
    return 'aigc_result'
  }
  return getNodeKindByType(nodeType)
}

export function inferMediaTypeFromUrl(url: string, fallback: WorkflowMediaType = 'image'): WorkflowMediaType {
  const ext = getFileExtension(url)
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(ext)) return 'audio'
  if (['txt', 'md', 'csv', 'json', 'xml'].includes(ext)) return 'text'
  if (['glb', 'gltf', 'fbx', 'obj', 'usdz', 'blend'].includes(ext)) return '3d_model'
  return fallback
}

export function inferMediaType(value: any, nodeType = '', url = ''): WorkflowMediaType {
  const raw = normalizeString(value).toLowerCase()
  if (raw === 'image' || raw === 'video' || raw === 'audio' || raw === 'text' || raw === '3d_model') {
    return raw as WorkflowMediaType
  }
  const typeFallback = MEDIA_TYPE_BY_NODE_TYPE[nodeType] || 'image'
  return url ? inferMediaTypeFromUrl(url, typeFallback) : typeFallback
}

export function getNodeTypeByMediaType(mediaType: WorkflowMediaType): string {
  return NODE_TYPE_BY_MEDIA_TYPE[mediaType] || 'file_input'
}

function normalizePortMediaType(value: any, fallback: WorkflowMediaType = 'image'): WorkflowMediaType {
  return inferMediaType(value, '', '',) || fallback
}

function normalizePort(port: any, direction: PortDirection, fallbackIndex: number, fallbackMediaType: WorkflowMediaType): NodePort {
  const mediaType = inferMediaType(port?.mediaType, '', '',) || fallbackMediaType
  return {
    id: normalizeString(port?.id || port?.name || `${direction}_${fallbackIndex + 1}`),
    label: normalizeString(port?.label || port?.name || '') || undefined,
    mediaType,
    direction,
    visible: port?.visible !== false,
    disabled: !!port?.disabled,
    multiple: !!port?.multiple,
  }
}

function buildPortsFromLegacy(inputs: any[] = [], outputs: any[] = [], fallbackMediaType: WorkflowMediaType) {
  return {
    inputs: inputs.map((port, index) => normalizePort(port, 'input', index, fallbackMediaType)),
    outputs: outputs.map((port, index) => normalizePort(port, 'output', index, fallbackMediaType)),
  }
}

function clonePorts(ports: { inputs?: NodePort[]; outputs?: NodePort[] } | undefined) {
  return {
    inputs: Array.isArray(ports?.inputs) ? ports.inputs.map((port, index) => normalizePort(port, 'input', index, 'image')) : [],
    outputs: Array.isArray(ports?.outputs) ? ports.outputs.map((port, index) => normalizePort(port, 'output', index, 'image')) : [],
  }
}

export function buildPortsForNode(nodeType: string, mediaType: WorkflowMediaType, data?: Record<string, any>) {
  const normalizedNodeType = normalizeString(nodeType)
  const directPorts = data?.ports
  if (directPorts && (Array.isArray(directPorts.inputs) || Array.isArray(directPorts.outputs))) {
    return clonePorts(directPorts)
  }

  const legacyInputs = Array.isArray(data?.inputs) ? data.inputs : []
  const legacyOutputs = Array.isArray(data?.outputs) ? data.outputs : []
  if (legacyInputs.length || legacyOutputs.length) {
    return buildPortsFromLegacy(legacyInputs, legacyOutputs, mediaType)
  }

  const defaults = clonePorts(
    DEFAULT_PORTS_BY_NODE_TYPE[normalizedNodeType]
    || DEFAULT_PORTS_BY_NODE_TYPE[getNodeKindByType(normalizedNodeType)]
    || { inputs: [], outputs: [] },
  )
  if (
    isFileInputNodeType(normalizedNodeType)
    || normalizedNodeType === 'aigc_result'
    || normalizedNodeType.endsWith('_generation')
  ) {
    defaults.inputs = defaults.inputs.map((port) => ({
      ...port,
      id: mediaType,
      label: mediaType,
      mediaType,
    }))
    defaults.outputs = defaults.outputs.map((port) => ({
      ...port,
      id: mediaType,
      label: mediaType,
      mediaType,
    }))
  }
  return defaults
}

export function getNodeRecordId(data: Record<string, any> | undefined): string {
  return normalizeString(data?.recordId)
}

export function getNodeUrl(data: Record<string, any> | undefined): string {
  const raw = data?.url || data?.preview || data?.imageUrl || data?.videoUrl || data?.audioUrl || ''
  return typeof raw === 'string' ? raw.trim() : ''
}

export function normalizeWorkflowRequest(value: any): WorkflowRequest | null {
  if (!isPlainObject(value)) return null
  const params = sanitizeWorkflowRequestParams(value.params)
  const capability = normalizeString(value.capability)
  const mode = normalizeString(value.mode) || 'standard'
  if (!capability) return null
  return { capability, mode, params }
}

export function buildWorkflowRequestFromNodeData(data: Record<string, any> | undefined): WorkflowRequest | null {
  return normalizeWorkflowRequest(data?.request)
}

export function buildGenerationStateFromRequest(request: WorkflowRequest | null, currentState?: Record<string, any>) {
  if (!request) return undefined
  return {
    ...cloneObject(currentState || {}),
    capability: request.capability,
    mode: request.mode,
    modelId: request.params?.model || currentState?.modelId || '',
    prompt: typeof request.params?.prompt === 'string' ? request.params.prompt : (currentState?.prompt || ''),
    params: cloneObject(request.params || {}),
  }
}

export function buildPersistedWorkflowNodeData(node: { type?: string; data?: Record<string, any> }) {
  const runtime = node?.data || {}
  const nodeType = node?.type || ''
  if (nodeType === 'subgraph') {
    return {
      label: runtime.label || '子图',
      subgraphId: normalizeString(runtime.subgraphId),
      nodeCount: Number(runtime.nodeCount || 0) || 0,
    }
  }
  if (nodeType === 'groupNode') {
    const data: Record<string, any> = {
      label: runtime.label || '新分组',
      // 自由模式已废弃，所有分组恒为 grid 模式
      layoutMode: 'grid',
    }
    if (runtime.locked) data.locked = true
    if (runtime.collapsed) data.collapsed = true
    if (runtime.bgColor) data.bgColor = runtime.bgColor
    if (isPlainObject(runtime.gridSplit)) {
      data.gridSplit = cloneObject(runtime.gridSplit)
    }
    if (Array.isArray(runtime.gridOrder)) {
      data.gridOrder = runtime.gridOrder.filter(
        (item: any): item is string =>
          (typeof item === 'string' && !!item.trim()) || item === '',
      )
    }
    return data
  }
  if (nodeType === 'annotation_note') {
    return {
      label: runtime.label || '文字标注',
      content: typeof runtime.content === 'string' ? runtime.content : '',
      ...(runtime.bgColor ? { bgColor: runtime.bgColor } : {}),
      ...(runtime.textColor ? { textColor: runtime.textColor } : {}),
      ...(runtime.fontSize ? { fontSize: runtime.fontSize } : {}),
      ...(runtime.fontWeight ? { fontWeight: runtime.fontWeight } : {}),
      ...(runtime.fontStyle ? { fontStyle: runtime.fontStyle } : {}),
      ...(runtime.textDecoration ? { textDecoration: runtime.textDecoration } : {}),
      ...(runtime.textAlign ? { textAlign: runtime.textAlign } : {}),
      ...(runtime.fitToText === false ? { fitToText: false } : {}),
      disableInputPorts: true,
      disableOutputPorts: true,
    }
  }

  if (nodeType === 'director_3d') {
    const data: Record<string, any> = {
      label: runtime.label || '3D导演台',
      nodeType: 'director_3d',
    }
    if (runtime.directorProject) {
      data.directorProject = JSON.parse(JSON.stringify(runtime.directorProject))
    }
    if (runtime.thumbnail) data.thumbnail = runtime.thumbnail
    data.ports = buildPortsForNode(nodeType, 'text', runtime)
    return data
  }
  if (nodeType === 'batch_grid') {
    const data: Record<string, any> = {
      label: runtime.label || '批量节点',
      mediaType: normalizeString(runtime.mediaType) || 'image',
      layout: runtime.layout || { rows: 2, cols: 2, gap: 4 },
      items: normalizeBatchGridItems(Array.isArray(runtime.items) ? runtime.items : []),
    }
    const sourceDisplaySize = normalizeDisplaySize(runtime.sourceDisplaySize)
    if (sourceDisplaySize) data.sourceDisplaySize = sourceDisplaySize
    const sourceAspectRatio = readPositiveNumber(runtime.sourceAspectRatio)
    if (sourceAspectRatio) data.sourceAspectRatio = sourceAspectRatio
    if (runtime.seamlessSplit === true) data.seamlessSplit = true
    return data
  }
  if (nodeType === 'texture_material') {
    const data: Record<string, any> = {
      label: runtime.label || '3D贴图材质',
      mediaType: normalizeString(runtime.mediaType) || 'image',
      layout: runtime.layout || { rows: 2, cols: 4, gap: 4 },
      channels: Array.isArray(runtime.channels) ? runtime.channels.filter((item: any) => typeof item === 'string' && !!item.trim()) : [],
      items: normalizeTextureMaterialItems(Array.isArray(runtime.items) ? runtime.items : []),
    }
    return data
  }
  const nodeKind = resolveNodeKind(nodeType, runtime)
  const data: Record<string, any> = {
    label: runtime.label || undefined,
  }
  const referenceName = normalizeString(runtime.referenceName)
  if (referenceName) data.referenceName = referenceName
  const sourceFileName = normalizeString(runtime.sourceFileName)
  if (sourceFileName) data.sourceFileName = sourceFileName
  const modelDisplayName = normalizeString(runtime.modelDisplayName)
  if (modelDisplayName) data.modelDisplayName = modelDisplayName
  const pbrChannel = normalizeString(runtime.pbrChannel)
  if (pbrChannel) data.pbrChannel = pbrChannel

  if (nodeKind === 'generate') {
    const request = normalizeWorkflowRequest(runtime.request)
    if (request) data.request = request
    const ports = buildPortsForNode(nodeType, 'image', runtime)
    data.ports = ports
    if (runtime.disableInputPorts) data.disableInputPorts = true
    if (runtime.disableOutputPorts) data.disableOutputPorts = true
    return data
  }

  const url = getNodeUrl(runtime)
  const mediaType = inferMediaType(runtime.mediaType, nodeType, url)
  const persistedRecordId = normalizeString(runtime.recordId)
  data.mediaType = mediaType
  const request = buildWorkflowRequestFromNodeData(runtime)
  if (request) data.request = request
  const referenceOrder = Array.isArray(runtime.referenceOrder)
    ? runtime.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim())
    : (Array.isArray(runtime._genState?.referenceOrder)
        ? runtime._genState.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim())
        : [])
  if (referenceOrder.length) {
    data.referenceOrder = [...referenceOrder]
  }
  if (url) data.url = url
  if (normalizeString(runtime.thumb || runtime.thumbnail_url)) data.thumb = normalizeString(runtime.thumb || runtime.thumbnail_url)
  if (typeof runtime.is_favorites === 'boolean') data.is_favorites = runtime.is_favorites
  if (runtime.content) data.content = runtime.content
  if (runtime.bgColor) data.bgColor = runtime.bgColor
  if (runtime.locked) data.locked = true
  if (runtime.collapsed) data.collapsed = true
  if (Array.isArray(runtime.markers)) data.markers = cloneObject(runtime.markers)
  if (persistedRecordId && GENERATION_CARD_NODE_TYPES.has(nodeType)) data.recordId = persistedRecordId

  if (nodeKind === 'aigc_result') {
    const recordId = getNodeRecordId(runtime)
    if (recordId) {
      data.recordId = recordId
      delete data.request
    }
  }

  return data
}

export function buildRuntimeWorkflowNodeData(
  rawData: Record<string, any> | undefined,
  nodeType: string,
  typeDef: Record<string, any> = {}
) {
  const data = rawData || {}
  if (nodeType === 'subgraph') {
    return {
      label: data.label || typeDef.label || '子图',
      subgraphId: normalizeString(data.subgraphId),
      nodeCount: Number(data.nodeCount || 0) || 0,
      inputs: [],
      outputs: [],
      ports: { inputs: [], outputs: [] },
      paramDefs: [],
      disableInputPorts: true,
      disableOutputPorts: true,
    }
  }
  if (nodeType === 'groupNode') {
    const runtime: Record<string, any> = {
      label: data.label || typeDef.label || '新分组',
      // 自由模式已废弃，恒为 grid
      layoutMode: 'grid',
    }
    if (data.locked) runtime.locked = true
    if (data.collapsed) runtime.collapsed = true
    if (data.bgColor) runtime.bgColor = data.bgColor
    if (isPlainObject(data.gridSplit)) {
      runtime.gridSplit = cloneObject(data.gridSplit)
    }
    if (Array.isArray(data.gridOrder)) {
      runtime.gridOrder = data.gridOrder.filter(
        (item: any): item is string =>
          (typeof item === 'string' && !!item.trim()) || item === '',
      )
    }
    return runtime
  }
  if (nodeType === 'annotation_note') {
    return {
      label: data.label || typeDef.label || '文字标注',
      content: typeof data.content === 'string' ? data.content : '',
      ...(data.bgColor ? { bgColor: data.bgColor } : {}),
      ...(data.textColor ? { textColor: data.textColor } : {}),
      ...(data.fontSize ? { fontSize: data.fontSize } : {}),
      ...(data.fontWeight ? { fontWeight: data.fontWeight } : {}),
      ...(data.fontStyle ? { fontStyle: data.fontStyle } : {}),
      ...(data.textDecoration ? { textDecoration: data.textDecoration } : {}),
      ...(data.textAlign ? { textAlign: data.textAlign } : {}),
      ...(data.fitToText === false ? { fitToText: false } : {}),
      inputs: [],
      outputs: [],
      ports: { inputs: [], outputs: [] },
      paramDefs: [],
      nodeKind: 'annotation',
      mediaType: 'text',
      disableInputPorts: true,
      disableOutputPorts: true,
    }
  }

  if (nodeType === 'director_3d') {
    const ports = buildPortsForNode('director_3d', 'text', data)
    return {
      label: data.label || typeDef.label || '3D导演台',
      inputs: typeDef.inputs || [],
      outputs: typeDef.outputs || [],
      ports,
      paramDefs: [],
      nodeKind: 'director_3d',
      mediaType: 'text',
      directorProject: data.directorProject || null,
      thumbnail: data.thumbnail || null,
      disableInputPorts: !!data.disableInputPorts,
      disableOutputPorts: !!data.disableOutputPorts,
    }
  }
  if (nodeType === 'batch_grid') {
    const runtimeData: Record<string, any> = {
      label: data.label || typeDef.label || '批量节点',
      mediaType: 'image',
      layout: data.layout || { rows: 2, cols: 2, gap: 4 },
      items: normalizeBatchGridItems(Array.isArray(data.items) ? data.items : []),
    }
    const sourceDisplaySize = normalizeDisplaySize(data.sourceDisplaySize)
    if (sourceDisplaySize) runtimeData.sourceDisplaySize = sourceDisplaySize
    const sourceAspectRatio = readPositiveNumber(data.sourceAspectRatio)
    if (sourceAspectRatio) runtimeData.sourceAspectRatio = sourceAspectRatio
    if (data.seamlessSplit === true) runtimeData.seamlessSplit = true
    return runtimeData
  }
  if (nodeType === 'texture_material') {
    return {
      label: data.label || typeDef.label || '3D贴图材质',
      mediaType: 'image',
      layout: data.layout || { rows: 2, cols: 4, gap: 4 },
      channels: Array.isArray(data.channels) ? data.channels.filter((item: any) => typeof item === 'string' && !!item.trim()) : [],
      items: normalizeTextureMaterialItems(Array.isArray(data.items) ? data.items : []),
    }
  }
  const nodeKind = resolveNodeKind(nodeType, data)
  const initialMediaType = inferMediaType(data.mediaType, nodeType, getNodeUrl(data))
  const ports = buildPortsForNode(nodeKind === 'aigc_result' ? 'aigc_result' : nodeType, initialMediaType, data)
  const runtime: Record<string, any> = {
    label: data.label || typeDef.label || nodeType,
    inputs: typeDef.inputs || [],
    outputs: typeDef.outputs || [],
    ports,
    paramDefs: typeDef.params || [],
    nodeKind,
    disableInputPorts: !!data.disableInputPorts,
    disableOutputPorts: !!data.disableOutputPorts,
  }
  const referenceName = normalizeString(data.referenceName)
  if (referenceName) runtime.referenceName = referenceName
  const sourceFileName = normalizeString(data.sourceFileName)
  if (sourceFileName) runtime.sourceFileName = sourceFileName
  const modelDisplayName = normalizeString(data.modelDisplayName)
  if (modelDisplayName) runtime.modelDisplayName = modelDisplayName
  const pbrChannel = normalizeString(data.pbrChannel)
  if (pbrChannel) runtime.pbrChannel = pbrChannel

  const defaultCapability = normalizeString(data.defaultCapability) || DEFAULT_CAPABILITY_BY_NODE_TYPE[nodeType] || ''
  if (defaultCapability) {
    runtime.defaultCapability = defaultCapability
  }

  const request = normalizeWorkflowRequest(data.request)
  if (request && nodeKind !== 'aigc_result') {
    runtime.request = request
    runtime._genState = buildGenerationStateFromRequest(request, {
      ...(isPlainObject(data._genState) ? data._genState : {}),
      ...(Array.isArray(data.referenceOrder)
        ? { referenceOrder: data.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim()) }
        : {}),
    })
  }

  if (nodeKind === 'generate') {
    if (request) {
      runtime.request = request
      runtime._genState = buildGenerationStateFromRequest(request, {
        ...(isPlainObject(data._genState) ? data._genState : {}),
        ...(Array.isArray(data.referenceOrder)
          ? { referenceOrder: data.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim()) }
          : {}),
      })
    }
    return runtime
  }

  const url = getNodeUrl(data)
  const mediaType = inferMediaType(data.mediaType, nodeType, url)
  runtime.mediaType = mediaType
  const recordId = getNodeRecordId(data)
  if (url) {
    runtime.url = url
    if (mediaType !== 'text') runtime.preview = url
    if (mediaType === 'image' || mediaType === '3d_model') runtime.imageUrl = url
    if (mediaType === 'video') runtime.videoUrl = url
    if (mediaType === 'audio') runtime.audioUrl = url
  }
  if (normalizeString(data.thumb || data.thumbnail_url)) {
    runtime.thumb = normalizeString(data.thumb || data.thumbnail_url)
    runtime.thumbnail_url = runtime.thumb
  }
  if (typeof data.is_favorites === 'boolean') {
    runtime.is_favorites = data.is_favorites
  }

  if (nodeKind === 'aigc_result') {
    if (recordId) {
      runtime.recordId = recordId
    }
  }

  if (recordId && GENERATION_CARD_NODE_TYPES.has(nodeType)) {
    runtime.recordId = recordId
  }

  if (Array.isArray(data.referenceOrder)) {
    runtime.referenceOrder = data.referenceOrder.filter((item: any): item is string => typeof item === 'string' && !!item.trim())
  }
  if (data.content) runtime.content = data.content
  if (data.bgColor) runtime.bgColor = data.bgColor
  if (data.locked) runtime.locked = true
  if (data.collapsed) runtime.collapsed = true
  if (Array.isArray(data.markers)) runtime.markers = cloneObject(data.markers)
  return runtime
}

export function buildRuntimeAssetNodeData(options: {
  label: string
  nodeType: string
  url: string
  thumb?: string
  recordId?: string | number
  request?: WorkflowRequest | null
  modelDisplayName?: string
  content?: string
  bgColor?: string
  mediaType?: WorkflowMediaType
}) {
  return buildRuntimeWorkflowNodeData(
    {
      label: options.label,
      mediaType: options.mediaType || inferMediaType(undefined, options.nodeType, options.url),
      url: options.url,
      ...(normalizeString(options.thumb) ? {
        thumb: normalizeString(options.thumb),
        thumbnail_url: normalizeString(options.thumb),
      } : {}),
      ...(options.recordId !== undefined && options.recordId !== null && normalizeString(options.recordId)
        ? { recordId: normalizeString(options.recordId) }
        : {}),
      ...(options.request ? { request: options.request } : {}),
      ...(normalizeString(options.modelDisplayName) ? { modelDisplayName: normalizeString(options.modelDisplayName) } : {}),
      ...(options.content ? { content: options.content } : {}),
      ...(options.bgColor ? { bgColor: options.bgColor } : {}),
    },
    options.recordId !== undefined && options.recordId !== null && normalizeString(options.recordId)
      ? 'aigc_result'
      : options.nodeType
  )
}

export function buildBaseNodeRuntimeData(options: {
  nodeType: string
  label: string
  paramDefs?: any[]
  mediaType?: WorkflowMediaType
  disableInputPorts?: boolean
  disableOutputPorts?: boolean
}) {
  const mediaType = options.mediaType || inferMediaType(undefined, options.nodeType)
  return {
    label: options.label,
    inputs: [],
    outputs: [],
    ports: buildPortsForNode(options.nodeType, mediaType),
    paramDefs: options.paramDefs || [],
    disableInputPorts: !!options.disableInputPorts,
    disableOutputPorts: !!options.disableOutputPorts,
  }
}
