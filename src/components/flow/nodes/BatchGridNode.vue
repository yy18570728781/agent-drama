<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import NodePortsOverlay from '@/components/flow/NodePortsOverlay.vue'
import { ArrowUpRight, Grid3x3, Info, Play, RefreshCw } from '@/components/common/icon/lucide'
import { useBatchGridSlotRegenerate } from '@/composables/flow/useBatchGridSlotRegenerate'
import { useTextureMaterialPBRBridge } from '@/composables/flow/useTextureMaterialPBRBridge'
import { useTextureMaterialSlotRegenerate } from '@/composables/flow/useTextureMaterialSlotRegenerate'
import { isBatchGridGenerationItemType } from '@/utils/batchGridItems'
import type { PBRChannel } from '@/types/pbr.types'
import { useBatchGridProjectedItems } from './useBatchGridProjectedItems'
import BatchGridDetailDialog from './BatchGridDetailDialog.vue'
import BatchGridPreviewDialog from './BatchGridPreviewDialog.vue'

const props = withDefaults(defineProps<{
  id: string
  type?: string
  data?: Record<string, any>
  selected?: boolean
}>(), {
  type: '',
  data: () => ({}),
  selected: false,
})

const flowScatterBatchNode = inject<(nodeId: string) => void>('flowScatterBatchNode', () => {})
const flowOpenDetail = inject<((data: any) => void) | null>('flowOpenDetail', null)
const flowRenderableMediaNodeIds = inject('flowRenderableMediaNodeIds', ref(new Set<string>()))
const flowThumbRenderableMediaNodeIds = inject('flowThumbRenderableMediaNodeIds', ref(new Set<string>()))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const { openTextureMaterialInPBR } = useTextureMaterialPBRBridge()
const { canRegenerateBatchGridSlot, regenerateBatchGridSlot } = useBatchGridSlotRegenerate()
const { canRegenerateTextureSlot, regenerateTextureSlot } = useTextureMaterialSlotRegenerate()

const layout = computed(() => props.data?.layout || { rows: 2, cols: 2, gap: 4 })
const rawItems = computed(() => props.data?.items || [])
const textureChannels = computed(() => {
  if (!isTextureMaterial.value) return []
  const channels = Array.isArray(props.data?.channels) ? props.data.channels : []
  return channels.length ? channels : rawItems.value.map((item: any) => item?.pbrChannel).filter(Boolean)
})

const isTextureMaterial = computed(() => props.type === 'texture_material')
const hasGenerationItems = computed(() => rawItems.value.some((item: any) => isBatchGridGenerationItemType(item?.type)))
const defaultLabel = computed(() => (isTextureMaterial.value ? '3D材质' : '批量节点'))
const hasMediaPreviewBudget = computed(() => (
  flowRenderableMediaNodeIds.value.has(String(props.id || ''))
  || flowThumbRenderableMediaNodeIds.value.has(String(props.id || ''))
))
const { items } = useBatchGridProjectedItems({
  type: computed(() => String(props.type || '')),
  rawItems,
  channels: textureChannels,
})
const shouldUseLightweightGrid = computed(() => (
  items.value.length > 0
  && (flowUltraLightNodeMode.value || !hasMediaPreviewBudget.value)
))

function getTextureSlotLabel(channel: string): string {
  const normalized = String(channel || '').trim().toLowerCase()
  if (normalized === 'albedo') return 'BaseColor'
  if (normalized === 'displacement') return 'Height'
  if (normalized === 'normal') return 'Normal'
  if (normalized === 'roughness') return 'Roughness'
  if (normalized === 'metallic') return 'Metallic'
  if (normalized === 'ao') return 'AO'
  if (normalized === 'edge') return 'Edge'
  return channel
}

const visibleInputPorts = computed(() => {
  const ports = props.data?.ports?.inputs || [{ id: 'image', visible: true }]
  return ports.filter((p: { visible?: boolean }) => p.visible !== false)
})

const visibleOutputPorts = computed(() => {
  const ports = props.data?.ports?.outputs || [{ id: 'image', visible: true }]
  return ports.filter((p: { visible?: boolean }) => p.visible !== false)
})

const isSeamlessSplit = computed(() => props.data?.seamlessSplit === true)
const displayGap = computed(() => {
  if (isSeamlessSplit.value) return 0
  return Math.max(1, Math.min(Number(layout.value.gap || 0) || 0, 2))
})

function readPositiveNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : 0
}

const sourceAspectRatio = computed(() => {
  const dataAspectRatio = readPositiveNumber(props.data?.sourceAspectRatio)
  if (dataAspectRatio > 0) return dataAspectRatio
  const upstreamInputs = props.data?._upstreamInputs || {}
  const upstreamItems = [
    ...(Array.isArray(upstreamInputs.images) ? upstreamInputs.images : []),
    ...(Array.isArray(upstreamInputs.videos) ? upstreamInputs.videos : []),
    ...(Array.isArray(upstreamInputs.audios) ? upstreamInputs.audios : []),
  ]
  const first = upstreamItems[0] || {}
  const mediaMeta = first?.mediaMeta && typeof first.mediaMeta === 'object' ? first.mediaMeta : {}
  const directAspectRatio = readPositiveNumber(first?.aspectRatio) || readPositiveNumber(first?.aspect_ratio) || readPositiveNumber(mediaMeta.aspectRatio)
  if (directAspectRatio > 0) return directAspectRatio
  const width = readPositiveNumber(first?.width) || readPositiveNumber(mediaMeta.width)
  const height = readPositiveNumber(first?.height) || readPositiveNumber(mediaMeta.height)
  if (width > 0 && height > 0) return width / height
  return 0
})

const sourceDisplaySize = computed(() => {
  const size = props.data?.sourceDisplaySize || {}
  const width = readPositiveNumber(size.width)
  const height = readPositiveNumber(size.height)
  return width > 0 && height > 0 ? { width, height } : null
})

const tileAspectRatio = computed(() => {
  const { rows, cols } = layout.value
  const upstreamRatio = sourceAspectRatio.value
  if (upstreamRatio > 0 && rows > 0 && cols > 0) {
    return upstreamRatio * rows / cols
  }
  const ratios = items.value
    .map((item: any) => Number(item?.aspectRatio || 0))
    .filter((ratio: number) => Number.isFinite(ratio) && ratio > 0)
  return ratios[0] || 1
})

const tileFrame = computed(() => {
  const ratio = Math.max(0.25, Math.min(tileAspectRatio.value || 1, 4))
  const longEdge = 112
  const shortEdge = 56
  if (ratio >= 1) {
    return {
      width: longEdge,
      height: Math.max(shortEdge, Math.round(longEdge / ratio)),
    }
  }
  return {
    width: Math.max(shortEdge, Math.round(longEdge * ratio)),
    height: longEdge,
  }
})

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${layout.value.cols}, 1fr)`,
  gridTemplateRows: `repeat(${layout.value.rows}, 1fr)`,
  gap: `${displayGap.value}px`,
}))

const nodeStyle = computed(() => {
  if (sourceDisplaySize.value) {
    return {
      width: `${sourceDisplaySize.value.width}px`,
      height: `${sourceDisplaySize.value.height}px`,
    }
  }
  const { rows, cols } = layout.value
  const headerH = 28
  const g = displayGap.value
  const padding = 4
  const w = cols * tileFrame.value.width + (cols - 1) * g + padding * 2
  const h = rows * tileFrame.value.height + (rows - 1) * g + padding * 2 + headerH
  return { width: `${w}px`, height: `${h}px` }
})

const handleScatter = async () => {
  try {
    await ElMessageBox.confirm(
      '打散后会把当前批量节点拆成多个独立节点，是否继续？',
      '确认打散',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  flowScatterBatchNode(props.id)
}
const handleOpenPBR = async () => {
  await openTextureMaterialInPBR(rawItems.value)
}
const handleSlotRegenerate = async (channel: string) => {
  await regenerateTextureSlot(props.id, channel as PBRChannel)
}
const handleBatchGridSlotRegenerate = async (itemId: string) => {
  await regenerateBatchGridSlot(props.id, itemId)
}
const handleItemOpenEditor = (item: any) => {
  const imageUrl = String(item?.url || item?.displayUrl || '').trim()
  if (!imageUrl || !flowOpenDetail) return
  flowOpenDetail({
    nodeId: props.id,
    imageUrl,
    referenceSourceNodeId: props.id,
  })
}
const shouldShowSlotRegenerate = (item: any) => (
  isTextureMaterial.value
  && !!item?.pbrChannel
  && canRegenerateTextureSlot(props.id, String(item.pbrChannel))
)
const shouldShowBatchGridRegenerate = (item: any) => (
  !isTextureMaterial.value
  && !!item?.id
  && canRegenerateBatchGridSlot(props.id, String(item.id))
)

const previewVisible = ref(false)
const detailVisible = ref(false)
const handleOpenPreview = () => {
  previewVisible.value = true
}
const handleOpenDetails = () => {
  detailVisible.value = true
}
</script>

<template>
  <div
    class="batch-grid-node group"
    :class="{ selected, 'is-texture-material': isTextureMaterial, 'is-seamless-split': isSeamlessSplit }"
    :style="nodeStyle"
  >
    <NodePortsOverlay
      :input-ports="visibleInputPorts"
      :output-ports="visibleOutputPorts"
      :disable-input-ports="!!data.disableInputPorts"
      :disable-output-ports="!!data.disableOutputPorts"
    />

    <div class="batch-grid-toolbar" :class="{ active: selected }">
      <div
        v-if="!isTextureMaterial && items.length"
        class="tb-btn"
        title="查看拼图"
        @click.stop="handleOpenPreview"
      >
        <Play class="w-4 h-4" />
      </div>
      <div
        v-if="isTextureMaterial"
        class="tb-btn"
        title="打开到 3D 材质工具"
        @click.stop="handleOpenPBR"
      >
        <ArrowUpRight class="w-4 h-4" />
      </div>
      <div class="tb-btn" title="打散" @click.stop="handleScatter">
        <Grid3x3 class="w-4 h-4" />
      </div>
      <div
        v-if="!isTextureMaterial && items.length"
        class="tb-btn"
        title="查看详情"
        @click.stop="handleOpenDetails"
      >
        <Info class="w-4 h-4" />
      </div>
    </div>

    <div class="batch-grid-header">
      <span class="batch-grid-label">{{ data?.label || defaultLabel }}</span>
      <span class="batch-grid-count">{{ items.length }} 项</span>
    </div>

    <div v-if="shouldUseLightweightGrid" class="batch-grid-lightweight">
      <div class="batch-grid-lightweight-icon">
        <Grid3x3 class="w-5 h-5" />
      </div>
      <span>{{ items.length }} 项批量预览已暂停</span>
    </div>

    <div v-else class="batch-grid-content" :style="gridStyle">
      <div
        v-for="item in items"
        :key="item.id || item.url || item.pbrChannel"
        class="batch-grid-item"
        :class="[`is-${item.status || 'idle'}`]"
        @dblclick.stop="handleItemOpenEditor(item)"
      >
        <img
          v-if="item.mediaType !== 'video' && item.displayUrl"
          :src="item.displayUrl"
          :alt="item.label"
          loading="lazy"
        />
        <div v-else class="batch-grid-item-placeholder"></div>
        <div
          v-if="isTextureMaterial && item.pbrChannel"
          class="batch-grid-item-channel"
        >
          {{ getTextureSlotLabel(item.pbrChannel) }}
        </div>
        <button
          v-if="shouldShowSlotRegenerate(item) || shouldShowBatchGridRegenerate(item)"
          class="batch-grid-item-regenerate"
          :class="{ visible: selected }"
          type="button"
          title="原地重新生成"
          @pointerdown.stop.prevent
          @mousedown.stop.prevent
          @click.stop="isTextureMaterial ? handleSlotRegenerate(String(item.pbrChannel)) : handleBatchGridSlotRegenerate(String(item.id))"
        >
          <RefreshCw class="w-3.5 h-3.5" />
        </button>
        <div class="batch-grid-item-meta">
          <span v-if="item.status === 'running' && item.progress != null" class="batch-grid-item-progress">
            {{ Math.round(item.progress) }}%
          </span>
          <span v-else-if="item.status === 'running'" class="batch-grid-item-progress">生成中</span>
          <span v-else-if="item.status === 'waiting_submit'" class="batch-grid-item-progress">等待提交</span>
          <span v-else-if="item.status === 'queued'" class="batch-grid-item-progress">排队中</span>
          <span
            v-else-if="item.status === 'failed'"
            class="batch-grid-item-fail"
            :title="item.failReason || '生成失败'"
          >
            <strong>生成失败</strong>
            <small v-if="item.failReason">{{ item.failReason }}</small>
          </span>
        </div>
        <button
          v-if="!isTextureMaterial && item.status === 'failed' && item.id"
          class="batch-grid-item-retry"
          type="button"
          @pointerdown.stop.prevent
          @mousedown.stop.prevent
          @click.stop="handleBatchGridSlotRegenerate(String(item.id))"
        >
          重新生成
        </button>
      </div>
    </div>

    <BatchGridPreviewDialog
      v-model="previewVisible"
      :label="data?.label || defaultLabel"
      :items="items"
      :layout="layout"
      :source-aspect-ratio="sourceAspectRatio"
    />
    <BatchGridDetailDialog
      v-model="detailVisible"
      :label="data?.label || defaultLabel"
      :items="items"
    />
  </div>
</template>

<style scoped src="./BatchGridNode.css"></style>
