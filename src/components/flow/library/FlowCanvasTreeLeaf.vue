<script setup lang="ts">
import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import { Icon } from '@iconify/vue'

defineOptions({ name: 'FlowCanvasTreeLeaf' })

const props = defineProps<{
  active: boolean
  canDelete: boolean
  canEdit: boolean
  canvas: FlowLibraryCanvas
}>()

const emit = defineEmits<{
  delete: [canvas: FlowLibraryCanvas]
  edit: [canvas: FlowLibraryCanvas]
  open: [canvasId: string]
  openNewWindow: [canvasId: string]
}>()

function handleCommand(command: string): void {
  if (command === 'edit' && props.canEdit) emit('edit', props.canvas)
  if (command === 'delete' && props.canDelete) emit('delete', props.canvas)
}
</script>

<template>
  <li class="canvas-tree-leaf" role="treeitem" :aria-selected="active">
    <div
      class="canvas-tree-item"
      :class="{ active }"
      role="button"
      tabindex="0"
      @click="emit('open', canvas.id)"
      @keydown.enter.self.prevent="emit('open', canvas.id)"
      @keydown.space.self.prevent="emit('open', canvas.id)"
    >
      <Icon icon="lucide:workflow" class="canvas-tree-item__icon" />
      <span>{{ canvas.name }}</span>
      <div class="canvas-tree-actions">
        <button
          class="canvas-tree-action"
          type="button"
          title="新窗口打开"
          aria-label="新窗口打开"
          @click.stop="emit('openNewWindow', canvas.id)"
          @keydown.stop
        >
          <Icon icon="lucide:external-link" />
        </button>
        <el-dropdown
          v-if="canEdit || canDelete"
          trigger="click"
          popper-class="flow-canvas-tree-actions-popper"
          @command="handleCommand"
        >
          <button
            class="canvas-tree-action"
            type="button"
            title="更多画布操作"
            @click.stop
            @keydown.stop
          >
            <Icon icon="lucide:ellipsis" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="canEdit" command="edit">编辑</el-dropdown-item>
              <el-dropdown-item
                v-if="canDelete"
                class="flow-canvas-tree-delete-item"
                command="delete"
                :divided="canEdit"
              >删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </li>
</template>

<style scoped src="./FlowCanvasTreeLeaf.scss"></style>
