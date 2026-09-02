<template>
  <el-popover
    ref="popoverRef"
    :placement="popoverPlacement"
    trigger="click"
    :width="popoverWidth"
    popper-class="model-select-popover"
    :show-arrow="false"
    :fallback-placements="['top-start', 'top-end', 'bottom-start', 'bottom-end']"
    @show="onShow"
    @hide="onHide"
  >
    <template #reference>
      <div class="popover-trigger" @click="rememberTriggerEvent">
        <slot />
      </div>
    </template>

    <div class="panel-content" :style="{ maxHeight: panelMaxHeight + 'px' }">
      <!-- 顶部工具栏：搜索框 + 能力筛选 Tabs -->
      <div class="panel-header">
        <div class="search-box">
          <Search :size="14" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索模型..."
            class="search-input"
          />
        </div>
        <CapabilityBar
          :model-value="selectedCapability"
          theme="light"
          :show-all="true"
          :counts="capCounts"
          :allowed-ids="allowedCapabilityIds"
          @change="selectCapability"
        />
      </div>

      <!-- 发布者过滤 -->
      <div class="vendor-tabs">
        <button
          class="vendor-tab"
          :class="{ active: activeVendor === 'all' }"
          @click="activeVendor = 'all'"
        >
          全部
        </button>
        <button
          v-for="prov in allVendors"
          :key="prov.name"
          class="vendor-tab"
          :class="{ active: activeVendor === prov.name }"
          @click="activeVendor = prov.name"
        >
          <img :src="prov.icon" class="prov-icon" alt="" @error="onIconError" />
          <span>{{ prov.displayName }}</span>
          <span class="prov-count">{{ prov.count }}</span>
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="panel-loading">
        加载中...
      </div>

      <!-- 模型列表 -->
      <div v-else class="model-list" :style="{ maxHeight: listMaxHeight + 'px' }">
        <div v-if="groupedModels.length === 0" class="empty-state">
          没有找到匹配的模型
        </div>

        <div
          v-for="group in groupedModels"
          :key="group.vendor"
          class="vendor-section"
        >
          <div class="section-header">
            <img :src="group.icon" class="section-icon" alt="" @error="onIconError" />
            <span class="section-name">{{ group.displayName }}</span>
            <span class="section-count">{{ group.models.length }}</span>
          </div>

          <div class="model-grid">
            <div
              v-for="model in group.models"
              :key="model.id || model.name || ''"
              class="model-card"
              :class="{ selected: tempSelectedModelId === (model.id || model.name) }"
              :title="model.display_name || model.name || undefined"
              @click="selectModel(model)"
            >
              <div class="card-header">
                <img :src="getCardIcon(model)" class="card-icon" alt="" @error="onCardIconError" />
                <span class="model-display-name" :title="model.display_name || model.name || undefined">
                  {{ model.display_name || model.name }}
                </span>
                <Check v-if="tempSelectedModelId === (model.id || model.name)" :size="12" class="check-icon" />
              </div>
              <div class="card-footer" v-if="getModelBadgeItems(model).length">
                <span
                  v-for="badge in getModelBadgeItems(model)"
                  :key="badge.key"
                  :class="[
                    badge.kind === 'mode' ? 'mode-tag clickable' : 'cap-tag',
                    badge.kind === 'capability' ? getCapClass(badge.cap || '') : '',
                  ]"
                  @click.stop="badge.kind === 'mode' ? selectModelWithMode(model, badge.key.replace('mode:', '')) : undefined"
                >
                  {{ badge.label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Search, Check } from '@/components/common/icon/lucide'
import CapabilityBar from '@/components/common/CapabilityBar.vue'
import {
  getAllModels,
  getCapabilitiesByType,
  getModelModes,
  type BackendModelInfo,
  type CapabilityInfo,
  type ModelModeInfo,
  type ModelParamSchema
} from '@/api/models'
import {
  buildModelBadgeItems,
  resolveModelSelectPopoverLayout,
} from './modelSelectPanelLayout'
import {
  isVirtualModel,
  getVirtualModelParams,
  VIRTUAL_TOPAZ_MODELS,
} from '@/services/generation/topaz.constants'

const props = defineProps<{
  modelId?: string
  capability?: string
  lockedCapability?: string
}>()

const emit = defineEmits<{
  select: [data: {
    model: BackendModelInfo
    capability?: string
    mode?: string
    modes?: ModelModeInfo[]
    params?: ModelParamSchema[]
  }]
  'capability-change': [capId: string]
}>()

const popoverRef = ref()
const loading = ref(false)
const models = ref<BackendModelInfo[]>([])
const capabilities = ref<CapabilityInfo[]>([])
const searchQuery = ref('')
const selectedCapability = ref(props.lockedCapability || props.capability || 'all')
const activeVendor = ref('all')
const popoverPlacement = ref<'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'>('top-start')
const popoverWidth = ref(720)
const panelMaxHeight = ref(680)
const listMaxHeight = ref(520)
const triggerRect = ref<DOMRect | null>(null)
const lastClickPoint = ref<{ x: number; y: number } | null>(null)

// 临时选中状态（确认前）
const tempSelectedModelId = ref('')
const tempSelectedModel = ref<BackendModelInfo | null>(null)

const vendorIcons: Record<string, string> = {
  'volcengine': '/icons/vendors/volcengine.png',
  'VolcEngine': '/icons/vendors/volcengine.png',
  'zhipu': '/icons/vendors/zhipu.png',
  'Zhipu': '/icons/vendors/zhipu.png',
  'shenman': '/icons/vendors/shenman.png',
  'Shenman': '/icons/vendors/shenman.png',
  'google': '/icons/vendors/google.png',
  'Google': '/icons/vendors/google.png',
  'openai': '/icons/vendors/openai.png',
  'OpenAI': '/icons/vendors/openai.png',
  'anthropic': '/icons/vendors/anthropic.png',
  'Anthropic': '/icons/vendors/anthropic.png',
  'bailian': '/icons/vendors/bailian.png',
  'Bailian': '/icons/vendors/bailian.png',
  'dashscope': '/icons/vendors/dashscope.png',
  'DashScope': '/icons/vendors/dashscope.png',
}

function getVendorIcon(vendors: string[] | null): string {
  if (!vendors || vendors.length === 0) return '/icons/vendors/default.svg'
  const vendor = vendors[0]
  return vendorIcons[vendor] || `/icons/vendors/${vendor.toLowerCase().replace(/\s+/g, '-')}.png`
}

// 发布者图标映射（与设置界面保持一致）
const PUBLISHER_ICON_MAP: Record<string, string> = {
  bytedance: 'bytedance.png', volcengine: 'bytedance.png',
  google: 'google.png', gemini: 'google.png',
  smwh: 'smwh.png', comfyui: 'smwh.png', 'comfyui-local': 'smwh.png',
  zhipu: 'zhipu.png', bigmodel: 'zhipu.png', 'bigmodel-plan': 'zhipu.png',
  anthropic: 'anthropic.png',
  openai: 'openai.png',
  minimax: 'minimax.svg',
}

// 获取模型卡片图标（优先使用 publisher 图标）
function getCardIcon(model: BackendModelInfo): string {
  const publisher = model.publisher
  if (publisher) {
    const pubId = typeof publisher === 'string' ? publisher : publisher.id || publisher.name || ''
    const lower = pubId.toLowerCase()
    for (const [key, icon] of Object.entries(PUBLISHER_ICON_MAP)) {
      if (lower.includes(key)) return `/icons/publishers/${icon}`
    }
  }
  // 回退到 vendors 图标
  return getVendorIcon(model.vendors)
}

function onIconError(e: Event) {
  const target = e.target as HTMLImageElement
  // 防止重复触发导致闪烁
  if (target.dataset.error === 'true') return
  target.dataset.error = 'true'
  target.src = '/icons/vendors/default.svg'
}

// 模型卡片图标加载失败处理
function onCardIconError(e: Event) {
  const target = e.target as HTMLImageElement
  if (target.dataset.error === 'true') return
  target.dataset.error = 'true'
  target.src = '/icons/publishers/default.png'
}

// 获取模型的发布者 ID
function getPublisherId(model: BackendModelInfo): string {
  const publisher = model.publisher
  if (!publisher) return 'unknown'
  return typeof publisher === 'string' ? publisher : (publisher as any).id || (publisher as any).name || 'unknown'
}

// 获取模型的发布者显示名称
function getPublisherDisplayName(model: BackendModelInfo): string {
  const publisher = model.publisher
  if (!publisher) return '未知'
  if (typeof publisher === 'string') return publisher
  // 优先使用 API 返回的 label，其次 name
  return (publisher as any).label || (publisher as any).name || '未知'
}

// 兼容字符串和对象两种能力格式（参考 shenshu）
// API 返回的能力对象可能用 name 作为标识（如 {name:"image_generation", label:"图片生成"}）
function capMatches(cap: any, target: string): boolean {
  if (typeof cap === 'string') return cap === target
  return cap?.id === target || cap?.name === target
}

function modelHasCapability(m: BackendModelInfo, capId: string): boolean {
  if (!m.capabilities) return false
  return m.capabilities.some((c: any) => capMatches(c, capId))
}

// 按能力过滤后的模型（用于计算 publisher 列表）
const capFilteredModels = computed(() => {
  if (selectedCapability.value === 'all') return models.value
  return models.value.filter(m => modelHasCapability(m, selectedCapability.value))
})

// 按发布者统计模型数量（基于当前能力过滤）
const allVendors = computed(() => {
  const pubMap: Record<string, { name: string; displayName: string; icon: string; count: number }> = {}

  capFilteredModels.value.forEach(m => {
    const pubId = getPublisherId(m)
    if (!pubMap[pubId]) {
      pubMap[pubId] = {
        name: pubId,
        displayName: getPublisherDisplayName(m),
        icon: getCardIcon(m),
        count: 0
      }
    }
    pubMap[pubId].count++
  })

  return Object.values(pubMap).sort((a, b) => b.count - a.count)
})

// 每个能力的模型数量（兼容字符串和对象格式）
// key 必须和 CapabilityBar 的 tab.id 一致（即 /api/capabilities 返回的 id）
const capCounts = computed(() => {
  const counts: Record<string, number> = {}
  models.value.forEach(m => {
    (m.capabilities || []).forEach((cap: any) => {
      // API 返回的能力对象用 {name, label} 格式（如 {name:"image_generation", label:"图片生成"}）
      // CapabilityBar 的 tab.id 来自 /api/capabilities 的 id 字段，值如 "image_generation"
      // 所以这里必须取 name（模型能力的标识符），而非 id（可能不存在）
      const key = typeof cap === 'string' ? cap : (cap?.name || cap?.id)
      if (key) counts[key] = (counts[key] || 0) + 1
    })
  })
  return counts
})

const allowedCapabilityIds = computed(() => props.lockedCapability ? [props.lockedCapability] : [])

// 过滤模型
const filteredModels = computed(() => {
  let result = models.value

  if (activeVendor.value !== 'all') {
    result = result.filter(m => getPublisherId(m) === activeVendor.value)
  }

  // 按能力筛选
  if (selectedCapability.value !== 'all') {
    result = result.filter(m => modelHasCapability(m, selectedCapability.value))
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(m => {
      const id = (m.id || m.name || '').toLowerCase()
      const displayName = (m.display_name || '').toLowerCase()
      return id.includes(query) || displayName.includes(query)
    })
  }

  return result
})

// 按发布者分组
const groupedModels = computed(() => {
  const groups: Record<string, {
    vendor: string
    displayName: string
    icon: string
    models: BackendModelInfo[]
  }> = {}

  filteredModels.value.forEach(m => {
    const pubId = getPublisherId(m)
    const displayName = getPublisherDisplayName(m)
    if (!groups[pubId]) {
      groups[pubId] = {
        vendor: pubId,
        displayName: displayName,
        icon: getCardIcon(m),
        models: []
      }
    }
    groups[pubId].models.push(m)
  })

  return Object.values(groups).sort((a, b) => b.models.length - a.models.length)
})

function getCapClass(cap: string) {
  const classes: Record<string, string> = {
    image_generation: 'cap-image',
    video_generation: 'cap-video',
    model_generation: 'cap-model',
    audio_generation: 'cap-audio',
    chat: 'cap-chat',
  }
  return classes[cap] || 'cap-default'
}

// 能力标签本地映射（作为后备方案）
const capLabelMap: Record<string, string> = {
  image_generation: '图片生成',
  video_generation: '视频生成',
  model_generation: '模型生成',
  audio_generation: '音频生成',
  chat: '对话',
}

function getCapLabel(cap: string) {
  // 先查 API 返回的 capabilities 列表
  const found = capabilities.value.find(c => c.id === cap)
  if (found?.name) return found.name
  // 后备：使用本地映射
  return capLabelMap[cap] || cap
}

function getModelBadgeItems(model: BackendModelInfo) {
  return buildModelBadgeItems(model, getCapLabel)
}

function rememberTriggerEvent(event: MouseEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null
  triggerRect.value = currentTarget?.getBoundingClientRect() || null
  lastClickPoint.value = { x: event.clientX, y: event.clientY }
}

function updatePopoverLayout() {
  if (typeof window === 'undefined') {
    return
  }

  const layout = resolveModelSelectPopoverLayout({
    triggerRect: triggerRect.value || undefined,
    clickPoint: lastClickPoint.value || undefined,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      padding: 16,
    },
    preferredWidth: 640,
  })

  popoverPlacement.value = layout.placement as typeof popoverPlacement.value
  popoverWidth.value = layout.width
  panelMaxHeight.value = layout.maxPanelHeight
  listMaxHeight.value = layout.maxListHeight
}

async function loadData() {
  loading.value = true
  try {
    // 1. 先加载能力列表
    const capRes = await getCapabilitiesByType('generations')
    capabilities.value = capRes.capabilities || []

    // 2. 根据能力加载模型
    await loadModels()
  } catch (e) {
    console.error('Failed to load data:', e)
    capabilities.value = []
    models.value = []
  } finally {
    loading.value = false
  }
}

async function loadModels() {
  try {
    const modelsRes = await getAllModels('generations')
    const apiModels: BackendModelInfo[] = modelsRes.models || []
    const apiIds = new Set(
      apiModels.map(m => (m.id || m.name || '').toLowerCase()),
    )
    const missing = VIRTUAL_TOPAZ_MODELS.filter(
      m => !apiIds.has((m.id || '').toLowerCase()),
    )
    models.value = [...apiModels, ...missing]
  } catch (e) {
    console.error('Failed to load models:', e)
    models.value = [...VIRTUAL_TOPAZ_MODELS]
  }
}

async function onShow() {
  updatePopoverLayout()
  await nextTick()
  loadData()
  // 重置临时状态
  tempSelectedModelId.value = props.modelId || ''
  tempSelectedModel.value = null
}

function onHide() {
  searchQuery.value = ''
}

// 切换能力 Tab
function selectCapability(capId: string) {
  if (props.lockedCapability && capId !== props.lockedCapability) return
  selectedCapability.value = capId
  activeVendor.value = 'all'
  // 重置模型选择
  tempSelectedModelId.value = ''
  tempSelectedModel.value = null
  emit('capability-change', capId)
}

// 选择模型
async function selectModel(model: BackendModelInfo) {
  const modelId = model.id || model.name || ''
  tempSelectedModelId.value = modelId
  tempSelectedModel.value = model
  // 直接使用模型自带 modes，无需再调 API
  let modes: any[] = model.modes || []
  const capability = selectedCapability.value === 'all' ? undefined : selectedCapability.value

  // 仅在模型未自带 modes 时才调 API 补充（虚拟模型跳过）
  if (!model.modes?.length && !isVirtualModel(modelId)) {
    try {
      const modesRes = await getModelModes(modelId, capability)
      modes = modesRes.modes || []
    } catch (e) {
      console.error('Failed to load model modes:', e)
    }
  }

  emit('select', {
    model,
    capability,
    modes,
    params: isVirtualModel(modelId) ? getVirtualModelParams(modelId) : []
  })
  popoverRef.value?.hide()
}

// 选择模型并指定模式（点击卡片上的模式标签）
async function selectModelWithMode(model: BackendModelInfo, modeId: string) {
  const modelId = model.id || model.name || ''
  tempSelectedModelId.value = modelId
  tempSelectedModel.value = model
  let modes: any[] = model.modes || []
  const capability = selectedCapability.value === 'all' ? undefined : selectedCapability.value

  if (!model.modes?.length && !isVirtualModel(modelId)) {
    try {
      const modesRes = await getModelModes(modelId, capability)
      modes = modesRes.modes || []
    } catch (e) {
      console.error('Failed to load model modes:', e)
    }
  }

  emit('select', {
    model,
    capability,
    mode: modeId,
    modes,
    params: isVirtualModel(modelId) ? getVirtualModelParams(modelId) : []
  })
  popoverRef.value?.hide()
}

watch(() => props.modelId, (id) => {
  if (id) tempSelectedModelId.value = id
})

watch(() => props.capability, (cap) => {
  if (props.lockedCapability) return
  if (cap && cap !== selectedCapability.value) {
    selectedCapability.value = cap
    activeVendor.value = 'all'
  }
})

watch(() => props.lockedCapability, (cap) => {
  if (cap && cap !== selectedCapability.value) {
    selectedCapability.value = cap
    activeVendor.value = 'all'
  }
})
</script>

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-radius: 12px;
  overflow: hidden;
  margin: 12px;
}

.popover-trigger {
  display: inline-flex;
  max-width: 100%;
}

/* 顶部工具栏 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  flex: 1;
  min-width: 0;
  max-width: 160px;
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
}


.vendor-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}

.vendor-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.vendor-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.vendor-tab.active {
  background: var(--accent);
  color: #fff;
}

.prov-icon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: contain;
}

.prov-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 1px 5px;
  border-radius: 8px;
}

.vendor-tab.active .prov-count {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 可点击的模式标签 */
.mode-tag.clickable {
  cursor: pointer;
  transition: all 0.15s;
}

.mode-tag.clickable:hover {
  background: var(--accent);
  color: #fff;
}

.panel-loading {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.model-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  color: var(--text-muted);
  font-size: 13px;
}

.vendor-section {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.section-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  object-fit: contain;
}

.section-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 10px;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 10px;
}

.model-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.model-card:hover {
  border-color: var(--accent);
}

.model-card.selected {
  border-color: var(--accent);
  background: var(--accent-dim);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.card-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  flex-shrink: 0;
}

.model-display-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.check-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.mode-tag,
.cap-tag {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.mode-tag {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.model-card:hover .mode-tag {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.12);
}

.model-card.selected .mode-tag {
  background: rgba(96, 165, 250, 0.10);
  border-color: rgba(96, 165, 250, 0.20);
  color: #93c5fd;
}

.cap-tag {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
}

.cap-tag.cap-image {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.cap-tag.cap-video {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}

.cap-tag.cap-chat {
  background: rgba(236, 72, 153, 0.15);
  color: #ec4899;
}

.cap-tag.cap-model {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.cap-tag.cap-audio {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.cap-tag.cap-default {
  background: var(--bg-surface);
  color: var(--text-muted);
}

/* 底部确认按钮 */
.panel-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

</style>

<style>
.model-select-popover {
  background: #1a1a1c !important;
  border: 1px solid #2a2a2e !important;
  border-radius: 12px !important;
  padding: 0 !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6) !important;
}
</style>
