<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import DynamicParamForm from './DynamicParamForm.vue'
import GigaParamForm from './GigaParamForm.vue'
import ModelSelectPanel from './ModelSelectPanel.vue'
import TopazParamForm from './TopazParamForm.vue'
import TopazProcessParamForm from './TopazProcessParamForm.vue'
import { getModeId, getModeLabel } from '@/utils/modeLabels'
import type { BackendModelInfo, ModelParamSchema } from '@/api/models'
import type { GeneratorModelSelection } from './generatorInput.types'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'

interface GeneratorSkillOption {
  description?: string
  id: string
  name: string
}

const props = defineProps<{
  availableModes: unknown[]
  capability: string
  currentModeName: string
  embeddedModeRow: boolean
  isGigaModel: boolean
  isSmartMode: boolean
  isTvaiModel: boolean
  isTvaiProcModel: boolean
  lockedCapability?: string
  modelId: string
  modelInfo: BackendModelInfo | null
  modelParams: ModelParamSchema[]
  paramValues: Record<string, unknown>
  publisherIcon: string
  refImages: ReferenceImage[]
  selectedMode: string
  selectedSkillId: string | null
  selectedSkillName: string
  showModeDropdown: boolean
  skills: GeneratorSkillOption[]
  tvaiModelType: 'up' | 'fi'
}>()

const emit = defineEmits<{
  'change-params': [values: Record<string, unknown>]
  'select-mode': [modeId: string]
  'select-model': [selection: GeneratorModelSelection]
  'select-skill': [skillId: string | null]
  'publisher-icon-error': [event: Event]
}>()

const modePopoverRef = ref<{ hide?: () => void } | null>(null)
const skillPopoverRef = ref<{ hide?: () => void } | null>(null)

function selectMode(mode: unknown): void {
  emit('select-mode', getModeId(mode))
  modePopoverRef.value?.hide?.()
}

function selectSkill(skillId: string | null): void {
  emit('select-skill', skillId)
  skillPopoverRef.value?.hide?.()
}
</script>

<template>
  <div
    class="generator-config-footer"
    :class="{ 'generator-config-footer--embedded-mode-row': props.embeddedModeRow }"
  >
    <div class="generator-config-footer__controls">
      <ModelSelectPanel
        :model-id="props.modelId"
        :capability="props.capability"
        :locked-capability="props.lockedCapability"
        @select="emit('select-model', $event)"
      >
        <button class="generator-config-button generator-model-button" type="button">
          <img v-if="props.publisherIcon" :src="props.publisherIcon" alt="" @error="emit('publisher-icon-error', $event)" />
          <span class="generator-config-button__label">模型</span>
          <span class="generator-config-button__value">
            {{ props.modelInfo?.display_name || props.modelInfo?.name || '请选择模型' }}
          </span>
          <ChevronDown :size="14" />
        </button>
      </ModelSelectPanel>

      <el-popover v-if="props.showModeDropdown" ref="modePopoverRef" placement="top-start" :width="190" role="dialog" trigger="click">
        <template #reference>
          <button class="generator-config-button" type="button">
            <span class="generator-config-button__label">模式</span>
            <span class="generator-config-button__value">{{ props.currentModeName }}</span>
            <ChevronDown :size="14" />
          </button>
        </template>
        <div class="generator-mode-options">
          <button
            v-for="mode in props.availableModes"
            :key="getModeId(mode)"
            type="button"
            :aria-pressed="props.selectedMode === getModeId(mode)"
            :class="{ active: props.selectedMode === getModeId(mode) }"
            @click="selectMode(mode)"
          >{{ getModeLabel(mode) }}</button>
        </div>
      </el-popover>

      <GigaParamForm v-if="props.isGigaModel" :initial-values="props.paramValues" @change="emit('change-params', $event)" />
      <TopazParamForm v-else-if="props.isTvaiModel" :model-type="props.tvaiModelType" :initial-values="props.paramValues" @change="emit('change-params', $event)" />
      <TopazProcessParamForm v-else-if="props.isTvaiProcModel" :initial-values="props.paramValues" :ref-images="props.refImages" @change="emit('change-params', $event)" />
      <DynamicParamForm v-else-if="props.modelParams.length" :params="props.modelParams" :initial-values="props.paramValues" @change="emit('change-params', $event)" />

      <el-popover v-if="props.isSmartMode && props.skills.length" ref="skillPopoverRef" placement="top-start" :width="220" role="dialog" trigger="click">
        <template #reference>
          <button class="generator-config-button" type="button">
            <span class="generator-config-button__label">Skill</span>
            <span class="generator-config-button__value">{{ props.selectedSkillName }}</span>
            <ChevronDown :size="14" />
          </button>
        </template>
        <div class="generator-mode-options">
          <button type="button" :aria-pressed="!props.selectedSkillId" @click="selectSkill(null)">自动选择</button>
          <button v-for="skill in props.skills" :key="skill.id" type="button" :title="skill.description" :aria-pressed="props.selectedSkillId === skill.id" @click="selectSkill(skill.id)">{{ skill.name }}</button>
        </div>
      </el-popover>
    </div>
    <slot name="submit" />
  </div>
</template>

<style scoped>
.generator-config-footer {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-top: 1px solid color-mix(in srgb, var(--generator-text-primary) 7%, transparent);
  border-radius: 0 0 15px 15px;
  background: color-mix(in srgb, var(--generator-surface-elevated) 18%, transparent);
}

.generator-config-footer__controls {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--generator-surface-muted) 76%, transparent);
  overflow-x: auto;
  scrollbar-width: none;
}

.generator-config-footer__controls::-webkit-scrollbar { display: none; }

.generator-config-footer--embedded-mode-row { align-items: center; }
.generator-config-footer--embedded-mode-row .generator-config-footer__controls {
  flex-wrap: wrap;
  align-content: center;
  overflow-x: visible;
}
.generator-config-footer--embedded-mode-row :deep(.generator-submit-cluster) { align-self: center; }

.generator-config-button {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--generator-text-secondary);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.generator-config-button:hover { background: var(--generator-surface-hover); color: var(--generator-text-primary); }
.generator-config-button:focus-visible { outline: 2px solid var(--generator-accent); outline-offset: 2px; }
.generator-model-button { max-width: 220px; }
.generator-model-button img { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; }
.generator-config-button__label { color: var(--generator-text-secondary); font-size: 11px; }
.generator-config-button__value { max-width: 128px; overflow: hidden; color: var(--generator-text-primary); font-size: 12px; text-overflow: ellipsis; }

.generator-config-footer__controls :deep(.toolbar-select-btn) {
  min-height: 32px;
  border-color: transparent;
  border-radius: 8px;
  background: transparent;
}
.generator-config-footer__controls :deep(.toolbar-select-btn:hover) { background: var(--generator-surface-hover); }

.generator-mode-options { display: grid; gap: 4px; }
.generator-mode-options button { min-height: 34px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-secondary); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.generator-mode-options button:hover { background: var(--bg-hover); color: var(--text-primary); }
.generator-mode-options button[aria-pressed="true"] { border-color: color-mix(in srgb, var(--accent) 36%, var(--border)); background: color-mix(in srgb, var(--accent) 12%, var(--bg-hover)); color: var(--text-primary); }

@media (max-width: 720px) {
  .generator-config-footer { align-items: stretch; flex-direction: column; }
  .generator-config-footer__controls { width: 100%; }
  .generator-config-button { height: 44px; }
  .generator-config-footer__controls :deep(.toolbar-select-btn) { min-height: 44px; }
  .generator-mode-options button { min-height: 44px; }
}
</style>
