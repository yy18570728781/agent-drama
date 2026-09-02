<template>
  <div
    ref="panelRootRef"
    class="workflow-generation-panel"
    :class="{ 'is-readonly': props.readOnly }"
    :style="style"
    :aria-readonly="props.readOnly || undefined"
    @click.capture="guardReadonlyInteraction"
    @pointerdown.capture="guardReadonlyInteraction"
    @keydown.capture="guardReadonlyInteraction"
    @paste.capture="guardReadonlyInteraction"
    @drop.capture="guardReadonlyInteraction"
  >
    <GeneratorInput
      ref="generatorRef"
      :embedded="true"
      :compact="true"
      :embedded-mode-row="true"
      :disable-queue="true"
      :flow-node-id="node?.id"
      :show-panel-controls="false"
      :skip-u-i-remember="true"
      :disable-reference-remember="true"
      :locked-capability="lockedCapability"
      :external-single-file-batch-mode="singleFileBatch.enabled.value"
      :external-send-override="handleExternalSendOverride"
      ui-remember-key="infinite_canvas_workflow_ui_remember"
      cap-model-remember-key="infinite_canvas_workflow_cap_model_remember"
      @generate-start="onGenerateStart"
      @queue-task-assigned="onQueueTaskAssigned"
      @generate-created="onGenerateCreated"
      @generate-progress="onGenerateProgress"
      @generate-complete="onGenerateComplete"
      @generate-error="onGenerateError"
      @capability-change="onCapabilityChange"
      @mode-row-state-change="onModeRowStateChange"
      @request-payload-change="handleRequestPayloadChange"
      @before-remove-reference="onBeforeRemoveReference"
      @files-dropped="onFilesDropped"
      @remove-upstream="handleRemoveUpstream"
      @clipboard-reference-pasted="onClipboardReferencePasted"
      @reference-url-updated="(oldUrl, newUrl) => emit('reference-url-updated', oldUrl, newUrl)"
    >
      <template #mode-row-prefix="{ multilineBatchMode, smartMultiFrameEnabled, setMultilineBatchMode, setSmartMultiFrameEnabled }">
        <button
          class="cap-tab panel-batch-toggle"
          :class="{ active: singleFileBatch.enabled.value, muted: !singleFileBatch.canUse.value }"
          type="button"
          :aria-pressed="singleFileBatch.enabled.value"
          @click="handleBatchModeToggle(multilineBatchMode, smartMultiFrameEnabled, setMultilineBatchMode, setSmartMultiFrameEnabled)"
        >
          <Check v-if="singleFileBatch.enabled.value" :size="13" :stroke-width="2.4" />
          <span>单文件批量</span>
        </button>
      </template>
      <template #top-toolbar="{ isTextExpanded }">
        <GeneratorTopToolbar
          class="panel-actions"
          :is-text-expanded="isTextExpanded"
          :screenshot-capturing="false"
          :screenshot-menu-visible="screenshotMenuVisible"
          :show-screenshot="true"
          :show-text-expand="true"
          :show-sync-upstream="true"
          :show-collapse-panel="false"
          :show-close="true"
          @request-preferred-screenshot="requestPreferredClientScreenshot"
          @request-screenshot-mode="requestClientScreenshotByMode"
          @update:screenshot-menu-visible="screenshotMenuVisible = $event"
          @toggle-text-expanded="toggleTextExpanded"
          @sync-upstream="$emit('sync-upstream')"
          @close-panel="$emit('close')"
        />
      </template>
    </GeneratorInput>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import GeneratorInput from '@/components/generation/GeneratorInput.vue'
import GeneratorTopToolbar from '@/components/generation/GeneratorTopToolbar.vue'
import { Check } from '@/components/common/icon/lucide'
import { useSingleFileBatchMode } from '@/composables/generation/useSingleFileBatchMode'
import { appendDebugFileLog } from '@/utils/debugFileLog'
import { isWorkflowGenerationResultNode } from '@/utils/workflowGenerationResultNode'
import { useWorkflowPreGenerateReferenceCompression } from './useWorkflowPreGenerateReferenceCompression'
import { useWorkflowGenerationPanelSetup } from './useWorkflowGenerationPanelSetup'
import { resolveWorkflowBatchContext, resolveWorkflowOrdinaryContext } from './workflowGenerationContexts'
import { syncGeneratorReferencesFromCurrentEdges } from './workflowGenerationReferenceSync'
import type { WorkflowGenerationPanelProps, WorkflowGenerationPanelEmits } from './workflowGenerationPanel/types'

const props = defineProps<WorkflowGenerationPanelProps>()
const emit = defineEmits<WorkflowGenerationPanelEmits>()
const flowCreateConnectedAssetNode = inject<((sourceNodeId: string, options: Record<string, unknown>) => { id: string; node: any } | null) | null>(
  'flowCreateConnectedAssetNode',
  null,
)
const { nodes, edges, findNode, updateNodeInternals } = useVueFlow()
const { exposed, ...bindings } = useWorkflowGenerationPanelSetup(props, emit, findNode)
const lockedCapability = computed(() => String(props.node?.data?.defaultCapability || '').trim() || undefined)
const {
  generatorRef,
  panelRootRef,
  closeFloatingOverlays,
  toggleTextExpanded,
  handleRemoveUpstream,
  onBeforeRemoveReference,
  onGenerateStart,
  onQueueTaskAssigned,
  onGenerateCreated,
  onGenerateProgress,
  onGenerateComplete,
  onGenerateError,
  onCapabilityChange,
  onRequestPayloadChange,
  onClipboardReferencePasted,
  onFilesDropped,
} = bindings
const referenceCompression = useWorkflowPreGenerateReferenceCompression({
  nodeRef: computed(() => props.node),
  generatorRef,
  nodes,
  edges,
  findNode,
  updateNodeInternals,
  createConnectedAssetNode: (sourceNodeId, options) => flowCreateConnectedAssetNode?.(sourceNodeId, options) || null,
})

const singleFileBatch = useSingleFileBatchMode({
  inputRef: generatorRef,
  onGenerateStart,
  onQueueTaskAssigned,
  onGenerateCreated,
  onGenerateProgress,
  onGenerateComplete,
  onGenerateError,
  flowNodeId: String(props.node?.id || '').trim(),
  resolveBatchContext: () => resolveWorkflowBatchContext(props.node, findNode),
  resolveOrdinaryContext: () => resolveWorkflowOrdinaryContext(props.node, findNode),
  shouldBlockSend: () => isWorkflowGenerationResultNode(props.node),
})

function guardReadonlyInteraction(event: Event): void {
  if (!props.readOnly) return
  const target = event.target
  if (target instanceof Element && target.closest('[aria-label="关闭"]')) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

// 上游接 batch_grid 或 group 聚合端口时，默认开启单文件批量模式；断开则关闭。
// 只在上下游关系发生变化时触发，用户中途手动切换不会被覆盖。
const upstreamIsBatchLike = computed(() => {
  const upstreamImages = Array.isArray(props.node?.data?._upstreamInputs?.images)
    ? props.node.data._upstreamInputs.images
    : []
  if (upstreamImages.some((item: any) => item?.groupAggregate)) return true
  const firstSourceNodeId = String(upstreamImages[0]?.nodeId || '').trim()
  if (!firstSourceNodeId) return false
  const upstreamNode = findNode(firstSourceNodeId)
  return upstreamNode?.type === 'batch_grid'
})
watch(upstreamIsBatchLike, (present) => {
  singleFileBatch.enabled.value = present
}, { immediate: true })
const screenshotMenuVisible = ref(false)

async function requestPreferredClientScreenshot(): Promise<void> {
  await generatorRef.value?.requestPreferredClientScreenshot?.()
}

async function requestClientScreenshotByMode(mode: 'hide-window' | 'keep-window'): Promise<void> {
  screenshotMenuVisible.value = false
  await generatorRef.value?.requestClientScreenshotByMode?.(mode)
}

async function handleExternalSendOverride(): Promise<boolean> {
  if (isWorkflowGenerationResultNode(props.node)) {
    appendDebugFileLog('flow-event', 'drop-result-node-send', {
      nodeId: props.node?.id,
      nodeType: props.node?.type,
      nodeKind: props.node?.data?.nodeKind,
    })
    return true
  }
  await syncGeneratorReferencesFromCurrentEdges({
    node: props.node,
    edges: edges.value,
    findNode,
    generator: generatorRef.value,
  })
  await nextTick()
  const readyToSend = await referenceCompression.ensureCompressedReferencesBeforeGenerate()
  if (!readyToSend) return true
  if (!singleFileBatch.enabled.value || !singleFileBatch.canUse.value || singleFileBatch.isSubmitting.value) {
    await generatorRef.value?.handleSend?.()
    return true
  }
  await singleFileBatch.send()
  return true
}

function handleBatchModeToggle(
  multilineBatchMode: boolean,
  smartMultiFrameEnabled: boolean,
  setMultilineBatchMode: (enabled: boolean) => void,
  setSmartMultiFrameEnabled: (enabled: boolean) => void,
): void {
  singleFileBatch.toggle(multilineBatchMode, smartMultiFrameEnabled, setMultilineBatchMode, setSmartMultiFrameEnabled)
}

function onModeRowStateChange(state: { multilineBatchMode: boolean; smartMultiFrameEnabled: boolean }): void {
  singleFileBatch.handleModeRowStateChange(state)
}

function handleRequestPayloadChange(payload: any): void {
  singleFileBatch.syncRequestPayload(payload)
  onRequestPayloadChange(payload)
}

defineExpose(exposed)
</script>

<style scoped>
.workflow-generation-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
  pointer-events: none;
}

.panel-actions {
  z-index: 20;
  pointer-events: auto;
}

.panel-batch-toggle.muted:not(.active) {
  opacity: 0.72;
}

/* 调整 GeneratorInput 在 embedded 模式下的样式 */
.workflow-generation-panel :deep(.generator-shell) {
  position: relative;
  margin: 0;
  pointer-events: auto;
}

.workflow-generation-panel.is-readonly :deep(.generator-shell),
.workflow-generation-panel.is-readonly :deep(.generator-shell *) {
  cursor: not-allowed !important;
}

.workflow-generation-panel.is-readonly :deep([aria-label="关闭"]),
.workflow-generation-panel.is-readonly :deep([aria-label="关闭"] *) {
  cursor: pointer !important;
}

.workflow-generation-panel.is-readonly :deep(.generator-submit),
.workflow-generation-panel.is-readonly :deep(.generator-submit.is-active:not(:disabled)) {
  background: #3f3f46;
  color: #71717a;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.82;
  transform: none;
}

.workflow-generation-panel.is-readonly :deep(.generator-count),
.workflow-generation-panel.is-readonly :deep(.toolbar-select-btn),
.workflow-generation-panel.is-readonly :deep(.panel-batch-toggle),
.workflow-generation-panel.is-readonly :deep(input),
.workflow-generation-panel.is-readonly :deep(select),
.workflow-generation-panel.is-readonly :deep(textarea) {
  cursor: not-allowed;
  filter: saturate(0.35);
}

.workflow-generation-panel.is-readonly :deep(.generator-count button),
.workflow-generation-panel.is-readonly :deep(.generator-count span),
.workflow-generation-panel.is-readonly :deep(.generator-config-footer__controls) {
  color: #71717a;
}

.workflow-generation-panel.is-readonly :deep(.prompt-editor) {
  color: #a1a1aa;
  caret-color: transparent;
  cursor: not-allowed;
}

.workflow-generation-panel.is-readonly :deep(button:not([aria-label="关闭"])) {
  cursor: not-allowed;
}

.workflow-generation-panel.is-readonly :deep(.generator-submit:hover),
.workflow-generation-panel.is-readonly :deep(.toolbar-select-btn:hover) {
  background-color: #3f3f46;
  transform: none;
}

@media (min-width: 721px) {
  .workflow-generation-panel :deep(.generator-config-footer--embedded-mode-row) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .workflow-generation-panel :deep(.generator-config-footer--embedded-mode-row .generator-config-footer__controls) {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .workflow-generation-panel :deep(.generator-config-footer--embedded-mode-row .generator-submit-cluster) {
    justify-self: end;
  }
}

</style>
