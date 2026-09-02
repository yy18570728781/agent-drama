<script setup lang="ts">
import { Plus, Trash2 } from '@/components/common/icon/lucide'
import MultilineRowReferences from './MultilineRowReferences.vue'
import PromptInput from './PromptInput.vue'
import type { ReferenceImage } from '@/composables/generation/useReferenceManager'
import type { MultilinePromptReferenceRow } from './useMultilinePromptReferences'

defineProps<{
  rows: MultilinePromptReferenceRow[]
  expanded?: boolean
}>()

const emit = defineEmits<{
  (event: 'add-row'): void
  (event: 'clear-all'): void
  (event: 'remove-row', rowId: string): void
  (event: 'update-prompt', rowId: string, value: string): void
  (event: 'update-refs', rowId: string, images: ReferenceImage[]): void
}>()
</script>

<template>
  <section
    v-if="rows.length"
    :class="['multiline-ref-list', { 'multiline-ref-list--expanded': expanded }]"
    aria-label="多提示词任务"
  >
    <div class="multiline-ref-list__header" aria-hidden="true">
      <span>序号</span>
      <span>参考素材</span>
      <span>提示词</span>
      <span>操作</span>
    </div>

    <div class="multiline-ref-list__table" role="list">
      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="multiline-ref-list__row"
        role="listitem"
        :aria-label="`第 ${index + 1} 条提示词`"
      >
        <span class="multiline-ref-list__index" aria-hidden="true">{{ index + 1 }}</span>

        <div class="multiline-ref-list__refs-panel">
          <MultilineRowReferences
            :images="row.references"
            @update:images="emit('update-refs', row.id, $event)"
          />
        </div>

        <div class="multiline-ref-list__prompt">
          <PromptInput
            :model-value="row.prompt"
            :ref-images="row.references"
            :is-text-expanded="true"
            :multiline-batch-mode="false"
            :aria-label="`第 ${index + 1} 条提示词`"
            placeholder="填写这一条提示词"
            @update:model-value="emit('update-prompt', row.id, $event)"
          />
        </div>

        <button
          v-if="rows.length > 1"
          type="button"
          class="multiline-ref-list__row-remove"
          :aria-label="`删除第 ${index + 1} 条提示词`"
          title="删除这一条提示词"
          @click="emit('remove-row', row.id)"
        >
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>

    <footer class="multiline-ref-list__actions">
      <button type="button" class="multiline-ref-list__add" @click.stop.prevent="emit('add-row')">
        <Plus :size="15" aria-hidden="true" />
        <span>添加提示词</span>
      </button>
      <div class="multiline-ref-list__summary">
        <span class="multiline-ref-list__count" aria-live="polite">{{ rows.length }} 条提示词</span>
        <button type="button" class="multiline-ref-list__clear" @click.stop.prevent="emit('clear-all')">
          <Trash2 :size="14" aria-hidden="true" />
          <span>清空内容</span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped src="./MultilinePromptReferenceList.css"></style>
