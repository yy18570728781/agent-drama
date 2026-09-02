<script setup>
import { ref, computed, inject, defineAsyncComponent } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Image as ImageIcon, Maximize2, Loader2, Upload, Globe, ArrowLeftRight, ArrowRight, ArrowDown, X, Camera, ChevronsLeft, Pencil, RefreshCw, AudioLines, Box, Wand2, Copy, Check, Heart, Trash2, Hand, Download, SlidersHorizontal } from 'lucide-vue-next'
import { downloadMedia } from '@/utils/download'
import { uploadFileToCosUrl } from '@/api/uploadHelpers'
import { postMediaCache } from '@/api/mediaCache'
import { copyText } from '@/utils/copyText'
import { buildPortsForNode } from '@/utils/workflowNodeData'
import { createThumbnailFileIfNeeded } from '@/utils/imageThumbnail'
import { isOversizeImageFile } from '@/utils/imageCompression'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { createFlowId } from '@/utils/flowId'
import { useAssetDragOut } from '@/composables/assets/useAssetDragOut'
import NodePortsOverlay from '../NodePortsOverlay.vue'
import { useFlowNodeRemoval } from '../useFlowNodeRemoval'
import { useFlowNodeExternalDrag } from './useFlowNodeExternalDrag'
import { useCompareSliderDrag } from './useCompareSliderDrag'
import ImageNodeGridSplit from './ImageNodeGridSplit.vue'
import ImageCompressDialog from '@/components/common/ImageCompressDialog.vue'
const PanoramaViewer = defineAsyncComponent(() => import('@/components/common/PanoramaViewer.vue'))

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const emit = defineEmits(['open-preview', 'open-detail', 'updateNodeInternals'])

const flowOpenDetail = inject('flowOpenDetail', null)
const flowOpenDetailModal = inject('flowOpenDetailModal', null)
const flowConvertNode = inject('flowConvertNode', null)
const flowReEditNode = inject('flowReEditNode', null)
const flowRegenerateNode = inject('flowRegenerateNode', null)
const flowRepairResultNode = inject('flowRepairResultNode', null)
const flowSaveHistory = inject('flowSaveHistory', null)
const flowInferUpstreamNode = inject('flowInferUpstreamNode', null)
const flowToggleResultFavorite = inject('flowToggleResultFavorite', null)
const flowDeleteResultRecord = inject('flowDeleteResultRecord', null)
const flowRenderableMediaNodeIds = inject('flowRenderableMediaNodeIds', ref(new Set()))
const flowThumbRenderableMediaNodeIds = inject('flowThumbRenderableMediaNodeIds', ref(new Set()))
const flowLightweightNodeMode = inject('flowLightweightNodeMode', computed(() => false))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const flowHasMultiSelection = inject('flowHasMultiSelection', computed(() => false))
const flowCreateConnectedAssetNode = inject('flowCreateConnectedAssetNode', null)
const { removeNode } = useFlowNodeRemoval(props.id)

const { updateNodeInternals, findNode, getEdges, addNodes, addEdges, updateNodeData, viewport } = useVueFlow()
const { edgeStyle, showNodeTitle } = useTheme()
const resizeScale = computed(() => Math.max(1 / (viewport.value?.zoom || 1), 1))
const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const isEditing = ref(false)
const title = ref(props.data.label || '图片节点')

const saveTitle = () => {
  isEditing.value = false
  updateNodeData(props.id, { label: title.value })
  flowSaveHistory?.()
}

const isDragging = ref(false)
const toolbarFileInput = ref(null)
const repairing = ref(false)
const imageCompressDialogVisible = ref(false)
const imageCompressDialogFiles = ref([])
let imageCompressResolver = null

const requestCompressedFiles = async (files) => {
  const validFiles = Array.isArray(files) ? files.filter((file) => file instanceof File) : []
  const oversizeImages = validFiles.filter((file) => isOversizeImageFile(file))
  if (!oversizeImages.length) return validFiles
  imageCompressDialogFiles.value = validFiles.filter((file) => file.type?.startsWith('image/'))
  imageCompressDialogVisible.value = true
  const processed = await new Promise((resolve) => {
    imageCompressResolver = resolve
  })
  if (!processed) return null
  const nextImages = Array.isArray(processed) ? processed : imageCompressDialogFiles.value
  let imageIndex = 0
  return validFiles.map((file) => {
    if (!file.type?.startsWith('image/')) return file
    const replacement = nextImages[imageIndex]
    imageIndex += 1
    return replacement instanceof File ? replacement : file
  })
}

const handleCompressDialogConfirm = (files) => {
  if (imageCompressResolver) {
    imageCompressResolver(Array.isArray(files) ? files : [])
    imageCompressResolver = null
  }
  imageCompressDialogVisible.value = false
  imageCompressDialogFiles.value = []
}

const handleCompressDialogCancel = () => {
  if (imageCompressResolver) {
    imageCompressResolver(null)
    imageCompressResolver = null
  }
  imageCompressDialogVisible.value = false
  imageCompressDialogFiles.value = []
}

const triggerFileInput = () => {
  toolbarFileInput.value?.click()
}

const getTargetNodeType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'file_input'
  if (mimeType.startsWith('video/')) return 'file_input'
  if (mimeType.startsWith('audio/')) return 'file_input'
  const ext = (mimeType || '').toLowerCase()
  if (ext.startsWith('text/') || ['txt', 'md', 'csv', 'json'].includes(ext)) return 'file_input'
  return null
}

const handleFile = async (file) => {
  if (file && file.type.startsWith('image/')) {
    if (props.data.url && props.data.url.startsWith('blob:')) {
      URL.revokeObjectURL(props.data.url)
    }
    const blobUrl = URL.createObjectURL(file)
    props.data.label = '图片上传'
    props.data.url = blobUrl
    props.data.mediaType = 'image'
    props.data.ports = buildPortsForNode('file_input', 'image')
    const thumbFilePromise = createThumbnailFileIfNeeded(file).catch(() => null)
    let uploadedServerUrl = ''
    uploadFileToCosUrl(file, file.name).then(serverUrl => {
      uploadedServerUrl = serverUrl
      if (props.data.url === blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      props.data.url = serverUrl
    }).catch(err => {
      console.warn('[ImageNode] 上传失败，保留本地预览:', err)
    })
    thumbFilePromise.then((thumbFile) => {
      if (!thumbFile) return null
      return uploadFileToCosUrl(thumbFile, thumbFile.name)
    }).then((thumbUrl) => {
      if (!thumbUrl) return
      props.data.thumb = thumbUrl
      props.data.thumbnail_url = thumbUrl
      const targetUrl = uploadedServerUrl || props.data.url
      if (targetUrl) {
        postMediaCache({ url: targetUrl, thumb: thumbUrl }).catch((err) => {
          console.warn('[ImageNode] write media-cache failed:', err)
        })
      }
    }).catch(() => {})
  }
}

const handleFileWithConversion = async (file) => {
  if (!file) return
  const preparedFiles = await requestCompressedFiles([file])
  if (!preparedFiles?.length) return
  file = preparedFiles[0]
  const target = getTargetNodeType(file.type)
  if (!target) return

  if (target === 'file_input' && file.type.startsWith('image/')) {
    handleFile(file)
    return
  }

  const blobUrl = URL.createObjectURL(file)
  const convertedData = file.type.startsWith('video/')
    ? { url: blobUrl, mediaType: 'video' }
    : file.type.startsWith('audio/')
      ? { url: blobUrl, mediaType: 'audio' }
      : null
  if (convertedData) {
    flowConvertNode?.(props.id, target, convertedData)
    uploadFileToCosUrl(file, file.name).then(serverUrl => {
      flowConvertNode?.(props.id, target, { url: serverUrl }, { mergeOnly: true })
    }).catch(err => {
      console.warn('[ImageNode] 上传失败，保留本地预览:', err)
    })
  } else if (target === 'file_input') {
    const text = await file.text()
    flowConvertNode?.(props.id, target, { content: text, mediaType: 'text' })
  }
}

const onDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFileWithConversion(file)
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (file) handleFileWithConversion(file)
  if (toolbarFileInput.value) toolbarFileInput.value.value = ''
}

const clearMedia = () => {
  if (props.data.url && props.data.url.startsWith('blob:')) {
    URL.revokeObjectURL(props.data.url)
  }
  removeNode()
}

const canRebuildUpstream = computed(() => {
  const data = props.data || {}
  if (data.disableInferUpstream) return false
  const requestParams = data.request?.params && typeof data.request.params === 'object' ? data.request.params : {}
  const stateParams = data._genState?.params && typeof data._genState.params === 'object' ? data._genState.params : {}
  const fileUrls = [
    ...(Array.isArray(requestParams.file_urls) ? requestParams.file_urls : []),
    ...(Array.isArray(stateParams.file_urls) ? stateParams.file_urls : []),
    ...(Array.isArray(data.referenceUrls) ? data.referenceUrls : []),
  ].filter(Boolean)
  const upstreamCount = (data._upstreamInputs?.images?.length || 0) + (data._upstreamInputs?.videos?.length || 0)
  return !!(flowInferUpstreamNode && (data.recordId || fileUrls.length || upstreamCount))
})

const handleRebuildUpstream = () => {
  flowInferUpstreamNode?.(props.id)
}

const canGenerationActions = computed(() => {
  const data = props.data || {}
  return !!(
    flowReEditNode
    && (
      data.recordId
      || data.queryId
      || data.request
      || data._genState
      || data.isGenerating
      || data.status === 'failed'
    )
  )
})

const canRegenerateAction = computed(() => {
  const data = props.data || {}
  return !!(
    flowRegenerateNode
    && data.nodeKind === 'aigc_result'
    && (
      data.recordId
      || data.queryId
      || data.request
      || data._genState
      || data.isGenerating
      || data.status === 'failed'
    )
  )
})

const handleReEdit = (direction) => {
  flowReEditNode?.(props.id, direction)
}

const handleRegenerate = (direction) => {
  flowRegenerateNode?.(props.id, direction)
}

const showPositionPicker = ref(false)
const positionPickerAction = ref('')
const hoverDirection = ref(null)

const handlePickPosition = (direction) => {
  showPositionPicker.value = false
  if (positionPickerAction.value === 'reedit') handleReEdit(direction)
  else if (positionPickerAction.value === 'regenerate') handleRegenerate(direction)
}

const canRepairNode = computed(() => {
  const data = props.data || {}
  const recordId = String(data.recordId || '').trim()
  const hasResolvedUrl = !!(data.url || data.preview || data.imageUrl || data.videoUrl || data.audioUrl || data.content)
  const isGenerating = !!(data.isGenerating || String(data.status || '').trim() === 'generating' || String(data._activeTaskId || '').trim())
  return !!(flowRepairResultNode && recordId && !hasResolvedUrl && !isGenerating)
})

const handleRepair = async () => {
  if (!flowRepairResultNode || repairing.value) return
  repairing.value = true
  try {
    await flowRepairResultNode(props.id)
  } finally {
    repairing.value = false
  }
}

const canUploadFromToolbar = computed(() => {
  return !canGenerationActions.value
})
const canRecordActions = computed(() => (
  !!(displayImage.value && String(props.data?.recordId || '').trim() && String(props.data?.url || '').trim())
))
const failureReason = computed(() => props.data.failReason || props.data.statusText || props.data.fail_reason?.error_message || props.data.fail_reason?.message || '未知错误')
const generationStatusLabel = computed(() => {
  const status = String(props.data?.status || '').trim()
  if (status === 'waiting_submit') return '等待提交'
  if (status === 'queued') return '排队中'
  if (status === 'running') return '生成中'
  return String(props.data?.statusText || '').trim() || '生成中'
})
const generationProgressLabel = computed(() => (
  typeof props.data?.progress === 'number' && Number.isFinite(props.data.progress)
    ? ` ${Math.round(props.data.progress)}%`
    : ''
))

const handleToggleFavorite = () => {
  if (!flowToggleResultFavorite || !canRecordActions.value) return
  flowToggleResultFavorite(props.id)
}

const handleDeleteResultRecord = () => {
  if (!flowDeleteResultRecord || !canRecordActions.value) return
  flowDeleteResultRecord(props.id)
}
const copiedFailReason = ref(false)

const copyFailReason = async () => {
  try {
    await copyText(String(failureReason.value || ''))
    copiedFailReason.value = true
    window.setTimeout(() => {
      copiedFailReason.value = false
    }, 1200)
  } catch (error) {
    console.warn('[ImageNode] 复制失败原因失败:', error)
  }
}

const ports = computed(() => props.data?.ports || { inputs: [], outputs: [] })
const visibleInputPorts = computed(() => (ports.value.inputs || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (ports.value.outputs || []).filter((port) => port?.visible !== false))

const displayImage = computed(() => {
  const url = props.data.url
  if (url && typeof url === 'string' && (
    url.startsWith('http') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('/api/') ||
    url.startsWith('/')
  )) {
    return url
  }
  return null
})

const displayImageThumb = computed(() => {
  const raw = props.data.thumb || props.data.thumbnail_url || displayImage.value || ''
  if (raw && typeof raw === 'string' && (
    raw.startsWith('http') ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:') ||
    raw.startsWith('/api/') ||
    raw.startsWith('/')
  )) {
    return raw
  }
  return null
})

const renderableImageSrc = computed(() => {
  return displayImageThumb.value || null
})

const {
  isExternalDragDraggable,
  armExternalDrag,
  resetExternalDragState,
  handleExternalDragStart,
  handleExternalDragEnd,
} = useFlowNodeExternalDrag(String(props.id || ''), computed(() => !!displayImage.value))

const shouldRenderImageMedia = computed(() => {
  if (flowUltraLightNodeMode.value) return false
  if (!renderableImageSrc.value) return false
  if (activeCompareMedia.value || compareBaseMedia.value) return true
  return flowRenderableMediaNodeIds.value.has(props.id)
})

const shouldRenderImageThumb = computed(() => {
  if (flowUltraLightNodeMode.value) return false
  if (!displayImageThumb.value || shouldRenderImageMedia.value) return false
  if (activeCompareMedia.value || compareBaseMedia.value) return true
  return flowThumbRenderableMediaNodeIds.value.has(props.id)
})

const onOpenPreview = () => {
  if (displayImage.value) {
    emit('open-preview', displayImage.value)
  }
}

const onDoubleClick = () => {
  if (!displayImage.value) return
  if (!props.data.recordId && flowOpenDetail) {
    flowOpenDetail({
      nodeId: props.id,
      imageUrl: displayImage.value,
      nodeData: props.data,
      isVideo: false,
      is360: !!props.data.is360,
    })
    return
  }
  if (flowOpenDetailModal) {
    flowOpenDetailModal({
      nodeId: props.id,
      imageUrl: displayImage.value,
      nodeData: props.data,
      isVideo: false,
      is360: !!props.data.is360,
      nodeType: 'file_input',
    })
  }
}

const handleOpenEditor = () => {
  if (!displayImage.value) return
  if (flowOpenDetail) {
    flowOpenDetail({
      nodeId: props.id,
      imageUrl: displayImage.value,
      nodeData: props.data,
      isVideo: false,
      is360: !!props.data.is360,
    })
  } else {
    emit('open-detail', {
      nodeId: props.id,
      imageUrl: displayImage.value,
      nodeData: props.data
    })
  }
}

const handleDownload = async () => {
  if (!displayImage.value) return
  await downloadMedia(displayImage.value)
}

const { startDrag: startAssetDragOut, endDrag: endAssetDragOut } = useAssetDragOut()

const buildDragOutPayload = () => {
  const url = displayImage.value || props.data.resultUrl
  if (!url) return null
  return {
    url,
    type: 'image',
    id: props.data.id ?? props.id,
    filename: `${props.data.id || props.id || 'image'}.png`,
  }
}

const handleDragOutStart = (e) => {
  const payload = buildDragOutPayload()
  if (!payload) return
  startAssetDragOut(e, payload)
}

const handleDragOutEnd = (e) => {
  endAssetDragOut(e)
}

// ==================== 对比功能 ====================

const upstreamMediaNodes = computed(() => {
  const incomingEdges = getEdges.value.filter(e => e.target === props.id)
  const nodes = incomingEdges.map(e => findNode(e.source)).filter(Boolean)
  return nodes.filter(n => n?.data?.url)
})

const showCompareMenu = ref(false)
const compareBaseMedia = ref(null)
const activeCompareMedia = ref(null)
const {
  compareSliderPosition,
  compareContainerRef,
  startCompareDrag,
} = useCompareSliderDrag()

const exitCompare = () => {
  activeCompareMedia.value = null
  compareBaseMedia.value = null
}

const getUpstreamMediaUrl = (node) => node.data.url

const handleCompareDirect = (upstreamNode) => {
  compareBaseMedia.value = {
    url: getUpstreamMediaUrl(upstreamNode),
    type: upstreamNode.data.mediaType || 'image'
  }
  activeCompareMedia.value = {
    url: displayImage.value,
    type: 'image'
  }
  compareSliderPosition.value = 50
}

const handleCompare = (upstreamNode) => {
  if (!upstreamNode) return
  const media = {
    url: getUpstreamMediaUrl(upstreamNode),
    type: upstreamNode.data.mediaType || 'image'
  }
  if (!compareBaseMedia.value) {
    compareBaseMedia.value = media
    return
  }
  activeCompareMedia.value = media
  compareSliderPosition.value = 50
  showCompareMenu.value = false
}

const panoramaViewerRef = ref(null)

const capturePanoramaFrame = () => {
  if (!panoramaViewerRef.value?.captureFrame) return
  const dataUrl = panoramaViewerRef.value.captureFrame()
  if (!dataUrl) return

  fetch(dataUrl)
    .then(res => res.blob())
    .then(async (blob) => {
      const file = new File([blob], `frame-360-${Date.now()}.png`, { type: 'image/png' })
      let url = ''
      try {
        url = await uploadFileToCosUrl(file, file.name)
      } catch {
        url = URL.createObjectURL(blob)
      }
      if (!flowCreateConnectedAssetNode) return
      flowCreateConnectedAssetNode(props.id, {
        id: createFlowId('node'),
        label: `${props.data.label || '图片'} - 抓拍`,
        url,
        mediaType: 'image',
        style: { width: '320px', height: '320px' },
      })
    })
}
</script>

<template>
  <div
    class="w-full h-full relative group animate-node-enter flex flex-col"
    :draggable="isExternalDragDraggable"
    :style="{ '--resize-scale': resizeScale }"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @mousedown.capture="armExternalDrag"
    @mouseup.capture="resetExternalDragState"
    @dragstart.capture="handleExternalDragStart"
    @dragend.capture="handleExternalDragEnd"
    @animationend="onAnimationEnd"
  >
    <NodeResizer
      :is-visible="selected && !flowLightweightNodeMode && !flowUltraLightNodeMode"
      :min-width="data._gridSplitChild ? 1 : 200"
      :min-height="data._gridSplitChild ? 1 : 150"
      :keep-aspect-ratio="true"
      :auto-scale="false"
    />

    <input type="file" ref="toolbarFileInput" accept="image/*,video/*,audio/*,.txt,.md,.csv,.json" class="hidden" @change="onFileChange" />

    <!-- Floating Label -->
    <div v-if="!flowUltraLightNodeMode && showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
        <ImageIcon class="w-3.5 h-3.5" />
      </div>
      <span
        v-if="!isEditing"
        @dblclick.stop="isEditing = true"
        class="text-xs font-medium text-zinc-300 hover:text-zinc-100 pointer-events-auto cursor-text transition-colors drop-shadow-md"
      >
        <Heart v-if="data.is_favorites" fill="currentColor" class="inline-block w-3.5 h-3.5 mr-1 text-rose-500 align-[-2px]" />
        {{ data.label || '图片节点' }}
      </span>
      <input
        v-else
        v-model="title"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        class="text-xs font-medium bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded outline-none border border-emerald-500 w-24 pointer-events-auto"
        autofocus
      />
    </div>

    <!-- Action Toolbar -->
    <div v-if="!flowHasMultiSelection" class="node-toolbar-wrap" :class="{ active: selected }" @dblclick.stop>
      <div v-if="canRecordActions" class="tb-btn" :class="{ 'tb-active': data.is_favorites }" :title="data.is_favorites ? '取消收藏' : '收藏'" @click="handleToggleFavorite">
        <Heart class="w-4 h-4" :class="{ 'text-rose-500': data.is_favorites }" :fill="data.is_favorites ? 'currentColor' : 'none'" />
      </div>
      <div v-if="canRepairNode" class="tb-btn tb-repair" :title="repairing ? '修复中' : '修复'" @click="handleRepair">
        <Loader2 v-if="repairing" class="w-4 h-4 animate-spin" />
        <Wand2 v-else class="w-4 h-4" />
      </div>
      <div
        v-if="canGenerationActions || canRegenerateAction"
        class="relative"
        @mouseleave="showPositionPicker = false"
      >
        <div class="flex items-center gap-px">
          <div v-if="canGenerationActions" class="tb-btn" title="重新编辑"
            @mouseenter="positionPickerAction = 'reedit'; showPositionPicker = true"
            @click="handleReEdit()"
          >
            <Pencil class="w-4 h-4" />
          </div>
          <div v-if="canRegenerateAction" class="tb-btn" title="重新生成"
            @mouseenter="positionPickerAction = 'regenerate'; showPositionPicker = true"
            @click="handleRegenerate()"
          >
            <RefreshCw class="w-4 h-4" />
          </div>
        </div>
        <Transition name="pos-picker">
          <div v-show="showPositionPicker" class="position-picker-popover">
            <button class="mini-dir-btn" title="右侧"
              @mouseenter="hoverDirection = 'right'"
              @mouseleave="hoverDirection = null"
              @click.stop="handlePickPosition('right')">
              <ArrowRight class="w-3 h-3" />
            </button>
            <button class="mini-dir-btn" title="下方"
              @mouseenter="hoverDirection = 'bottom'"
              @mouseleave="hoverDirection = null"
              @click.stop="handlePickPosition('bottom')">
              <ArrowDown class="w-3 h-3" />
            </button>
          </div>
        </Transition>
      </div>
      <div v-if="canRecordActions" class="tb-btn tb-danger" title="删除节点" @click="handleDeleteResultRecord">
        <Trash2 class="w-4 h-4" />
      </div>
      <div v-if="canRebuildUpstream" class="tb-btn" title="重建上游节点" @click="handleRebuildUpstream">
        <ChevronsLeft class="w-4 h-4" />
      </div>
      <div v-if="canGenerationActions || canRepairNode || canRebuildUpstream" class="tb-divider"></div>
      <ImageNodeGridSplit
        v-if="displayImage"
        :node-id="String(id || '')"
        :image-url="displayImage"
      />
      <div v-if="displayImage" class="tb-btn" :class="{ 'tb-active': data.is360 }" title="360° 全景模式" @click="data.is360 = !data.is360">
        <Globe class="w-4 h-4" />
      </div>
      <div v-if="displayImage && data.is360" class="tb-btn" title="360° 抓拍" @click="capturePanoramaFrame">
        <Camera class="w-4 h-4" />
      </div>
      <div v-if="data.recordId && displayImage" class="tb-btn" title="编辑" @click="handleOpenEditor">
        <SlidersHorizontal class="w-4 h-4" />
      </div>
      <div class="tb-btn" title="详情" @click="onDoubleClick">
        <Maximize2 class="w-4 h-4" />
      </div>
      <div v-if="upstreamMediaNodes.length >= 2 || (upstreamMediaNodes.length > 0 && displayImage)" class="relative" @mouseleave="showCompareMenu = false; if (!activeCompareMedia) compareBaseMedia = null">
        <div class="tb-btn" title="与上游对比" @click="upstreamMediaNodes.length === 1 && displayImage ? handleCompareDirect(upstreamMediaNodes[0]) : showCompareMenu = !showCompareMenu">
          <ArrowLeftRight class="w-4 h-4" />
        </div>
        <div v-show="showCompareMenu" class="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-20 pointer-events-auto origin-bottom transform">
          <div class="bg-zinc-800/95 backdrop-blur-md border border-zinc-700 rounded-none p-1.5 shadow-xl flex gap-1.5 w-max">
            <div v-for="node in upstreamMediaNodes" :key="node?.id" class="relative group/thumb cursor-pointer rounded-none overflow-hidden w-16 h-16 bg-black flex items-center justify-center shrink-0" :class="compareBaseMedia && compareBaseMedia.url === getUpstreamMediaUrl(node) ? 'border-indigo-500 border' : 'border border-transparent hover:border-indigo-500'" @click.stop="handleCompare(node)">
              <img v-if="node?.data?.mediaType === 'image'" :src="node?.data?.url" class="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100" />
              <video v-else-if="node?.data?.mediaType === 'video'" :src="node?.data?.url" class="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100" />
              <div v-else class="w-full h-full flex flex-col items-center gap-2 py-2 cursor-pointer justify-center bg-zinc-900 text-zinc-200">
                <component :is="node?.data?.mediaType === 'audio' ? AudioLines : Box" class="w-4 h-4" />
                <span class="text-[9px]">{{ node?.data?.mediaType === 'audio' ? '音频' : '文件' }}</span>
              </div>
              <div class="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center py-0.5">{{ node?.data?.label || '上游媒体' }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="canUploadFromToolbar" class="tb-btn" title="上传文件" @click="triggerFileInput">
        <Upload class="w-4 h-4" />
      </div>
      <div v-if="displayImage" class="tb-btn" title="另存为" @click="handleDownload">
        <Download class="w-4 h-4" />
      </div>
      <div
        v-if="displayImage || props.data.resultUrl"
        class="tb-btn nodrag"
        title="拖出到窗口外"
        draggable="true"
        @pointerdown.stop
        @mousedown.stop
        @dragstart="handleDragOutStart"
        @dragend="handleDragOutEnd"
      >
        <Hand class="w-4 h-4" />
      </div>
    </div>

    <!-- Node Card -->
    <div
      class="w-full h-full border rounded-none shadow-lg relative flex flex-col"
      :class="[
        flowUltraLightNodeMode
          ? 'border-zinc-700/80 bg-[#18181b]/95 shadow-[0_8px_24px_rgba(15,23,42,0.2)]'
          : selected ? 'border-white shadow-white/10 ring-1 ring-white/30 group-hover:shadow-white/20 group-hover:shadow-2xl' : 'border-zinc-800 hover:border-zinc-700',
        isDragging ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : ''
      ]"
    >
      <NodePortsOverlay
        :input-ports="visibleInputPorts"
        :output-ports="visibleOutputPorts"
        :disable-input-ports="!!data.disableInputPorts"
        :disable-output-ports="!!data.disableOutputPorts"
      />

      <div class="rounded-none overflow-hidden flex flex-col h-full">
        <!-- Content Area -->
        <div
          class="flex-1 flex flex-col items-center justify-center relative min-h-0 h-full"
          :class="flowUltraLightNodeMode ? 'bg-[#18181b]/92' : 'bg-[#18181b]'"
        >
          <!-- Compare View -->
          <div v-if="!flowLightweightNodeMode && activeCompareMedia && compareBaseMedia" class="absolute inset-0 select-none cursor-ew-resize z-10 bg-black overflow-hidden" @mousedown.stop="startCompareDrag" ref="compareContainerRef">
            <img v-if="activeCompareMedia.type === 'image'" :src="activeCompareMedia.url" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <video v-else :src="activeCompareMedia.url" class="absolute inset-0 w-full h-full object-cover pointer-events-none" autoplay loop muted playsinline />
            <div class="absolute inset-0 pointer-events-none" :style="{ clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)` }">
              <img v-if="compareBaseMedia.type === 'image'" :src="compareBaseMedia.url" class="absolute inset-0 w-full h-full object-cover" />
              <video v-else :src="compareBaseMedia.url" class="absolute inset-0 w-full h-full object-cover" autoplay loop muted playsinline />
            </div>
            <div class="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none flex items-center justify-center transform -translate-x-1/2 shadow-[0_0_10px_rgba(0,0,0,0.5)]" :style="{ left: `${compareSliderPosition}%` }">
              <div class="w-6 h-6 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg pointer-events-auto cursor-ew-resize">
                <ArrowLeftRight class="w-3 h-3" />
              </div>
            </div>
            <div class="absolute top-2 left-2 bg-black/60 text-white/80 px-1.5 py-0.5 rounded text-[10px] pointer-events-none border border-white/20 shadow-lg truncate max-w-[40%]">对比A</div>
            <div class="absolute top-2 right-2 bg-black/60 text-white/80 px-1.5 py-0.5 rounded text-[10px] pointer-events-none border border-white/20 shadow-lg truncate max-w-[40%]">对比B</div>
            <div class="absolute top-2 left-1/2 -translate-x-1/2 cursor-pointer bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 pointer-events-auto shadow-lg" @click.stop="exitCompare" title="退出对比">
              <X class="w-3 h-3" />
            </div>
          </div>

          <!-- Normal View -->
          <template v-if="flowUltraLightNodeMode">
            <div class="w-full h-full relative">
              <div
                class="absolute inset-[10px] rounded-none border border-dashed bg-zinc-900/80"
                :class="selected ? 'border-zinc-200/70 shadow-[0_0_0_1px_rgba(244,244,245,0.18),0_8px_24px_rgba(15,23,42,0.22)]' : 'border-zinc-300/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center text-zinc-500 pointer-events-none">
                <ImageIcon class="w-8 h-8 opacity-60" />
              </div>
            </div>
          </template>
          <template v-else-if="!activeCompareMedia || !compareBaseMedia">
          <template v-if="renderableImageSrc && shouldRenderImageMedia">
            <PanoramaViewer
              v-if="data.is360"
              ref="panoramaViewerRef"
              :src="displayImage || renderableImageSrc"
              type="image"
              class="w-full h-full"
              @dblclick.stop="onDoubleClick"
            />
            <img v-else :src="renderableImageSrc" loading="lazy" decoding="async" class="image-node-grid-source w-full h-full object-cover cursor-pointer" @click="onOpenPreview" @dblclick.stop="onDoubleClick" />
          </template>

          <template v-else-if="displayImageThumb && shouldRenderImageThumb">
            <img :src="displayImageThumb" loading="lazy" decoding="async" class="image-node-grid-source w-full h-full object-cover cursor-pointer" @click="onOpenPreview" @dblclick.stop="onDoubleClick" />
          </template>

          <button
            v-else-if="displayImage"
            type="button"
            class="w-full h-full border-0 bg-transparent cursor-pointer flex flex-col items-center justify-center gap-2 text-zinc-500 px-4"
            @click="onOpenPreview"
            @dblclick.stop="onDoubleClick"
          >
            <ImageIcon class="w-8 h-8 opacity-50" />
          </button>

          <div
            v-else-if="data._suppressEmptyMediaPlaceholderIcon"
            class="w-full h-full"
          ></div>

          <div
            v-else
            class="w-full h-full relative flex flex-col items-center justify-center gap-2 text-zinc-500"
            :class="{ 'generating-placeholder': data.isGenerating }"
          >
            <div
              class="absolute inset-[12px] rounded-none border border-dashed border-zinc-600/70 bg-zinc-900/35"
              :class="selected ? 'border-zinc-300/80 shadow-[0_0_0_1px_rgba(244,244,245,0.14)]' : 'border-zinc-600/70'"
            ></div>
            <ImageIcon class="w-8 h-8 opacity-60 relative z-[1]" />
          </div>
          </template>

          <!-- Loading Overlay -->
          <div v-if="data.isGenerating" class="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 class="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <span class="text-sm text-emerald-400 font-medium">
              {{ generationStatusLabel }}{{ generationProgressLabel }}
            </span>
          </div>
          <div
            v-else-if="data.status === 'failed'"
            class="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 px-4 text-center node-failed-overlay"
            @mousedown.stop
            @click.stop
          >
            <button class="node-failed-copy-btn mb-3" @click.stop="copyFailReason">
              <Check v-if="copiedFailReason" class="w-3.5 h-3.5" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ copiedFailReason ? '已复制' : '复制失败原因' }}</span>
            </button>
            <X class="w-7 h-7 text-red-300 mb-3" />
            <span class="text-sm text-red-200 font-medium">生成失败</span>
            <div class="text-xs text-red-100/90 mt-2 node-failed-text">{{ failureReason }}</div>
          </div>
        </div>
      </div>

    </div>
    <ImageCompressDialog
      :visible="imageCompressDialogVisible"
      :files="imageCompressDialogFiles"
      @update:visible="(value) => { if (!value) handleCompressDialogCancel() }"
      @confirm="handleCompressDialogConfirm"
      @cancel="handleCompressDialogCancel"
    />

    <div v-show="hoverDirection" class="ghost-preview" :class="hoverDirection"></div>
  </div>
</template>

<style scoped>
.node-failed-overlay { pointer-events: none; user-select: text; -webkit-user-select: text; }
.node-failed-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(254, 202, 202, 0.28);
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.72);
  color: #fee2e2;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
.node-failed-copy-btn:hover { background: rgba(153, 27, 27, 0.82); }
.node-failed-text {
  user-select: text;
  -webkit-user-select: text;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
  cursor: text;
}
.node-toolbar-wrap {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1px;
  background: rgba(39, 39, 42, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #3f3f46;
  border-radius: 5px;
  padding: 3px 5px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.32);
  transition: all 0.2s;
  opacity: 0;
  z-index: 10;
}
.group:hover .node-toolbar-wrap {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.generating-placeholder {
  position: relative;
  overflow: hidden;
}
.generating-placeholder::before {
  content: '';
  position: absolute;
  inset: -20%;
  background: linear-gradient(120deg, transparent 20%, rgba(16, 185, 129, 0.18) 45%, rgba(16, 185, 129, 0.36) 50%, rgba(16, 185, 129, 0.18) 55%, transparent 80%);
  transform: translateX(-120%);
  animation: generating-placeholder-shimmer 1.8s ease-in-out infinite;
}
@keyframes generating-placeholder-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
.node-toolbar-wrap.active {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.tb-btn {
  padding: 4px;
  color: #a1a1aa;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
.tb-btn:hover {
  color: white;
  background: #3f3f46;
}
.tb-btn.tb-repair {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.34);
  color: #f87171;
}
.tb-btn.tb-repair:hover {
  background: rgba(220, 38, 38, 0.24);
  border-color: rgba(220, 38, 38, 0.42);
  color: #fca5a5;
}
.tb-btn.tb-danger:hover {
  color: #f87171;
}
.tb-btn.tb-active {
  color: #818cf8;
}
.tb-divider {
  width: 1px;
  height: 16px;
  background: #52525b;
  margin: 0 2px;
  flex-shrink: 0;
}

.group :deep(.vue-flow__resize-control.handle) {
  width: 10px !important;
  height: 10px !important;
  border: 1.5px solid rgba(255, 255, 255, 0.9) !important;
  border-radius: 2px !important;
  background-color: rgba(63, 63, 70, 0.9) !important;
  transform: translate(-50%, -50%) scale(var(--resize-scale, 1)) !important;
}
.group :deep(.vue-flow__resize-control.line) {
  border-width: 0 !important;
  background: transparent !important;
}
.group :deep(.vue-flow__resize-control.line.left),
.group :deep(.vue-flow__resize-control.line.right) {
  width: calc(8px * var(--resize-scale, 1)) !important;
  height: 100% !important;
  transform: none !important;
  top: 0 !important;
}
.group :deep(.vue-flow__resize-control.line.left) {
  left: calc(-4px * var(--resize-scale, 1)) !important;
}
.group :deep(.vue-flow__resize-control.line.right) {
  left: calc(100% + 4px * var(--resize-scale, 1) - 100%) !important;
  margin-left: calc(-4px * var(--resize-scale, 1)) !important;
}
.group :deep(.vue-flow__resize-control.line.top),
.group :deep(.vue-flow__resize-control.line.bottom) {
  height: calc(8px * var(--resize-scale, 1)) !important;
  width: 100% !important;
  transform: none !important;
  left: 0 !important;
}
.group :deep(.vue-flow__resize-control.line.top) {
  top: calc(-4px * var(--resize-scale, 1)) !important;
}
.group :deep(.vue-flow__resize-control.line.bottom) {
  top: calc(100% + 4px * var(--resize-scale, 1) - 100%) !important;
  margin-top: calc(-4px * var(--resize-scale, 1)) !important;
}
.position-picker-popover {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  background: rgba(39, 39, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 2px;
  z-index: 20;
}
.mini-dir-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.15s;
}
.mini-dir-btn:hover {
  background: #3f3f46;
  color: #fff;
}
.pos-picker-enter-active, .pos-picker-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.pos-picker-enter-from, .pos-picker-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
.ghost-preview {
  position: absolute;
  border: 2px dashed rgba(129, 140, 248, 0.5);
  background: rgba(129, 140, 248, 0.08);
  border-radius: 8px;
  pointer-events: none;
  z-index: 1;
}
.ghost-preview.right {
  top: 0;
  left: calc(100% + 64px);
  width: 100%;
  height: 100%;
}
.ghost-preview.bottom {
  top: calc(100% + 60px);
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
