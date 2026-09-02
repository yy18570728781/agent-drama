<script setup lang="ts">
import { Icon } from '@iconify/vue'
import './FlowEditorMoreMenu.scss'

defineOptions({ name: 'FlowEditorMoreMenu' })

defineProps<{
  hasActiveCanvas: boolean
}>()

const emit = defineEmits<{
  exportJson: []
  history: []
  importJson: []
}>()

type MenuCommand = 'export' | 'history' | 'import'

function handleCommand(command: MenuCommand): void {
  if (command === 'export') emit('exportJson')
  if (command === 'import') emit('importJson')
  if (command === 'history') emit('history')
}
</script>

<template>
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    popper-class="flow-editor-more-popper"
    @command="handleCommand"
  >
    <button
      aria-label="更多画布操作"
      class="flow-editor-more"
      title="更多操作"
      type="button"
    >
      <svg class="flow-editor-more__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5.5h.01" />
        <path d="M12 12h.01" />
        <path d="M12 18.5h.01" />
      </svg>
    </button>
    <template #dropdown>
      <el-dropdown-menu class="flow-editor-more-menu">
        <el-dropdown-item command="import">
          <Icon icon="lucide:upload" /><span>导入 JSON</span>
        </el-dropdown-item>
        <el-dropdown-item command="export" :disabled="!hasActiveCanvas">
          <Icon icon="lucide:download" /><span>导出 JSON</span>
        </el-dropdown-item>
        <el-dropdown-item command="history" :disabled="!hasActiveCanvas">
          <Icon icon="lucide:history" /><span>历史记录</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
