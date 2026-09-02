<script setup lang="ts">
import { computed, useSlots } from 'vue'
import GeneratorCollapsedBar from './GeneratorCollapsedBar.vue'
import GeneratorComposerHeader from './GeneratorComposerHeader.vue'
import GeneratorConfigFooter from './GeneratorConfigFooter.vue'
import GeneratorPromptWorkspace from './GeneratorPromptWorkspace.vue'
import PromptPresetPopover from './PromptPresetPopover.vue'
import GeneratorStatusOverlay from './GeneratorStatusOverlay.vue'
import GeneratorSubmitCluster from './GeneratorSubmitCluster.vue'
import { useGeneratorHeightResize } from '@/composables/generation/useGeneratorHeightResize'
import { useGeneratorInputController } from '@/composables/generation/useGeneratorInputController'
import type { GeneratorInputEmits, GeneratorInputProps } from './generatorInput.types'

const props = withDefaults(defineProps<GeneratorInputProps>(), {
  capModelRememberKey: 'infinite_canvas_cap_model_remember', compact: false, debugSource: '',
  disableQueue: false, disableReferenceRemember: false, embedded: false,
  embeddedModeRow: false, externalSendOverride: null, externalSingleFileBatchMode: false,
  heightResize: false,
  isGenerating: false, showPanelControls: true, skipUIRemember: false,
  uiRememberKey: 'infinite_canvas_ui_remember',
})
const emit = defineEmits<GeneratorInputEmits>()
const slots = useSlots()
const { mode, runtime, workspace } = useGeneratorInputController(props, emit)

const {
  allowGenerateCountLabel, allowGenerateCountMax, allowGenerateCountMin, allowGenerateCountValue,
  availableModes, batchItems, canClickGenerateButton, currentModeName, fileParamMaxItems,
  hasFileParam, hasPromptParam, isBatchMode, isSmartMode,
  modelParams, multilineBatchMode, onCapabilityBarChangeWrapper, onIconError,
  onModelSelect, onParamChangeWrapper, onReloadCurrentModelWrapper, paramValues,
  promptParamSchema, refMaxItemsWarning, selectedCapability, selectedMode, selectedModelId, selectedModelInfo,
  selectedSkillId, setCapability, setModelCapability, showAllowGenerateCount, showModeDropdown,
  stepAllowGenerateCount, autoSwitchToFileMode, enterBatchMode, exitBatchMode,
} = mode
const {
  batch, clearAllReferenceImages, containerRef, expandedPanelRef, ingress, isExpanded,
  isTextExpanded, onReferenceUrlUpdated, persistence, prompt, reference, workspaceRef,
} = workspace
const { multiline, smart, smartMultiFrameEnabled, setMultilineBatchMode } = batch
const {
  clearAllMultilinePromptRows, onApplyPreset, onApplyPresetBatch,
} = batch
const {
  addMultilinePromptRow, multilinePromptRows, removeMultilinePromptRow,
  updateMultilinePromptRowPrompt, updateMultilinePromptRowReferences,
} = multiline
const {
  editableParams: smartMultiFrameParams, effectiveFileParamDef, referenceMaxItemsOverride,
  setSmartMultiFrameEnabled, smartMultiFrameAvailable, smartMultiFrameRows,
  updateRowParam, updateRowPrompt,
} = smart
const {
  handleReferencePreview, onSelectSubject, uiRememberRefImages,
} = reference
const {
  addReferenceMedia, addReferenceMediaAt, onRefImageRemove,
  onReferenceAutoCollapseChange, refImages, setReferenceMedia,
} = reference.manager
const {
  expandedDrop, onExpandedPanelDrop, onExpandedPanelDropCapture, onReferenceAreaFilesDropped,
} = ingress
const { isDragging: isDropActive, onExternalDragLeave, onExternalDragOver } = expandedDrop
const { saveUIRemember } = persistence.remember
const { actions, lifecycle, model, points, screenshot, scroll, skills, submission, view } = runtime
const { closeFloatingOverlays, collapsePanel, toggleTextExpanded } = actions
const { resetForRestore, restoreState } = lifecycle
const {
  handleModeSelect, handleModelSelectKeepReferences, isGigaModel, isTvaiModel,
  isTvaiProcModel, onSkillSelect, selectedSkillName, tvaiModelType,
} = model
const {
  displayGroupPoints, displayReservePoints, displayUserPoints, pointInfoTooltip,
  pointInfoVisible, showGroupPoints, showReservePoints, showUserPoints,
} = points
const {
  requestClientScreenshotByMode, requestPreferredClientScreenshot,
  screenshotCapturing, screenshotMenuVisible,
} = screenshot
const { isAtBottom, scrollToBottom } = scroll
const { collapsedSummary, promptPlaceholder, publisherIcon } = view
const { generatingCards, handleSend } = submission.dispatch
const { handleSendClick } = submission

const hasTopToolbarSlot = computed(() => !!slots['top-toolbar'])
const canSubmit = computed(() => {
  if (props.externalSingleFileBatchMode) return true
  if (!canClickGenerateButton.value || (!isSmartMode.value && !selectedModelId.value.trim())) return false
  if (isBatchMode.value) return batchItems.value.length > 0
  if (smartMultiFrameEnabled.value) return refImages.value.length >= 2
  if (multilineBatchMode.value) {
    return multilinePromptRows.value.some((row) => !!row.prompt.trim())
  }
  const fileDefinition = effectiveFileParamDef.value
  const minimumFiles = Math.max(1, Number(fileDefinition?.min_items || 1))
  if (fileDefinition?.required && refImages.value.length < minimumFiles) return false
  if (promptParamSchema.value?.required && !prompt.value.trim()) return false
  return true
})
const headerProps = computed(() => ({
  capability: selectedCapability.value, hasPromptParam: hasPromptParam.value,
  isTextExpanded: isTextExpanded.value, lockedCapability: props.lockedCapability,
  multilineBatchMode: multilineBatchMode.value, screenshotCapturing: screenshotCapturing.value,
  screenshotMenuVisible: screenshotMenuVisible.value, selectedModelInfo: selectedModelInfo.value,
  showCapabilitySelector: true, showClose: false, showCollapsePanel: !props.embedded && props.showPanelControls,
  showScreenshot: !props.embedded, showSyncUpstream: false,
  showTextExpand: !props.embedded, showTopToolbar: !props.embedded,
  smartMultiFrameAvailable: smartMultiFrameAvailable.value,
  smartMultiFrameEnabled: smartMultiFrameEnabled.value,
}))
const workspaceProps = computed(() => ({
  batchItemCount: batchItems.value.length, batchMode: isBatchMode.value, embedded: !!props.embedded,
  fileParamDef: effectiveFileParamDef.value, hasFileParam: hasFileParam.value,
  hasPromptParam: hasPromptParam.value,
  maxItems: referenceMaxItemsOverride.value ?? fileParamMaxItems.value,
  maxItemsWarning: smartMultiFrameEnabled.value ? '' : refMaxItemsWarning.value,
  modelInfo: selectedModelInfo.value, multilineMode: multilineBatchMode.value,
  multilineRows: multilinePromptRows.value, placeholder: promptPlaceholder.value,
  prompt: prompt.value, promptBelowReference: hasFileParam.value, refImages: refImages.value,
  smartEnabled: smartMultiFrameEnabled.value, smartParams: smartMultiFrameParams.value,
  smartRows: smartMultiFrameRows.value, textExpanded: isTextExpanded.value,
}))
const footerProps = computed(() => ({
  availableModes: availableModes.value, capability: selectedCapability.value,
  currentModeName: currentModeName.value, isGigaModel: isGigaModel.value,
  embeddedModeRow: !!(props.embeddedModeRow && showModeDropdown.value),
  isSmartMode: isSmartMode.value, isTvaiModel: isTvaiModel.value,
  isTvaiProcModel: isTvaiProcModel.value, lockedCapability: props.lockedCapability,
  modelId: selectedModelId.value, modelInfo: selectedModelInfo.value,
  modelParams: modelParams.value, paramValues: paramValues.value, publisherIcon: publisherIcon.value,
  refImages: refImages.value, selectedMode: selectedMode.value,
  selectedSkillId: selectedSkillId.value, selectedSkillName: selectedSkillName.value,
  showModeDropdown: showModeDropdown.value, skills: skills.value, tvaiModelType: tvaiModelType.value,
}))
const submitProps = computed(() => ({
  canSend: canSubmit.value, countLabel: allowGenerateCountLabel.value,
  countMax: allowGenerateCountMax.value, countMin: allowGenerateCountMin.value,
  countValue: allowGenerateCountValue.value, displayGroupPoints: displayGroupPoints.value,
  displayReservePoints: displayReservePoints.value, displayUserPoints: displayUserPoints.value,
  isGenerating: !!props.isGenerating, pointInfoTooltip: pointInfoTooltip.value,
  pointInfoVisible: pointInfoVisible.value,
  showCount: showAllowGenerateCount.value && !multilineBatchMode.value && !props.externalSingleFileBatchMode,
  showGroupPoints: showGroupPoints.value, showReservePoints: showReservePoints.value,
  showUserPoints: showUserPoints.value,
}))
const statusProps = computed(() => ({
  cards: generatingCards.value, showBackToBottom: !isAtBottom.value && !isExpanded.value,
  showGeneratingCards: !isExpanded.value && !!props.isGenerating,
}))
const { heightResizeBinding, heightResizeClasses, heightResizeStyle } = useGeneratorHeightResize({
  getOptions: (): GeneratorInputProps['heightResize'] => props.heightResize,
  isExpanded,
  isTextExpanded,
  onResizeEnd: (height: number): void => emit('height-resize-end', height),
})
const stackClasses = computed(() => ({
  ...heightResizeClasses.value,
  'is-collapsed': !isExpanded.value, 'is-compact': !!props.compact, 'is-expanded': isExpanded.value,
}))
const inputClasses = computed(() => ({
  'is-collapsed': !isExpanded.value, 'is-expanded': isExpanded.value,
  'is-text-expanded': isExpanded.value && isTextExpanded.value,
}))

defineExpose({
  ...actions, handleSend, isTextExpanded, setModelCapability, setCapability,
  getCurrentState: persistence.remember.buildRememberState, restoreState, resetForRestore,
  applyRequestState: persistence.remember.applyRequestState,
  buildCurrentRequestPayload: persistence.remember.buildCurrentRequestPayloadCustom,
  addReferenceMedia, addReferenceMediaAt, setReferenceMedia, refImages, hasFileParam,
  autoSwitchToFileMode, requestPreferredClientScreenshot, requestClientScreenshotByMode,
  openReferenceEditor: handleReferencePreview, selectedModelId, selectedModelInfo,
  selectedCapability, selectedMode, availableModes, modelParams, paramValues, onModelSelect,
  handleModelSelectKeepReferences, onCapabilityBarChange: onCapabilityBarChangeWrapper,
  onParamChange: onParamChangeWrapper, enterBatchMode, exitBatchMode,
})
</script>

<template>
  <div :class="['generator-shell', { 'generator-embedded-shell': props.embedded }]">
    <div
      v-drag-resize.top="heightResizeBinding"
      class="generator-input-stack"
      :class="stackClasses"
      :style="heightResizeStyle"
    >
      <slot
        v-if="hasTopToolbarSlot"
        name="top-toolbar"
        :is-text-expanded="isTextExpanded"
        :toggle-text-expanded="toggleTextExpanded"
        :collapse-panel="collapsePanel"
      />
      <GeneratorComposerHeader
        v-if="isExpanded"
        v-bind="headerProps"
        @update:capability="selectedCapability = $event"
        @capability-change="onCapabilityBarChangeWrapper"
        @switch-model-for-capability="setCapability"
        @reload-current-model="onReloadCurrentModelWrapper"
        @set-multiline-batch-mode="setMultilineBatchMode"
        @set-smart-multi-frame-enabled="setSmartMultiFrameEnabled"
        @request-preferred-screenshot="requestPreferredClientScreenshot"
        @request-screenshot-mode="requestClientScreenshotByMode"
        @update:screenshot-menu-visible="screenshotMenuVisible = $event"
        @toggle-text-expanded="toggleTextExpanded"
        @collapse-panel="collapsePanel"
        @close-panel="closeFloatingOverlays"
      >
        <template #top-toolbar-prepend-control><slot name="top-toolbar-prepend-control" /></template>
        <template #mode-row-prefix="slotProps">
          <PromptPresetPopover @apply="onApplyPreset" @apply-batch="onApplyPresetBatch" />
          <slot name="mode-row-prefix" v-bind="slotProps" />
        </template>
      </GeneratorComposerHeader>

      <div ref="containerRef" class="input-container" :class="inputClasses">
        <GeneratorStatusOverlay v-bind="statusProps" @scroll-to-bottom="scrollToBottom" />
        <Transition name="generator-panel" mode="out-in">
          <GeneratorCollapsedBar
            v-if="!isExpanded"
            :summary="collapsedSummary"
            :can-send="canSubmit"
            @expand="isExpanded = true"
            @send="handleSendClick"
          />
          <div
            v-else
            ref="expandedPanelRef"
            class="expanded-panel"
            :class="{ 'expanded-panel--full': isTextExpanded, 'is-drop-active': isDropActive }"
            @dragover.prevent.stop="onExternalDragOver"
            @dragleave.stop="onExternalDragLeave"
            @drop.capture="onExpandedPanelDropCapture"
            @drop.prevent.stop="onExpandedPanelDrop"
          >
            <div v-if="isDropActive" class="generator-drop-indicator" role="status">释放以上传</div>
            <GeneratorPromptWorkspace
              ref="workspaceRef"
              v-bind="workspaceProps"
              @update-prompt="prompt = $event"
              @update-reference-images="uiRememberRefImages = $event"
              @preview-reference="handleReferencePreview"
              @remove-reference="onRefImageRemove"
              @clear-references="clearAllReferenceImages"
              @auto-collapse-change="onReferenceAutoCollapseChange"
              @reference-url-updated="onReferenceUrlUpdated"
              @before-remove-reference="emit('before-remove-reference', $event)"
              @remove-upstream="emit('remove-upstream', $event)"
              @files-dropped="onReferenceAreaFilesDropped"
              @prompt-change="saveUIRemember"
              @select-subject="onSelectSubject"
              @toggle-smart="setSmartMultiFrameEnabled"
              @update-smart-prompt="updateRowPrompt"
              @update-smart-param="updateRowParam"
              @add-multiline-row="addMultilinePromptRow"
              @clear-multiline="clearAllMultilinePromptRows"
              @remove-multiline-row="removeMultilinePromptRow"
              @update-multiline-prompt="updateMultilinePromptRowPrompt"
              @update-multiline-refs="updateMultilinePromptRowReferences"
            />
            <GeneratorConfigFooter
              v-bind="footerProps"
              @select-model="handleModelSelectKeepReferences"
              @select-mode="handleModeSelect"
              @change-params="onParamChangeWrapper"
              @select-skill="onSkillSelect"
              @publisher-icon-error="onIconError"
            >
              <template #submit>
                <GeneratorSubmitCluster
                  v-bind="submitProps"
                  @step-count="stepAllowGenerateCount"
                  @send="handleSendClick"
                />
              </template>
            </GeneratorConfigFooter>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped src="./GeneratorInput.shell.css"></style>

<style>
.capability-select-popover {
  padding: 6px !important;
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  background: var(--bg-surface) !important;
  box-shadow: var(--sys-shadow-elevated) !important;
}
</style>
