<template>
  <div class="smart-multi-frame-list">
    <div v-if="rows.length" class="smart-multi-frame-list__table-wrap">
      <div class="smart-multi-frame-list__table">
        <div class="smart-multi-frame-list__thead">
          <div>首帧</div>
          <div>尾帧</div>
          <div>提示词</div>
          <div>参数</div>
        </div>

        <div v-for="row in rows" :key="row.id" class="smart-multi-frame-list__tbody-row">
          <button class="smart-multi-frame-list__thumb" @click="$emit('preview', row.startIndex)">
            <img :src="row.firstImage.url" alt="" />
          </button>

          <button class="smart-multi-frame-list__thumb" @click="$emit('preview', row.endIndex)">
            <img :src="row.lastImage.url" alt="" />
          </button>

          <div class="smart-multi-frame-list__prompt">
            <PromptInput
              :model-value="row.prompt"
              :ref-images="buildRowRefImages(row)"
              :is-text-expanded="true"
              :multiline-batch-mode="false"
              placeholder="填写该段提示词"
              @update:model-value="updatePrompt(row.id, $event)"
            />
          </div>

          <div class="smart-multi-frame-list__params">
            <SmartMultiFrameRowParams
              :params="params"
              :values="row.params"
              @change="onRowParamsChange(row.id, $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModelParamSchema } from '@/api/models'
import PromptInput from './PromptInput.vue'
import SmartMultiFrameRowParams from './SmartMultiFrameRowParams.vue'
import type { ReferenceImage } from './ReferenceMenu.vue'
import type { SmartMultiFrameRow } from './useSmartMultiFrame'

const props = defineProps<{
  rows: SmartMultiFrameRow[]
  params: ModelParamSchema[]
}>()

const emit = defineEmits<{
  (e: 'update-prompt', rowId: string, value: string): void
  (e: 'update-param', rowId: string, paramName: string, value: unknown): void
  (e: 'preview', index: number): void
}>()

function updatePrompt(rowId: string, value: string): void {
  emit('update-prompt', rowId, value)
}

function onParamChange(rowId: string, paramName: string, value: unknown): void {
  emit('update-param', rowId, paramName, value)
}

function onRowParamsChange(rowId: string, values: Record<string, unknown>): void {
  Object.entries(values).forEach(([paramName, value]) => {
    onParamChange(rowId, paramName, value)
  })
}

function buildRowRefImages(row: SmartMultiFrameRow): ReferenceImage[] {
  return [row.firstImage, row.lastImage]
}

</script>

<style scoped>
.smart-multi-frame-list {
  margin-top: 2px;
  border-radius: 12px;
  background: rgba(19, 20, 23, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
}

.smart-multi-frame-list__table-wrap {
  overflow: auto;
  max-height: min(42vh, 320px);
}

.smart-multi-frame-list__table {
  display: grid;
  gap: 4px;
  min-width: 100%;
}

.smart-multi-frame-list__thead,
.smart-multi-frame-list__tbody-row {
  display: grid;
  grid-template-columns: 52px 52px minmax(520px, 2.2fr) 148px;
  gap: 6px;
  align-items: stretch;
}

.smart-multi-frame-list__thead {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 10px;
  color: rgba(229, 231, 235, 0.66);
}

.smart-multi-frame-list__tbody-row {
  padding: 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.smart-multi-frame-list__thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.smart-multi-frame-list__thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.28);
}

.smart-multi-frame-list__prompt {
  height: 100%;
  min-height: 72px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.smart-multi-frame-list__prompt :deep(.prompt-input-wrap) {
  height: 100%;
  min-height: 72px;
}

.smart-multi-frame-list__prompt :deep(.prompt-input-main-row) {
  min-height: 72px;
}

.smart-multi-frame-list__prompt :deep(.prompt-editor) {
  min-height: 72px !important;
  max-height: 160px !important;
  padding: 6px 8px 4px !important;
}

.smart-multi-frame-list__params {
  min-width: 0;
}

</style>
