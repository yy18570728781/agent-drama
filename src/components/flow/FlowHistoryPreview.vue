<script setup lang="ts">
import type { FlowCanvasHistoryVersion } from '@/services/flow/flowCanvasHistory.types'
import type { WorkflowDefinition } from '@/composables/flow/flowCore.types'
import FlowReadonlyCanvas from './FlowReadonlyCanvas.vue'
import './FlowHistoryPreview.scss'

defineOptions({ name: 'FlowHistoryPreview' })

defineProps<{
  definition: WorkflowDefinition
  version: FlowCanvasHistoryVersion
}>()

function formatPreviewTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN')
}
</script>

<template>
  <section class="flow-history-preview-layer" aria-label="历史版本预览">
    <header class="flow-history-preview-banner">
      <span class="flow-history-preview-badge">历史预览</span>
      <div>
        <strong>版本 {{ version.revision }} · {{ version.label }}</strong>
        <span>{{ formatPreviewTime(version.createdAt) }}</span>
      </div>
    </header>
    <FlowReadonlyCanvas
      class="flow-history-preview-canvas"
      :aria-label="`历史版本 ${version.revision} 只读预览`"
      :definition="definition"
      :instance-id="`flow-history-preview-${version.revision}`"
    />
  </section>
</template>
