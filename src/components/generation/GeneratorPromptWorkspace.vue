<script setup lang="ts">
import { computed } from 'vue'
import { Layers, Plus } from '@/components/common/icon/lucide'
import MultilinePromptReferenceList from './MultilinePromptReferenceList.vue'
import PromptInput from './PromptInput.vue'
import ReferenceArea from './ReferenceArea.vue'
import SmartMultiFrameList from './SmartMultiFrameList.vue'
import { useGeneratorPromptBridge } from '@/composables/generation/useGeneratorPromptBridge'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import type { SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'
import type { MultilinePromptReferenceRow } from './useMultilinePromptReferences'
import type { SmartMultiFrameRow } from './useSmartMultiFrame'
import type { GeneratorDropPayload, GeneratorDroppedAsset } from './generatorInput.types'

const props = defineProps<{
  batchItemCount: number
  batchMode: boolean
  embedded: boolean
  fileParamDef: ModelParamSchema | null
  hasFileParam: boolean
  hasPromptParam: boolean
  maxItems?: number
  maxItemsWarning: string
  modelInfo: BackendModelInfo | null
  multilineMode: boolean
  multilineRows: MultilinePromptReferenceRow[]
  placeholder: string
  prompt: string
  promptBelowReference: boolean
  refImages: ReferenceImage[]
  smartEnabled: boolean
  smartParams: ModelParamSchema[]
  smartRows: SmartMultiFrameRow[]
  textExpanded: boolean
}>()

const emit = defineEmits<{
  'add-multiline-row': []
  'auto-collapse-change': [enabled: boolean]
  'before-remove-reference': [item: unknown]
  'clear-multiline': []
  'clear-references': []
  'files-dropped': [payload: GeneratorDropPayload]
  'preview-reference': [index: number]
  'prompt-change': []
  'reference-url-updated': [index: number, url: string]
  'remove-multiline-row': [rowId: string]
  'remove-reference': [index: number]
  'remove-upstream': [nodeId: string]
  'select-subject': [payload: SubjectSelectPayload]
  'toggle-smart': [enabled: boolean]
  'update-multiline-prompt': [rowId: string, value: string]
  'update-multiline-refs': [rowId: string, images: ReferenceImage[]]
  'update-prompt': [value: string]
  'update-reference-images': [images: ReferenceImage[]]
  'update-smart-param': [rowId: string, paramName: string, value: unknown]
  'update-smart-prompt': [rowId: string, value: string]
}>()

const promptModel = computed({
  get: () => props.prompt,
  set: (value: string) => emit('update-prompt', value),
})
const referenceModel = computed({
  get: () => props.refImages,
  set: (images: ReferenceImage[]) => emit('update-reference-images', images),
})
const {
  closePromptMenu,
  focusPrompt,
  getPromptFromDom,
  insertReference,
  promptInputRef,
  renderPromptEditorFromState,
  restorePromptSelection,
  savePromptSelection,
  setPromptInEditor,
  syncPromptFromDom,
} = useGeneratorPromptBridge({ prompt: promptModel, refImages: referenceModel })

function onReferenceUrlUpdated(index: number, url: string): void {
  emit('reference-url-updated', index, url)
}

function onFilesDropped(payload: {
  assetInfo?: unknown
  files?: File[]
  replaceIndex?: number
  urls?: string[]
}): void {
  const assetInfo = typeof payload.assetInfo === 'object' && payload.assetInfo !== null
    ? payload.assetInfo as GeneratorDroppedAsset
    : null
  emit('files-dropped', { ...payload, assetInfo })
}

function onSmartParam(rowId: string, paramName: string, value: unknown): void {
  emit('update-smart-param', rowId, paramName, value)
}

function onSmartPrompt(rowId: string, value: string): void {
  emit('update-smart-prompt', rowId, value)
}

function onMultilinePrompt(rowId: string, value: string): void {
  emit('update-multiline-prompt', rowId, value)
}

function onMultilineRefs(rowId: string, images: ReferenceImage[]): void {
  emit('update-multiline-refs', rowId, images)
}

defineExpose({
  closePromptMenu,
  focusPrompt,
  getPromptFromDom,
  insertReference,
  renderPromptEditorFromState,
  restorePromptSelection,
  savePromptSelection,
  setPromptInEditor,
  syncPromptFromDom,
})
</script>

<template>
  <section class="generator-workspace" aria-label="创作内容">
    <div v-if="!props.modelInfo" class="generator-workspace__empty">
      <span class="generator-workspace__empty-icon"><Plus :size="18" /></span>
      <div>
        <strong>选择模型开始创作</strong>
        <p>选择模型后，这里会显示参考素材与提示词输入。</p>
      </div>
    </div>

    <div v-else-if="props.batchMode" class="generator-workspace__batch">
      <Layers :size="18" />
      <span>批量生成模式</span>
      <strong>{{ props.batchItemCount }}</strong>
      <small>个任务待生成</small>
    </div>

    <div v-else class="generator-workspace__editor">
      <div v-if="props.smartEnabled && props.refImages.length < 2" class="generator-workspace__notice">
        至少添加两张参考素材后，将自动组成相邻首尾帧任务。
      </div>

      <ReferenceArea
        :ref-images="props.refImages"
        :has-file-param="props.hasFileParam"
        :file-param-def="props.fileParamDef"
        :max-items="props.maxItems"
        :max-items-warning="props.maxItemsWarning"
        :is-prompt-below-reference="props.promptBelowReference"
        :is-text-expanded="props.textExpanded"
        :delegate-external-drop="true"
        :delegate-preview="props.embedded"
        @update:ref-images="emit('update-reference-images', $event)"
        @preview="emit('preview-reference', $event)"
        @remove="emit('remove-reference', $event)"
        @clear-all="emit('clear-references')"
        @auto-collapse-change="emit('auto-collapse-change', $event)"
        @reference-url-updated="onReferenceUrlUpdated"
        @before-remove-reference="emit('before-remove-reference', $event)"
        @remove-upstream="emit('remove-upstream', $event)"
        @files-dropped="onFilesDropped"
      />

      <SmartMultiFrameList
        v-if="props.smartEnabled"
        :rows="props.smartRows"
        :params="props.smartParams"
        @update-prompt="onSmartPrompt"
        @update-param="onSmartParam"
        @preview="emit('preview-reference', $event)"
      />

      <div
        v-if="props.hasPromptParam && !props.smartEnabled && !props.multilineMode"
        class="generator-workspace__prompt"
        role="group"
        aria-label="创作描述"
      >
        <span class="generator-workspace__prompt-label" aria-hidden="true">创作描述</span>
        <PromptInput
          ref="promptInputRef"
          v-model="promptModel"
          :ref-images="props.refImages"
          :is-text-expanded="props.textExpanded"
          :placeholder="props.placeholder"
          :multiline-batch-mode="props.multilineMode"
          @prompt-change="emit('prompt-change')"
          @select-subject="emit('select-subject', $event)"
        />
      </div>

      <MultilinePromptReferenceList
        v-if="props.multilineMode && props.multilineRows.length"
        :rows="props.multilineRows"
        :expanded="props.textExpanded"
        @add-row="emit('add-multiline-row')"
        @clear-all="emit('clear-multiline')"
        @remove-row="emit('remove-multiline-row', $event)"
        @update-prompt="onMultilinePrompt"
        @update-refs="onMultilineRefs"
      />

      <button
        v-if="props.hasPromptParam && props.smartEnabled"
        class="generator-workspace__smart-toggle"
        type="button"
        :aria-pressed="props.smartEnabled"
        @click="emit('toggle-smart', false)"
      >退出智能多帧</button>
    </div>
  </section>
</template>

<style scoped>
.generator-workspace {
  min-height: 156px;
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: color-mix(in srgb, var(--bg-base) 42%, var(--generator-surface));
}

.generator-workspace__editor { display: grid; gap: 10px; padding: 14px 16px; }
.generator-workspace__prompt {
  min-width: 0;
  padding: 2px 10px 4px;
  border: 1px solid transparent;
  border-radius: 11px;
}

.generator-workspace__prompt-label {
  display: block;
  margin-top: 3px;
  color: var(--generator-text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: color 160ms ease;
}

.generator-workspace__prompt:focus-within .generator-workspace__prompt-label {
  color: var(--generator-accent);
}
.generator-workspace__prompt :deep(.prompt-editor:empty::before) { color: color-mix(in srgb, var(--generator-text-secondary) 78%, var(--generator-surface)); }
.generator-workspace__empty,
.generator-workspace__batch { min-height: 156px; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: var(--generator-text-secondary); text-align: left; }
.generator-workspace__empty-icon { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid color-mix(in srgb, var(--generator-accent) 34%, var(--generator-border)); border-radius: 12px; background: color-mix(in srgb, var(--generator-accent) 12%, transparent); color: var(--generator-accent); }
.generator-workspace__empty strong { color: var(--generator-text-primary); font-size: 13px; }
.generator-workspace__empty p { margin: 3px 0 0; font-size: 11px; }
.generator-workspace__batch strong { color: var(--generator-accent); font-size: 16px; }
.generator-workspace__batch small { color: var(--generator-text-muted); }
.generator-workspace__notice { padding: 7px 9px; border: 1px solid color-mix(in srgb, var(--warning) 26%, var(--generator-border)); border-radius: 9px; background: color-mix(in srgb, var(--warning) 8%, transparent); color: var(--generator-text-secondary); font-size: 11px; }
.generator-workspace__smart-toggle { justify-self: start; min-height: 30px; padding: 0 9px; border: 1px solid var(--generator-border); border-radius: 8px; background: var(--generator-surface-muted); color: var(--generator-text-secondary); font: inherit; font-size: 11px; cursor: pointer; }
.generator-workspace__smart-toggle:focus-visible { outline: 2px solid var(--generator-accent); outline-offset: 2px; }

@media (max-width: 720px) {
  .generator-workspace { min-height: 148px; }
  .generator-workspace__editor { padding: 10px; }
  .generator-workspace__prompt { padding-inline: 8px; }
  .generator-workspace__smart-toggle { min-height: 44px; padding-inline: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .generator-workspace__prompt-label { transition: none; }
}
</style>
