<script setup lang="ts">
import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useSuperAdminRole } from '@/composables/useSuperAdminRole'
import FlowCanvasTreeLeaf from './FlowCanvasTreeLeaf.vue'
import type { FlowFolderNode } from './flowLibrary.types'
import { FLOW_CATEGORY_PERMISSION } from './flowCategoryPermission.constants'

defineOptions({ name: 'FlowCategoryTreeNode' })

const props = defineProps<{
  activeCanvasId: string
  canvasesByCategory: Record<string, FlowLibraryCanvas[]>
  loadedCategoryIds: Set<string>
  loadingCategoryId: string
  node: FlowFolderNode
  selectedCategoryId: string
}>()

const emit = defineEmits<{
  cancelCreate: [categoryId: string]
  createCanvas: [categoryId: string]
  createChild: [categoryId: string]
  deleteCanvas: [canvas: FlowLibraryCanvas, categoryId: string]
  delete: [categoryId: string]
  editCanvas: [canvas: FlowLibraryCanvas, categoryId: string]
  permission: [categoryId: string]
  openCanvas: [canvasId: string]
  openCanvasNewWindow: [canvasId: string, categoryId: string]
  rename: [categoryId: string, name: string]
  select: [categoryId: string]
}>()

const isSuperAdmin = useSuperAdminRole()
const isExpanded = ref(false)
const isTemporary = computed(() => props.node.id.startsWith('add_'))
const isEditing = ref(isTemporary.value)
const editInputRef = ref<HTMLInputElement | null>(null)
const editName = ref(props.node.name)
const canvasItems = computed(() => props.canvasesByCategory[props.node.id] || [])
const isCanvasLoading = computed(() => props.loadingCategoryId === props.node.id)
const isFolderSelected = computed(() =>
  props.selectedCategoryId === props.node.id && !props.activeCanvasId,
)
const hasChildren = computed(() =>
  props.node.children.length > 0
  || canvasItems.value.length > 0
  || isCanvasLoading.value
  || !props.loadedCategoryIds.has(props.node.id),
)
const canManage = computed(() => props.node.permission >= FLOW_CATEGORY_PERMISSION.MANAGE)
const canManagePermissions = computed(() => isSuperAdmin.value && canManage.value)
const canEdit = computed(() => props.node.permission >= FLOW_CATEGORY_PERMISSION.EDIT)

function toggleExpanded(): void {
  if (!hasChildren.value) return
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) emit('select', props.node.id)
}

function selectFolder(): void {
  emit('select', props.node.id)
  if (hasChildren.value) isExpanded.value = true
}

function focusEditor(): void {
  void nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function startEditing(): void {
  editName.value = props.node.name
  isEditing.value = true
  emit('select', props.node.id)
  focusEditor()
}

function finishEditing(): void {
  if (!isEditing.value) return
  const name = editName.value.trim()
  if (isTemporary.value && name === props.node.name) {
    focusEditor()
    return
  }
  isEditing.value = false
  if (!name) {
    if (isTemporary.value) emit('cancelCreate', props.node.id)
    return
  }
  if (isTemporary.value || name !== props.node.name) emit('rename', props.node.id, name)
}

function cancelEditing(): void {
  isEditing.value = false
  editName.value = props.node.name
  if (isTemporary.value) emit('cancelCreate', props.node.id)
}

function handleCommand(command: string): void {
  if (command === 'create-child') emit('createChild', props.node.id)
  if (command === 'create-canvas') emit('createCanvas', props.node.id)
  if (command === 'rename') startEditing()
  if (command === 'permission') emit('permission', props.node.id)
  if (command === 'delete') emit('delete', props.node.id)
}

function containsCategory(node: FlowFolderNode, categoryId: string): boolean {
  return node.id === categoryId
    || node.children.some((child) => containsCategory(child, categoryId))
}

watch(
  () => props.selectedCategoryId,
  (categoryId) => {
    if (categoryId && containsCategory(props.node, categoryId)) isExpanded.value = true
  },
  { immediate: true },
)

onMounted(() => {
  if (isTemporary.value) focusEditor()
})
</script>

<template>
  <li class="tree-node" role="treeitem" :aria-expanded="hasChildren ? isExpanded : undefined">
    <div class="tree-row">
      <button
        class="tree-toggle"
        :class="{ hidden: !hasChildren }"
        type="button"
        :title="isExpanded ? '收起' : '展开'"
        @click.stop="toggleExpanded"
      >
        <Icon icon="lucide:chevron-right" :class="{ expanded: isExpanded }" />
      </button>
      <div
        class="folder-item"
        :class="{ active: isFolderSelected }"
        @click="selectFolder"
      >
        <Icon :icon="isFolderSelected ? 'lucide:folder-open' : 'lucide:folder'" />
        <input
          v-if="isEditing"
          ref="editInputRef"
          v-model="editName"
          class="tree-node-input"
          @click.stop
          @blur="finishEditing"
          @keydown.enter.prevent="editInputRef?.blur()"
          @keydown.esc.prevent="cancelEditing"
        />
        <span v-else>{{ node.name }}</span>
        <div v-if="canEdit || canManage" class="tree-actions">
          <el-dropdown
            v-if="canEdit && !isEditing"
            trigger="click"
            popper-class="flow-category-actions-popper"
            @command="handleCommand"
          >
            <button class="tree-action-button" type="button" title="更多操作" @click.stop>
              <Icon icon="lucide:ellipsis" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="canManagePermissions" command="permission">
                  权限管理
                </el-dropdown-item>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item
                  v-if="canManage"
                  class="flow-category-delete-item"
                  command="delete"
                  divided
                >删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown
            v-if="canEdit && !isEditing"
            trigger="click"
            popper-class="flow-category-create-popper"
            @command="handleCommand"
          >
            <button class="tree-action-button" type="button" title="新建" @click.stop>
              <Icon icon="lucide:plus" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="canManage" command="create-child">
                  <Icon icon="lucide:folder-plus" />新建文件夹
                </el-dropdown-item>
                <el-dropdown-item command="create-canvas" :divided="canManage">
                  <Icon icon="lucide:panels-top-left" />新建画布
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
    <ul v-if="hasChildren && isExpanded" class="tree-children" role="group">
      <FlowCategoryTreeNode
        v-for="child in node.children"
        :key="child.id"
        :active-canvas-id="activeCanvasId"
        :canvases-by-category="canvasesByCategory"
        :loaded-category-ids="loadedCategoryIds"
        :loading-category-id="loadingCategoryId"
        :node="child"
        :selected-category-id="selectedCategoryId"
        @cancel-create="emit('cancelCreate', $event)"
        @create-canvas="emit('createCanvas', $event)"
        @create-child="emit('createChild', $event)"
        @delete-canvas="(canvas, categoryId) => emit('deleteCanvas', canvas, categoryId)"
        @delete="emit('delete', $event)"
        @edit-canvas="(canvas, categoryId) => emit('editCanvas', canvas, categoryId)"
        @open-canvas="emit('openCanvas', $event)"
        @open-canvas-new-window="(canvasId, categoryId) => emit('openCanvasNewWindow', canvasId, categoryId)"
        @permission="emit('permission', $event)"
        @rename="(categoryId, name) => emit('rename', categoryId, name)"
        @select="emit('select', $event)"
      />
      <FlowCanvasTreeLeaf
        v-for="canvas in canvasItems"
        :key="canvas.id"
        :active="activeCanvasId === canvas.id"
        :can-delete="canManage"
        :can-edit="canEdit"
        :canvas="canvas"
        @delete="emit('deleteCanvas', $event, node.id)"
        @edit="emit('editCanvas', $event, node.id)"
        @open="emit('openCanvas', $event)"
        @open-new-window="emit('openCanvasNewWindow', $event, node.id)"
      />
      <li v-if="isCanvasLoading" class="tree-canvas-loading">
        <Icon icon="lucide:loader-circle" class="spin" />加载画布
      </li>
    </ul>
  </li>
</template>

<style scoped src="./FlowCategoryTreeNode.scss"></style>
