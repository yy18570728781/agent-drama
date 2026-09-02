<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, inject, defineAsyncComponent } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { Video, Image as ImageIcon, Maximize2, Music, Loader2, Upload, Play, Pause, ChevronLeft, ChevronRight, Camera, ArrowLeftRight, ArrowRight, ArrowDown, X, ChevronsLeft, Pencil, RefreshCw, AudioLines, Box, Wand2, Copy, Check, Heart, Trash2, Hand, Download, SlidersHorizontal } from 'lucide-vue-next'
import { downloadMedia } from '@/utils/download'
import { getUploadErrorMessage, uploadFileToCosUrl } from '@/api/uploadHelpers'
import { postMediaCache } from '@/api/mediaCache'
import { copyText } from '@/utils/copyText'
import { buildPortsForNode } from '@/utils/workflowNodeData'
import { createVideoThumbnailFile } from '@/utils/imageThumbnail'
import { useTheme } from '@/styles/theme/composables/useTheme'
import { useCompareSliderDrag } from './useCompareSliderDrag'
import { createFlowId } from '@/utils/flowId'
import { useAssetDragOut } from '@/composables/assets/useAssetDragOut'
import NodePortsOverlay from '../NodePortsOverlay.vue'
import { useFlowNodeRemoval } from '../useFlowNodeRemoval'
import { useFlowNodeExternalDrag } from './useFlowNodeExternalDrag'
import VideoThumbnailPreview from './VideoThumbnailPreview.vue'

const PanoramaViewer = defineAsyncComponent(() => import('@/components/common/PanoramaViewer.vue'))

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const { updateNodeInternals, findNode, getEdges, updateNodeData, viewport } = useVueFlow()
const { edgeStyle, showNodeTitle } = useTheme()
const resizeScale = computed(() => Math.max(1 / (viewport.value?.zoom || 1), 1))

const flowOpenDetail = inject('flowOpenDetail', null)
const flowOpenDetailModal = inject('flowOpenDetailModal', null)
const flowConvertNode = inject('flowConvertNode', null)
const flowReEditNode = inject('flowReEditNode', null)
const flowRegenerateNode = inject('flowRegenerateNode', null)
const flowRepairResultNode = inject('flowRepairResultNode', null)
const flowInferUpstreamNode = inject('flowInferUpstreamNode', null)
const flowCreateConnectedAssetNode = inject('flowCreateConnectedAssetNode', null)
const flowSaveHistory = inject('flowSaveHistory', null)
const flowToggleResultFavorite = inject('flowToggleResultFavorite', null)
const flowDeleteResultRecord = inject('flowDeleteResultRecord', null)
const flowRenderableMediaNodeIds = inject('flowRenderableMediaNodeIds', ref(new Set()))
const flowThumbRenderableMediaNodeIds = inject('flowThumbRenderableMediaNodeIds', ref(new Set()))
const flowLightweightNodeMode = inject('flowLightweightNodeMode', computed(() => false))
const flowUltraLightNodeMode = inject('flowUltraLightNodeMode', computed(() => false))
const flowHasMultiSelection = inject('flowHasMultiSelection', computed(() => false))
const { removeNode } = useFlowNodeRemoval(props.id)

const onAnimationEnd = () => {
  updateNodeInternals([props.id])
}

const isEditing = ref(false)
const title = ref(props.data.label || '视频节点')

const saveTitle = () => {
  isEditing.value = false
  updateNodeData(props.id, { label: title.value })
  flowSaveHistory?.()
}

const isDragging = ref(false)
const toolbarFileInput = ref(null)
const videoRef = ref(null)
const audioRef = ref(null)
const progress = ref(0)
const isPlaying = ref(false)
const isScrubbing = ref(false)
const hoverTimeout = ref(null)
const isManuallyPaused = ref(false)
const progressBarRef = ref(null)
const panoramaViewerRef = ref(null)
const repairing = ref(false)

const togglePlay = () => {
  const media = props.data.mediaType === 'audio' ? audioRef.value : videoRef.value
  if (!media) return
  if (isPlaying.value) {
    media.pause()
    isPlaying.value = false
    isManuallyPaused.value = true
  } else {
    media.play().catch(() => {})
    isPlaying.value = true
    isManuallyPaused.value = false
  }
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
  !!(displayVideo.value && String(props.data?.recordId || '').trim() && String(props.data?.url || '').trim())
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
const copiedFailReason = ref(false)

const handleToggleFavorite = () => {
  if (!flowToggleResultFavorite || !canRecordActions.value) return
  flowToggleResultFavorite(props.id)
}

const handleDeleteResultRecord = () => {
  if (!flowDeleteResultRecord || !canRecordActions.value) return
  flowDeleteResultRecord(props.id)
}

const copyFailReason = async () => {
  try {
    await copyText(String(failureReason.value || ''))
    copiedFailReason.value = true
    window.setTimeout(() => {
      copiedFailReason.value = false
    }, 1200)
  } catch (error) {
    console.warn('[VideoNode] 复制失败原因失败:', error)
  }
}

const ports = computed(() => props.data?.ports || { inputs: [], outputs: [] })
const visibleInputPorts = computed(() => (ports.value.inputs || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (ports.value.outputs || []).filter((port) => port?.visible !== false))

const stepFrame = (forward) => {
  const media = props.data.mediaType === 'audio' ? audioRef.value : videoRef.value
  if (!media) return
  media.pause()
  isPlaying.value = false
  isManuallyPaused.value = true
  const frameTime = 1 / 30
  media.currentTime += forward ? frameTime : -frameTime
}

const handleKeyDown = (e) => {
  if (!props.selected) return
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (!displayVideo.value) return
  if (props.data.mediaType === 'image') return
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.code === 'KeyA') {
    e.preventDefault()
    stepFrame(false)
  } else if (e.code === 'KeyD') {
    e.preventDefault()
    stepFrame(true)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// ==================== 截帧功能（增强：markers） ====================

const activeMarker = ref(null)

const extractFrameAndUpdateNode = (marker) => {
  const video = videoRef.value
  if (!video) return

  const capture = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], `frame-${marker.id}.png`, { type: 'image/png' })
        let url = ''
        try {
          url = await uploadFileToCosUrl(file, file.name)
        } catch {
          url = URL.createObjectURL(blob)
        }
        const targetNode = findNode(marker.id)
        if (!targetNode) return
        if (targetNode.data.url && targetNode.data.url.startsWith('blob:')) {
          URL.revokeObjectURL(targetNode.data.url)
        }
        updateNodeData(marker.id, {
          ...targetNode.data,
          url,
          imageUrl: url,
          preview: url,
          mediaType: 'image',
        })
      }, 'image/png')
    } catch (error) {
      console.error('[VideoNode] Failed to update frame:', error)
    }
  }

  if (video.seeking) {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      capture()
    }
    video.addEventListener('seeked', onSeeked)
  } else if (video.readyState >= 2) {
    capture()
  } else {
    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay)
      capture()
    }
    video.addEventListener('canplay', onCanPlay)
  }
}

const captureCurrentFrame = () => {
  if (props.data.is360 && panoramaViewerRef.value?.captureFrame) {
    const dataUrl = panoramaViewerRef.value.captureFrame()
    if (dataUrl) {
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
            label: `${props.data.label || '视频'} - 360抓拍`,
            url,
            mediaType: 'image',
            style: { width: '320px', height: '180px' },
          })
        })
    }
    return
  }

  const video = videoRef.value
  if (!video) return

  if (props.data.markers && props.data.markers.length > 0) {
    const existingMarker = props.data.markers.find(
      (m) => Math.abs(m.percentage - progress.value) < 0.5
    )
    if (existingMarker) {
      extractFrameAndUpdateNode(existingMarker)
      return
    }
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `frame-${Date.now()}.png`, { type: 'image/png' })
      let url = ''
      try {
        url = await uploadFileToCosUrl(file, file.name)
      } catch {
        url = URL.createObjectURL(blob)
      }
      if (!flowCreateConnectedAssetNode) return
      const created = flowCreateConnectedAssetNode(props.id, {
        id: createFlowId('node'),
        label: `${props.data.label || '视频'} - 帧截图`,
        url,
        mediaType: 'image',
        style: { width: '320px', height: '180px' },
      })
      const newNodeId = created?.id
      if (!newNodeId) return
      if (!props.data.markers) props.data.markers = []
      props.data.markers.push({
        id: newNodeId,
        percentage: progress.value,
        time: video.currentTime
      })
    }, 'image/png')
  } catch (error) {
    console.error('[VideoNode] Failed to capture frame:', error)
  }
}

// ==================== 标记拖拽 ====================

const startDraggingMarker = (e, marker) => {
  activeMarker.value = marker
  window.addEventListener('mousemove', handleMarkerDrag)
  window.addEventListener('mouseup', stopMarkerDrag)
}

const handleMarkerDrag = (e) => {
  if (!progressBarRef.value || !activeMarker.value) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(1, x / rect.width))
  activeMarker.value.percentage = percentage * 100
  const video = videoRef.value
  if (video && video.duration) {
    video.currentTime = percentage * video.duration
    activeMarker.value.time = video.currentTime
    progress.value = percentage * 100
  }
}

const stopMarkerDrag = () => {
  activeMarker.value = null
  window.removeEventListener('mousemove', handleMarkerDrag)
  window.removeEventListener('mouseup', stopMarkerDrag)
}

// ==================== 进度条拖拽 ====================

const updateProgressFromEvent = (e) => {
  if (!progressBarRef.value) return
  const media = props.data.mediaType === 'audio' ? audioRef.value : videoRef.value
  if (!media || !media.duration) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(1, x / rect.width))
  media.currentTime = percentage * media.duration
  progress.value = percentage * 100
}

const startScrubbing = (e) => {
  isScrubbing.value = true
  updateProgressFromEvent(e)
  window.addEventListener('mousemove', handleScrubbing)
  window.addEventListener('mouseup', stopScrubbing)
}

const handleScrubbing = (e) => {
  if (!isScrubbing.value) return
  updateProgressFromEvent(e)
}

const stopScrubbing = () => {
  isScrubbing.value = false
  window.removeEventListener('mousemove', handleScrubbing)
  window.removeEventListener('mouseup', stopScrubbing)
}

onUnmounted(() => {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  window.removeEventListener('mousemove', handleScrubbing)
  window.removeEventListener('mouseup', stopScrubbing)
  window.removeEventListener('mousemove', handleMarkerDrag)
  window.removeEventListener('mouseup', stopMarkerDrag)
})

const handleMouseEnter = () => {
  if (displayVideoThumb.value) return
  if (!shouldRenderVideoMedia.value) return
  const url = displayVideo.value
  if (!url || isManuallyPaused.value) return
  hoverTimeout.value = window.setTimeout(() => {
    if (props.data.mediaType === 'audio' && audioRef.value) {
      audioRef.value.play().catch(() => {})
      isPlaying.value = true
    } else if (videoRef.value) {
      videoRef.value.play().catch(() => {})
      isPlaying.value = true
    }
  }, 300)
}

const stopMediaPlayback = (reset = false) => {
  const media = props.data.mediaType === 'audio' ? audioRef.value : videoRef.value
  if (!media) return
  media.pause()
  if (reset) {
    media.currentTime = 0
    progress.value = 0
  }
  isPlaying.value = false
}

const handleMouseLeave = () => {
  if (displayVideoThumb.value) return
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  if (displayVideo.value && !isManuallyPaused.value) {
    stopMediaPlayback(false)
  }
}

let timeUpdateRAF = null
const onTimeUpdate = (e) => {
  if (isScrubbing.value) return
  if (timeUpdateRAF) return
  timeUpdateRAF = requestAnimationFrame(() => {
    timeUpdateRAF = null
    const media = e.target
    if (media.duration) {
      progress.value = (media.currentTime / media.duration) * 100
    }
  })
}

const triggerFileInput = () => {
  toolbarFileInput.value?.click()
}

const getTargetNodeType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'file_input'
  if (mimeType.startsWith('video/')) return 'file_input'
  if (mimeType.startsWith('audio/')) return 'file_input'
  return null
}

const handleFile = (file) => {
  if (file && (file.type.startsWith('video/') || file.type.startsWith('image/') || file.type.startsWith('audio/'))) {
    if (props.data.url && props.data.url.startsWith('blob:')) {
      URL.revokeObjectURL(props.data.url)
    }
    const blobUrl = URL.createObjectURL(file)
    props.data.url = blobUrl
    props.data.mediaType = file.type.split('/')[0]
    props.data.ports = buildPortsForNode('file_input', props.data.mediaType)
    props.data.uploadStatus = 'uploading'
    props.data.uploadError = ''
    const thumbFilePromise = file.type.startsWith('video/')
      ? createVideoThumbnailFile(file).catch(() => null)
      : Promise.resolve(null)
    uploadFileToCosUrl(file, file.name).then(serverUrl => {
      if (props.data.url === blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      props.data.url = serverUrl
      props.data.uploadStatus = 'uploaded'
      props.data.uploadError = ''
      thumbFilePromise
        .then((thumbFile) => (thumbFile ? uploadFileToCosUrl(thumbFile, thumbFile.name) : null))
        .then((thumbUrl) => {
          if (!thumbUrl) return
          props.data.thumb = thumbUrl
          props.data.thumbnail_url = thumbUrl
          postMediaCache({ url: serverUrl, thumb: thumbUrl }).catch((err) => {
            console.warn('[VideoNode] write media-cache failed:', err)
          })
        })
        .catch((err) => {
          console.warn('[VideoNode] upload video thumbnail failed:', err)
        })
    }).catch(err => {
      props.data.uploadStatus = 'local'
      props.data.uploadError = getUploadErrorMessage(err)
    })
  }
}

const handleFileWithConversion = async (file) => {
  if (!file) return
  const target = getTargetNodeType(file.type)
  if (!target) return

  if (target === 'file_input') {
    handleFile(file)
    return
  }

  const blobUrl = URL.createObjectURL(file)
  if (target === 'file_input') {
    flowConvertNode?.(props.id, target, { url: blobUrl, mediaType: 'image' })
    uploadFileToCosUrl(file, file.name).then(serverUrl => {
      flowConvertNode?.(props.id, target, { url: serverUrl }, { mergeOnly: true })
    }).catch(err => {
    })
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

const displayVideo = computed(() => {
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

const displayVideoThumb = computed(() => {
  const url = props.data.thumb || props.data.thumbnail_url || ''
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

const {
  isExternalDragDraggable,
  armExternalDrag,
  resetExternalDragState,
  handleExternalDragStart,
  handleExternalDragEnd,
} = useFlowNodeExternalDrag(String(props.id || ''), computed(() => !!displayVideo.value))

const shouldRenderVideoMedia = computed(() => {
  if (flowUltraLightNodeMode.value) return false
  if (!displayVideo.value) return false
  if (props.data.mediaType === 'audio') return true
  if (!displayVideoThumb.value) return false
  if (activeCompareMedia.value || compareBaseMedia.value) return true
  return flowRenderableMediaNodeIds.value.has(props.id)
})

const shouldRenderVideoThumb = computed(() => {
  if (flowUltraLightNodeMode.value) return false
  if (!displayVideoThumb.value || shouldRenderVideoMedia.value) return false
  if (props.data.mediaType === 'audio') return false
  if (activeCompareMedia.value || compareBaseMedia.value) return true
  return flowThumbRenderableMediaNodeIds.value.has(props.id)
})

const shouldUseThumbCardPreview = computed(() => (
  !!displayVideoThumb.value
  && props.data.mediaType !== 'audio'
  && !shouldRenderVideoMedia.value
  && shouldRenderVideoThumb.value
))

const shouldShowPlaybackControls = computed(() => (
  !!displayVideo.value
  && shouldRenderVideoMedia.value
  && (props.data.mediaType === 'audio' || props.data.mediaType === 'video' || (!props.data.mediaType && props.data.videoUrl))
  && !flowUltraLightNodeMode.value
))

const onDoubleClick = () => {
  if (!displayVideo.value) return
  if (!props.data.recordId && flowOpenDetail) {
    flowOpenDetail({
      nodeId: props.id,
      imageUrl: displayVideo.value,
      nodeData: props.data,
      isVideo: props.data.mediaType !== 'image',
    })
    return
  }
  if (flowOpenDetailModal) {
    flowOpenDetailModal({
      nodeId: props.id,
      imageUrl: displayVideo.value,
      nodeData: props.data,
      isVideo: props.data.mediaType !== 'image',
      nodeType: 'file_input',
    })
  }
}

const handleOpenEditor = () => {
  if (displayVideo.value && flowOpenDetail) {
    flowOpenDetail({
      nodeId: props.id,
      imageUrl: displayVideo.value,
      nodeData: props.data,
      isVideo: props.data.mediaType !== 'image',
    })
  }
}

const handleDownload = async () => {
  if (!displayVideo.value) return
  await downloadMedia(displayVideo.value)
}

const { startDrag: startAssetDragOut, endDrag: endAssetDragOut } = useAssetDragOut()

const handleDragOutStart = (e) => {
  const url = displayVideo.value
  if (!url) return
  startAssetDragOut(e, {
    url,
    type: 'video',
    id: props.data.id ?? props.id,
    filename: `${props.data.id || props.id || 'video'}.mp4`,
  })
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
    url: displayVideo.value,
    type: props.data.mediaType === 'video' ? 'video' : 'image'
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
</script>

<template>
  <div
    class="w-full h-full relative group group/video-node animate-node-enter flex flex-col"
    :draggable="isExternalDragDraggable"
    :style="{ '--resize-scale': resizeScale }"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @animationend="onAnimationEnd"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousedown.capture="armExternalDrag"
    @mouseup.capture="resetExternalDragState"
    @dragstart.capture="handleExternalDragStart"
    @dragend.capture="handleExternalDragEnd"
  >
    <NodeResizer :is-visible="selected && !flowLightweightNodeMode && !flowUltraLightNodeMode" :min-width="200" :min-height="150" :keep-aspect-ratio="true" :auto-scale="false" />

    <input type="file" ref="toolbarFileInput" accept="image/*,video/*,audio/*,.txt,.md,.csv,.json" class="hidden" @change="onFileChange" />

    <!-- Floating Label -->
    <div v-if="!flowUltraLightNodeMode && showNodeTitle" class="absolute -top-8 -left-1 flex items-center gap-2 pointer-events-none z-10">
      <div class="w-6 h-6 rounded-md bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
        <Video class="w-3.5 h-3.5" />
      </div>
      <span
        v-if="!isEditing"
        @dblclick.stop="isEditing = true"
        class="text-xs font-medium text-zinc-300 hover:text-zinc-100 pointer-events-auto cursor-text transition-colors drop-shadow-md"
      >
        <Heart v-if="data.is_favorites" fill="currentColor" class="inline-block w-3.5 h-3.5 mr-1 text-rose-500 align-[-2px]" />
        {{ data.label || '视频节点' }}
      </span>
      <input
        v-else
        v-model="title"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        class="text-xs font-medium bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded outline-none border border-rose-500 w-24 pointer-events-auto"
        autofocus
      />
    </div>

    <!-- Action Toolbar -->
    <div v-if="!flowHasMultiSelection" class="node-toolbar-wrap" :class="{ active: selected }" @dblclick.stop>
      <div v-if="canRecordActions" class="tb-btn" :class="{ 'tb-active': data.is_favorites }" :title="data.is_favorites ? '取消收藏' : '收藏'" @click="handleToggleFavorite">
        <Heart class="w-4 h-4" :class="{ 'text-rose-500': data.is_favorites }" :fill="data.is_favorites ? 'currentColor' : 'none'" />
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
      <div v-if="canRepairNode" class="tb-btn tb-repair" :title="repairing ? '修复中' : '修复'" @click="handleRepair">
        <Loader2 v-if="repairing" class="w-4 h-4 animate-spin" />
        <Wand2 v-else class="w-4 h-4" />
      </div>
      <div v-if="canRebuildUpstream" class="tb-btn" title="重建上游节点" @click="handleRebuildUpstream">
        <ChevronsLeft class="w-4 h-4" />
      </div>
      <div v-if="canGenerationActions || canRepairNode || canRebuildUpstream" class="tb-divider"></div>
      <div v-if="displayVideo && (data.mediaType === 'video' || (!data.mediaType && data.videoUrl))" class="tb-btn" title="截取当前帧" @click="captureCurrentFrame">
        <Camera class="w-4 h-4" />
      </div>
      <div v-if="upstreamMediaNodes.length >= 2 || (upstreamMediaNodes.length > 0 && displayVideo)" class="relative" @mouseleave="showCompareMenu = false; if (!activeCompareMedia) compareBaseMedia = null">
        <div class="tb-btn" title="与上游对比" @click="upstreamMediaNodes.length === 1 && displayVideo ? handleCompareDirect(upstreamMediaNodes[0]) : showCompareMenu = !showCompareMenu">
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
      <div v-if="data.recordId && displayVideo" class="tb-btn" title="编辑" @click="handleOpenEditor">
        <SlidersHorizontal class="w-4 h-4" />
      </div>
      <div class="tb-btn" title="详情" @click="onDoubleClick">
        <Maximize2 class="w-4 h-4" />
      </div>
      <div v-if="canUploadFromToolbar" class="tb-btn" title="上传文件" @click="triggerFileInput">
        <Upload class="w-4 h-4" />
      </div>
      <div v-if="displayVideo" class="tb-btn" title="另存为" @click="handleDownload">
        <Download class="w-4 h-4" />
      </div>
      <div
        v-if="displayVideo"
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
        isDragging ? 'ring-2 ring-rose-500 bg-rose-500/10' : ''
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
          class="flex-1 flex flex-col items-center justify-center relative group/video min-h-0 h-full"
          :class="flowUltraLightNodeMode ? 'bg-[#18181b]/92' : 'bg-[#18181b]'"
        >
          <template v-if="flowUltraLightNodeMode">
            <div class="w-full h-full relative">
              <div
                class="absolute inset-[10px] rounded-none border border-dashed bg-zinc-900/80"
                :class="selected ? 'border-zinc-200/70 shadow-[0_0_0_1px_rgba(244,244,245,0.18),0_8px_24px_rgba(15,23,42,0.22)]' : 'border-zinc-300/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'"
              ></div>
              <div class="absolute inset-0 flex items-center justify-center text-zinc-500 pointer-events-none">
                <component :is="data.mediaType === 'image' ? ImageIcon : Video" class="w-8 h-8 opacity-60" />
              </div>
            </div>
          </template>
          <div v-else-if="!flowLightweightNodeMode && data.uploadStatus === 'uploading'" class="upload-badge upload-badge-loading">
            <Loader2 class="w-3 h-3 animate-spin" />
            <span>上传中</span>
          </div>
          <div v-else-if="!flowLightweightNodeMode && data.uploadStatus === 'local'" class="upload-badge" :title="data.uploadError || '上传失败，当前使用本地预览'">
            本地预览
          </div>
          <template v-if="shouldUseThumbCardPreview">
            <VideoThumbnailPreview
              :src="displayVideoThumb"
              :media-type="data.mediaType"
              @preview="onDoubleClick"
            />
          </template>

          <template v-else-if="displayVideo && shouldRenderVideoMedia && data.mediaType === 'audio'">
              <div class="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer" @dblclick.stop="onDoubleClick">
                <div class="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center transition-all duration-300" :class="{ 'scale-110 bg-rose-500/20': isPlaying }">
                  <Music class="w-6 h-6 text-rose-500/80" :class="{ 'animate-pulse': isPlaying }" />
                </div>
                <span class="text-xs text-zinc-500">{{ isPlaying ? '正在播放...' : '悬停播放音频' }}</span>
              </div>
              <audio ref="audioRef" :src="displayVideo" class="hidden" loop @timeupdate="onTimeUpdate"></audio>
          </template>

          <template v-else-if="displayVideo && shouldRenderVideoMedia">
            <PanoramaViewer
              v-if="data.is360"
              ref="panoramaViewerRef"
              :src="displayVideo"
              class="w-full h-full"
              @dblclick.stop="onDoubleClick"
            />
            <video
              v-else
              ref="videoRef"
              :src="displayVideo"
              class="w-full h-full object-cover cursor-pointer"
              loop
              muted
              playsinline
              @timeupdate="onTimeUpdate"
              @dblclick.stop="onDoubleClick"
            ></video>
          </template>

            <!-- Progress Bar with Markers -->
            <div
              v-if="shouldShowPlaybackControls"
              v-show="!flowLightweightNodeMode"
              ref="progressBarRef"
              class="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/80 cursor-pointer hover:h-2.5 transition-all group/progress z-10"
              @mousedown.stop="startScrubbing"
              @dblclick.stop
            >
              <div class="h-full bg-rose-500 relative" :style="{ width: `${progress}%` }">
                <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 shadow scale-50 group-hover/progress:scale-100 transition-all translate-x-1.5"></div>
              </div>
              <div
                v-for="marker in data.markers || []" :key="marker.id"
                class="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-ew-resize hover:scale-x-[2.5] transition-transform origin-center shadow-sm"
                :style="{ left: `${marker.percentage}%`, transform: 'translateX(-50%)' }"
                title="拖拽调整标记位置，在目标位置点击截帧更新"
                @mousedown.stop="startDraggingMarker($event, marker)"
              ></div>
            </div>

          <button
            v-else-if="displayVideo"
            type="button"
            class="w-full h-full border-0 bg-transparent cursor-pointer flex flex-col items-center justify-center gap-2 text-zinc-500 px-4"
            @dblclick.stop="onDoubleClick"
          >
            <component :is="data.mediaType === 'image' ? ImageIcon : Video" class="w-8 h-8 opacity-50" />
          </button>

          <div
            v-else-if="data._suppressEmptyMediaPlaceholderIcon"
            class="w-full h-full"
          ></div>

          <div v-else class="w-full h-full relative flex flex-col items-center justify-center gap-2 text-zinc-500">
            <div
              class="absolute inset-[12px] rounded-none border border-dashed border-zinc-600/70 bg-zinc-900/35"
              :class="selected ? 'border-zinc-300/80 shadow-[0_0_0_1px_rgba(244,244,245,0.14)]' : 'border-zinc-600/70'"
            ></div>
            <Video class="w-8 h-8 opacity-60 relative z-[1]" />
          </div>

          <!-- Loading Overlay -->
          <div v-if="data.isGenerating" class="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 class="w-8 h-8 text-rose-500 animate-spin mb-3" />
            <span class="text-sm text-rose-400 font-medium">
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

        <div
          v-if="shouldShowPlaybackControls && !flowLightweightNodeMode"
          class="video-node-bottom-controls flex items-center justify-center py-1.5 opacity-0 group-hover/video-node:opacity-100 transition-opacity"
          @mousedown.stop
          @dblclick.stop
        >
          <div class="ctrl-btn" title="上一帧 (A)" @click="stepFrame(false)">
            <ChevronLeft class="w-3.5 h-3.5" />
          </div>
          <div class="ctrl-btn" :class="{ 'ctrl-active': isPlaying }" :title="isPlaying ? '暂停' : '播放'" @click="togglePlay">
            <Pause v-if="isPlaying" class="w-3.5 h-3.5" />
            <Play v-else class="w-3.5 h-3.5" />
          </div>
          <div class="ctrl-btn" title="下一帧 (D)" @click="stepFrame(true)">
            <ChevronRight class="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

    </div>

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
  order: -1;
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
.ctrl-btn {
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
  background: rgba(24, 24, 27, 0.85);
  border: 1px solid #3f3f46;
}
.ctrl-btn:hover {
  color: white;
  background: #3f3f46;
}
.ctrl-btn.ctrl-active {
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.15);
  border-color: rgba(244, 63, 94, 0.3);
}
.tb-divider {
  width: 1px;
  height: 16px;
  background: #52525b;
  margin: 0 2px;
  flex-shrink: 0;
}

.upload-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid rgba(244, 63, 94, 0.28);
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.78);
  color: #fda4af;
  font-size: 11px;
  line-height: 1.2;
  pointer-events: auto;
  backdrop-filter: blur(8px);
}

.upload-badge-loading {
  border-color: rgba(244, 63, 94, 0.36);
  color: #fecdd3;
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
