<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { DirectingProject, MannequinObject, ImagePlaneObject, CameraConfig, LightConfig, MannequinJoints } from '@/components/director-3d/director3D.types'
import { PosePreset } from '@/components/director-3d/director3D.constants'
import { useDirector3DProject, migrateLegacyJoints } from '@/composables/director-3d/useDirector3DProject'
import { createDefaultProject } from '@/components/director-3d/director3D.constants'
import { useDirector3DSelection } from '@/composables/director-3d/useDirector3DSelection'
import { useDirector3DHistory } from '@/composables/director-3d/useDirector3DHistory'
import { useDirector3DElementOps } from '@/composables/director-3d/useDirector3DElementOps'
import { useDirector3DCustomPresets } from '@/composables/director-3d/useDirector3DCustomPresets'
import Director3DHeader from '@/components/director-3d/Director3DHeader.vue'
import Director3DSidebarLeft from '@/components/director-3d/Director3DSidebarLeft.vue'
import Director3DSidebarRight from '@/components/director-3d/Director3DSidebarRight.vue'
import Director3DBottomToolbar from '@/components/director-3d/Director3DBottomToolbar.vue'
import Director3DCanvas from '@/components/director-3d/Director3DCanvas.vue'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  visible: boolean
  nodeRef: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'snapshotCreated', url: string): void
  (e: 'removeUpstream', sourceNodeId: string): void
  (e: 'requestPropagate'): void
}>()

const notification = ref<{ message: string; type: 'success' | 'info' } | null>(null)
const showToast = (message: string, type: 'success' | 'info' = 'success') => {
  notification.value = { message, type }
  setTimeout(() => notification.value = null, 3500)
}

const {
  project,
  loadSavedProject,
  handleSaveProject,
  handleResetProject: triggerResetProject,
} = useDirector3DProject(showToast, () => props.nodeRef?.id || '')

const {
  selectedElementId,
  selectedElementType,
  selectedJointKey,
  selectedElementIds,
  customEditorCamera,
  handleSelectElement,
  resetSelection,
} = useDirector3DSelection(project)

const {
  past,
  future,
  commitHistorySnapshot,
  handleUndo,
  handleRedo,
  clearHistory,
} = useDirector3DHistory(project, showToast)

const {
  handleUpdateMannequin,
  handleUpdateImage,
  handleUpdateCamera,
  handleUpdateLight,
  handleAddMannequin,
  handleAddCamera: triggerAddCamera,
  handleAddImagePlane,
  handleAddMannequinToGroup,
  handleRemoveMannequinFromGroup,
  handleDeleteElement,
  handleDeleteMultipleElements,
  resolveElementType,
  handleDistributionGenerate,
  handleApplyPresetPose,
} = useDirector3DElementOps(
  project,
  selectedElementId,
  commitHistorySnapshot,
  handleSelectElement,
  showToast,
)

const handleAddCamera = () => triggerAddCamera(customEditorCamera)

const {
  customPresets,
  isUploadingGlb,
  handleSaveCustomPreset,
  handleDeleteCustomPreset,
  handleUploadGlbFile,
} = useDirector3DCustomPresets(
  project,
  selectedElementId,
  selectedElementType,
  commitHistorySnapshot,
  showToast,
  handleAddMannequin,
)

const sidebarLeftCollapsed = ref(false)
const sidebarRightCollapsed = ref(false)
const showShortcuts = ref(false)
const exportTrigger = ref(0)
const resetModalVisible = ref(false)
const activeBottomPanel = ref<'add' | 'camera' | 'aspect' | null>(null)

const handleResetProject = () => {
  triggerResetProject(() => {
    resetSelection()
    clearHistory()
    resetModalVisible.value = false
  })
}

const handleRequestSnapshot = () => {
  exportTrigger.value += 1
  showToast('正在截图并上传生成 URL...', 'info')
}

const handleExportDone = (url: string) => {
  emit('snapshotCreated', url)
  showToast('截图已作为图片节点添加到画布', 'success')
}

const canvasRef = ref<InstanceType<typeof Director3DCanvas> | null>(null)

const handleClose = () => {
  initialized.value = false
  if (props.nodeRef) {
    props.nodeRef.data = props.nodeRef.data || {}
    props.nodeRef.data.directorProject = JSON.parse(JSON.stringify(project.value))
    try {
      const thumbnail = canvasRef.value?.generateThumbnail?.()
      if (thumbnail) props.nodeRef.data.thumbnail = thumbnail
    } catch {}
  }
  emit('close')
}

const handleDeleteWithUpstream = (id: string, type: 'mannequin' | 'camera' | 'image' | 'light' | 'group') => {
  if (type === 'image') {
    const img = project.value.imagePlanes.find(p => p.id === id)
    if (img?.upstreamNodeId) emit('removeUpstream', img.upstreamNodeId)
  } else if (type === 'mannequin') {
    const m = project.value.mannequins.find(m => m.id === id)
    if (m?.upstreamNodeId) emit('removeUpstream', m.upstreamNodeId)
  }
  handleDeleteElement(id, type)
}

const initialized = ref(false)
let isSyncingUpstream = false

const syncUpstreamInputs = (inputs: any) => {
  if (!inputs || isSyncingUpstream) return
  isSyncingUpstream = true
  try {
    const activeImgNodeIds = new Set<string>()
    let imagePlanesChanged = false
    for (const img of inputs.images || []) {
      if (!img.url) continue
      const planeUrl = img.url
      if (project.value.imagePlanes.some(p => p.url === planeUrl)) {
        activeImgNodeIds.add(img.nodeId)
        continue
      }
      const newImg: ImagePlaneObject = {
        id: `upstream_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: img.label || '工作流图片',
        url: planeUrl,
        position: { x: 0, y: 2.2, z: -4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 7, y: 4.5, z: 1 },
        visible: true,
        opacity: 0.85,
        renderMode: '3D',
        blendMode: 'normal',
        zIndex: 0,
        upstreamNodeId: img.nodeId,
      }
      project.value.imagePlanes = [...project.value.imagePlanes, newImg]
      activeImgNodeIds.add(img.nodeId)
      imagePlanesChanged = true
    }

    const removedImgs = project.value.imagePlanes.filter(
      p => p.upstreamNodeId && !activeImgNodeIds.has(p.upstreamNodeId)
    )
    if (removedImgs.length > 0) {
      const removedImgIds = new Set(removedImgs.map(r => r.id))
      project.value.imagePlanes = project.value.imagePlanes.filter(p => !removedImgIds.has(p.id))
      imagePlanesChanged = true
    }
    if (imagePlanesChanged) {
      showToast('已从工作流同步图片到 3D 场景', 'success')
    }

    const activeModelNodeIds = new Set<string>()
    for (const model of inputs.models3d || []) {
      if (!model.url) continue
      if (project.value.mannequins.some(m => m.glbUrl === model.url)) {
        activeModelNodeIds.add(model.nodeId)
        continue
      }
      const mannequinDefaults = {
        id: `upstream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: model.label || '3D模型',
        position: { x: Math.random() * 2 - 1, y: 0, z: Math.random() * 2 - 1 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#4cd137',
        visible: true,
        joints: {} as MannequinJoints,
        style: 'glb' as const,
        glbId: `upstream_${model.nodeId}`,
        glbUrl: model.url,
        upstreamNodeId: model.nodeId,
      }
      project.value.mannequins = [...project.value.mannequins, mannequinDefaults]
      activeModelNodeIds.add(model.nodeId)
      showToast(`已导入 3D 模型: ${model.label}`, 'success')
    }

    const removedModels = project.value.mannequins.filter(
      m => m.upstreamNodeId && !activeModelNodeIds.has(m.upstreamNodeId)
    )
    if (removedModels.length > 0) {
      const removedModelIds = new Set(removedModels.map(r => r.id))
      project.value.mannequins = project.value.mannequins.filter(m => !removedModelIds.has(m.id))
    }
  } finally {
    isSyncingUpstream = false
  }
}

watch(() => props.nodeRef?.data?._upstreamInputs, (inputs) => {
  if (!initialized.value || !inputs) return
  syncUpstreamInputs(inputs)
}, { deep: true, flush: 'post' })

watch(() => props.visible, (newVal) => {
  if (!newVal) {
    initialized.value = false
    return
  }
  emit('requestPropagate')
  const nodeData = props.nodeRef?.data?.directorProject
  if (nodeData) {
    const restored = JSON.parse(JSON.stringify(nodeData))
    migrateLegacyJoints(restored)
    project.value = restored
    nextTick(() => {
      initialized.value = true
      nextTick(() => {
        syncUpstreamInputs(props.nodeRef?.data?._upstreamInputs)
      })
    })
  } else {
    const restored = createDefaultProject()
    project.value = restored
    nextTick(() => {
      initialized.value = true
      nextTick(() => {
        syncUpstreamInputs(props.nodeRef?.data?._upstreamInputs)
      })
    })
  }
}, { immediate: true })

onMounted(() => {
  const handleGlobalHotkeys = (e: KeyboardEvent) => {
    const activeEl = document.activeElement
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true')
    ) {
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElementIds.value.length > 1) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const idsToDelete = [...selectedElementIds.value]
        idsToDelete.forEach(id => {
          const type = resolveElementType(id)
          if (type) handleDeleteWithUpstream(id, type)
        })
      } else if (selectedElementId.value && selectedElementType.value) {
        if (['mannequin', 'camera', 'image', 'light', 'group'].includes(selectedElementType.value)) {
          e.preventDefault()
          e.stopImmediatePropagation()
          handleDeleteWithUpstream(selectedElementId.value, selectedElementType.value as any)
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      e.stopImmediatePropagation()
      handleUndo()
    }

    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault()
      e.stopImmediatePropagation()
      handleRedo()
    }

    if (e.key.toLowerCase() === 'i') {
      e.preventDefault()
      if (selectedElementId.value && selectedElementType.value) {
        commitHistorySnapshot()
        const selId = selectedElementId.value
        const selType = selectedElementType.value
        if (selType === 'camera') {
          const cam = project.value.cameras.find((c: any) => c.id === selId)
          if (cam) handleUpdateCamera(selId, { visible: !cam.visible })
        } else if (selType === 'mannequin') {
          const m = project.value.mannequins.find((x: any) => x.id === selId)
          if (m) handleUpdateMannequin(selId, { visible: !m.visible })
        } else if (selType === 'image') {
          const img = project.value.imagePlanes.find((x: any) => x.id === selId)
          if (img) handleUpdateImage(selId, { visible: !img.visible })
        } else if (selType === 'light') {
          const l = project.value.lights.find((x: any) => x.id === selId)
          if (l) handleUpdateLight(selId, { visible: l.visible === false })
        }
      }
    }

    if (e.key.toLowerCase() === 'g') {
      e.preventDefault()
      project.value.hideHelpers = !project.value.hideHelpers
    }

    if (e.key.toLowerCase() === 'q' && customEditorCamera.value) {
      e.preventDefault()
      project.value.selectionMode = !project.value.selectionMode
    }

    if (e.key === 'Escape') {
      handleClose()
    }
  }

  window.addEventListener('keydown', handleGlobalHotkeys, true)
  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalHotkeys, true)
  })
})

const getActiveCamera = () => {
  return project.value.cameras.find(c => c.id === project.value.activeCameraId) || project.value.cameras[0]
}

const handleOpenCameraMonitor = () => {
  if (!customEditorCamera.value) {
    customEditorCamera.value = true
    return
  }
  const firstVisibleCam = project.value.cameras.find(c => c.visible !== false)
  if (firstVisibleCam) {
    project.value.activeCameraId = firstVisibleCam.id
  }
  customEditorCamera.value = false
}
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="visible" class="fixed inset-0 z-[99999]">
      <div class="h-screen w-screen flex flex-col bg-[#06080a] text-gray-200 overflow-hidden font-sans relative antialiased select-none">
        <Director3DHeader
          :project="project"
          :showShortcuts="showShortcuts"
          :customEditorCamera="customEditorCamera"
          @change-view-mode="project.viewMode = $event"
          @open-camera-monitor="handleOpenCameraMonitor"
          @save-project="handleSaveProject"
          @reset-project="resetModalVisible = true"
          @toggle-shortcuts="showShortcuts = !showShortcuts"
        />

        <div class="flex-grow flex relative overflow-hidden">
          <Director3DSidebarLeft
            v-if="!sidebarLeftCollapsed"
            :project="project"
            :selectedElementId="selectedElementId"
            :selectedElementType="selectedElementType"
            :selectedElementIds="selectedElementIds"
            @update-selected-element-ids="selectedElementIds = $event"
            @select-element="handleSelectElement"
            @update-mannequin="handleUpdateMannequin"
            @update-camera="handleUpdateCamera"
            @update-image="handleUpdateImage"
            @update-light="handleUpdateLight"
            @delete-element="handleDeleteWithUpstream"
            @update-project="project = $event"
          />

          <main class="flex-grow flex flex-col relative h-full bg-[#0d0f12] min-w-0 min-h-0">
            <div class="w-full flex-grow relative min-w-0 min-h-0" id="threejs-canvas-wrapper">
              <Director3DCanvas
                ref="canvasRef"
                :project="project"
                :selectedElementId="selectedElementId"
                :selectedElementType="selectedElementType"
                :exportTrigger="exportTrigger"
                :customEditorCamera="customEditorCamera"
                :selectedJointKey="selectedJointKey"
                :hideHelpers="project.hideHelpers ?? false"
                :selectionMode="project.selectionMode ?? false"
                @select-element="handleSelectElement"
                @exit-selection-mode="project.selectionMode = false"
                @export-done="handleExportDone"
                @change-custom-editor-camera="customEditorCamera = $event"
                @change-selected-joint-key="selectedJointKey = $event"
                @update-project="project = $event"
                @commit-history-state="commitHistorySnapshot"
                @viewport-click="activeBottomPanel = null"
              />

              <template v-if="project.viewMode === '3D'">
                <div
                  role="button" tabindex="0"
                  @click="sidebarLeftCollapsed = !sidebarLeftCollapsed"
                  @keydown.enter.prevent="sidebarLeftCollapsed = !sidebarLeftCollapsed"
                  @keydown.space.prevent="sidebarLeftCollapsed = !sidebarLeftCollapsed"
                  class="absolute left-2 top-1/2 -translate-y-1/2 z-35 h-16 w-4 bg-[#111318]/90 hover:bg-[#111318] text-gray-400 hover:text-white rounded-md flex items-center justify-center border border-white/10 shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <Icon :icon="sidebarLeftCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'" :width="12" :height="12" />
                </div>

                <div
                  role="button" tabindex="0"
                  @click="sidebarRightCollapsed = !sidebarRightCollapsed"
                  @keydown.enter.prevent="sidebarRightCollapsed = !sidebarRightCollapsed"
                  @keydown.space.prevent="sidebarRightCollapsed = !sidebarRightCollapsed"
                  class="absolute right-2 top-1/2 -translate-y-1/2 z-35 h-16 w-4 bg-[#111318]/90 hover:bg-[#111318] text-gray-400 hover:text-white rounded-md flex items-center justify-center border border-white/10 shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <Icon :icon="sidebarRightCollapsed ? 'lucide:chevron-left' : 'lucide:chevron-right'" :width="12" :height="12" />
                </div>
              </template>

              <div v-if="project.viewMode === '3D'" class="absolute top-4 right-4 flex flex-col items-end gap-2.5 z-30 pointer-events-auto">
                <div
                  role="button" tabindex="0"
                  @click="project.showSubViewer = !project.showSubViewer"
                  @keydown.enter.prevent="project.showSubViewer = !project.showSubViewer"
                  @keydown.space.prevent="project.showSubViewer = !project.showSubViewer"
                  :class="['px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-mono cursor-pointer border', project.showSubViewer ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 font-semibold' : 'bg-black/80 hover:bg-black/95 text-gray-300 border-white/10 hover:text-white']"
                  title="开启最终合成机位副窗口监视器"
                >
                  <span :class="['w-1.5 h-1.5 rounded-full', project.showSubViewer ? 'bg-indigo-400 animate-pulse' : 'bg-gray-500']" />
                  <span>PIP 副屏</span>
                </div>

                <div
                  v-if="project.showSubViewer && customEditorCamera && getActiveCamera()"
                  class="w-72 aspect-video bg-black/95 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-white/10 group hover:border-indigo-500/50 transition-all duration-300 relative"
                  id="floating-pip-monitor"
                >
                  <canvas id="pip-canvas" class="w-full h-full block absolute inset-0 text-white" />
                  <div
                    role="button" tabindex="0"
                    @click="project.showSubViewer = false"
                    @keydown.enter.prevent="project.showSubViewer = false"
                    @keydown.space.prevent="project.showSubViewer = false"
                    class="absolute top-2 right-2 w-4 h-4 bg-black/70 hover:bg-black/95 text-[8px] text-gray-400 hover:text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow border border-white/5 active:scale-95"
                    title="关闭副窗口监视器"
                  >
                    ✕
                  </div>
                </div>
              </div>
            </div>

            <Director3DBottomToolbar
              :project="project"
              :customEditorCamera="customEditorCamera"
              :canUndo="past.length > 0"
              :canRedo="future.length > 0"
              :isUploadingGlb="isUploadingGlb"
              :activePanel="activeBottomPanel"
              @change-custom-editor-camera="customEditorCamera = $event"
              @add-mannequin="handleAddMannequin"
              @add-camera="handleAddCamera"
              @add-image-plane="handleAddImagePlane"
              @distribution-generate="handleDistributionGenerate"
              @commit-history="commitHistorySnapshot"
              @undo="handleUndo"
              @redo="handleRedo"
              @update-project="project = $event"
              @trigger-export="handleRequestSnapshot"
              @upload-glb="handleUploadGlbFile"
              @change-active-panel="activeBottomPanel = $event"
            />
          </main>

          <Director3DSidebarRight
            v-if="project.viewMode === '3D' && !sidebarRightCollapsed"
            :project="project"
            :selectedElementId="selectedElementId"
            :selectedElementType="selectedElementType"
            :selectedJointKey="selectedJointKey"
            :customPresets="customPresets"
            @change-selected-joint-key="selectedJointKey = $event"
            @update-project="project = $event"
            @select-element="handleSelectElement"
            @commit-history="commitHistorySnapshot"
            @apply-preset-pose="handleApplyPresetPose"
            @update-mannequin="handleUpdateMannequin"
            @update-image="handleUpdateImage"
            @update-camera="handleUpdateCamera"
            @update-light="handleUpdateLight"
            @delete-element="handleDeleteWithUpstream"
            @add-mannequin-to-group="handleAddMannequinToGroup"
            @remove-mannequin-from-group="handleRemoveMannequinFromGroup"
            @save-custom-preset="handleSaveCustomPreset"
            @delete-custom-preset="handleDeleteCustomPreset"
          />
        </div>

        <!-- Reset Confirmation Modal -->
        <div v-if="resetModalVisible" class="fixed inset-0 bg-black/85 flex items-center justify-center p-6 z-50 animate-fade-in" id="reset-confirm-overlay">
          <div class="bg-[#0e1116] border border-white/10 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div class="space-y-1.5 text-center">
              <span class="text-2xl">⚠️</span>
              <h4 class="text-sm font-semibold text-white">确定要恢复默认电影画板配置吗？</h4>
              <p class="text-[11px] text-gray-500">这将会彻底擦除当前舞台内所有人体骨节、底片贴图以及摄像机位坐标，本地 localStorage 缓存也将被彻底覆写，此操作绝不可逆！</p>
            </div>
            <div class="flex gap-2 text-xs font-bold pt-1">
              <div role="button" tabindex="0" @click="resetModalVisible = false" @keydown.enter.prevent="resetModalVisible = false" @keydown.space.prevent="resetModalVisible = false" class="flex-1 text-center py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 border border-white/5 cursor-pointer">
                取消
              </div>
              <div role="button" tabindex="0" @click="handleResetProject" @keydown.enter.prevent="handleResetProject" @keydown.space.prevent="handleResetProject" class="flex-1 text-center py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-semibold cursor-pointer">
                确定清空
              </div>
            </div>
          </div>
        </div>

        <!-- Keyboard Shortcuts Modal -->
        <div v-if="showShortcuts" class="fixed bottom-20 right-6 w-80 bg-[#090b0e] border border-white/10 rounded-xl p-4 shadow-2xl z-50 text-left animate-fade-in divide-y divide-white/5">
          <div class="pb-2.5">
            <h4 class="text-xs font-bold text-white mb-0.5">⚙️ 场景操纵快捷键面板</h4>
            <p class="text-[10px] text-gray-500">掌握快照和交互姿势可以极大学术成倍效率：</p>
          </div>
          <div class="py-2.5 space-y-2 border-t border-white/5 text-[10px] text-gray-400 font-mono">
            <div class="flex justify-between"><span>[W] 变换调节器</span><kbd class="bg-white/5 px-2 py-0.5 rounded border border-white/10 text-white text-[9px]">位移 Mode</kbd></div>
            <div class="flex justify-between"><span>[E] 变换调节器</span><kbd class="bg-white/5 px-2 py-0.5 rounded border border-white/10 text-white text-[9px]">旋转 Mode</kbd></div>
            <div class="flex justify-between"><span>[R] 变换调节器</span><kbd class="bg-white/5 px-2 py-0.5 rounded border border-white/10 text-white text-[9px]">缩放 Mode</kbd></div>
            <div class="flex justify-between"><span>[Delete] 场景删除</span><kbd class="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white text-[9px]">删除选中项</kbd></div>
            <div class="flex justify-between"><span>[双击人偶] 穿透细节</span><kbd class="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white text-[9px]">精确锁定骨节</kbd></div>
            <div class="flex justify-between"><span>[Shift + 拖曳] 空间</span><kbd class="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white text-[9px]">视角平移 Pan</kbd></div>
          </div>
          <div role="button" tabindex="0" @click="showShortcuts = false" @keydown.enter.prevent="showShortcuts = false" @keydown.space.prevent="showShortcuts = false" class="w-full text-center py-1.5 text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-lg mt-2 cursor-pointer border border-white/5 font-sans">
            完成了解
          </div>
        </div>

        <!-- Toast Notification -->
        <div v-if="notification" :class="['fixed bottom-24 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-xl border text-xs shadow-2xl z-50 flex items-center gap-1.5 animate-bounce backdrop-blur', notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300']">
          <span>{{ notification.message }}</span>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.25s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0; }
</style>
