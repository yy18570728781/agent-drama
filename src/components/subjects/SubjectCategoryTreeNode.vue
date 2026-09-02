<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  ChevronRight, Folder, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2,
} from '@/components/common/icon/lucide'
import type { CategoryOption } from '@/composables/subjects/useSubjectCategories'
import type { SubjectCategoryRenamePayload } from '@/composables/subjects/subjectLibrary.types'

const props = defineProps<{
  node: CategoryOption
  selectedCategoryId: number | null
}>()
const emit = defineEmits<{
  select: [categoryId: number]
  createChild: [categoryId: number]
  createSubject: [categoryId: number]
  rename: [payload: SubjectCategoryRenamePayload]
  delete: [category: CategoryOption]
}>()
const isExpanded = ref(false)
const isEditing = ref(false)
const editName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const hasChildren = computed(() => Boolean(props.node.children?.length))
const isSelected = computed(() => props.selectedCategoryId === props.node.id)

function toggleExpanded(): void {
  if (!hasChildren.value) return
  isExpanded.value = !isExpanded.value
}

function selectFolder(): void {
  emit('select', props.node.id)
  if (hasChildren.value) isExpanded.value = true
}

async function startEditing(): Promise<void> {
  editName.value = props.node.name
  isEditing.value = true
  await nextTick()
  editInputRef.value?.select()
}

function finishEditing(): void {
  if (!isEditing.value) return
  const name = editName.value.trim()
  isEditing.value = false
  if (!name || name === props.node.name) return
  emit('rename', { categoryId: props.node.id, name })
}

function cancelEditing(): void {
  isEditing.value = false
  editName.value = props.node.name
}

function handleAction(command: string): void {
  if (command === 'create-child') emit('createChild', props.node.id)
  if (command === 'create-subject') emit('createSubject', props.node.id)
  if (command === 'rename') void startEditing()
  if (command === 'delete') emit('delete', props.node)
}
</script>

<template>
  <li class="subject-tree-node" role="treeitem" :aria-expanded="hasChildren ? isExpanded : undefined">
    <div class="subject-tree-row">
      <button
        class="subject-tree-toggle"
        :class="{ hidden: !hasChildren }"
        type="button"
        :title="isExpanded ? '收起' : '展开'"
        @click.stop="toggleExpanded"
      >
        <ChevronRight :size="15" :class="{ expanded: isExpanded }" />
      </button>
      <div class="subject-folder-item" :class="{ active: isSelected }" @click="selectFolder">
        <FolderOpen v-if="isSelected" :size="16" />
        <Folder v-else :size="16" />
        <input
          v-if="isEditing"
          ref="editInputRef"
          v-model="editName"
          class="subject-tree-input"
          type="text"
          aria-label="文件夹名称"
          @click.stop
          @blur="finishEditing"
          @keydown.enter.prevent="finishEditing"
          @keydown.esc.prevent="cancelEditing"
        />
        <span v-else>{{ node.name }}</span>
        <div class="subject-tree-actions">
          <el-dropdown trigger="click" popper-class="subject-category-actions-popper" @command="handleAction">
            <button class="subject-tree-action" type="button" title="更多操作" @click.stop>
              <MoreHorizontal :size="15" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename"><Pencil :size="13" />重命名</el-dropdown-item>
                <el-dropdown-item command="delete" divided><Trash2 :size="13" />删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click" popper-class="subject-category-create-popper" @command="handleAction">
            <button class="subject-tree-action" type="button" title="新建" @click.stop>
              <Plus :size="15" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="create-child"><FolderPlus :size="13" />新建文件夹</el-dropdown-item>
                <el-dropdown-item command="create-subject" divided><Plus :size="13" />新建主体</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
    <ul v-if="hasChildren && isExpanded" class="subject-tree-children" role="group">
      <SubjectCategoryTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-category-id="selectedCategoryId"
        @select="emit('select', $event)"
        @create-child="emit('createChild', $event)"
        @create-subject="emit('createSubject', $event)"
        @rename="emit('rename', $event)"
        @delete="emit('delete', $event)"
      />
    </ul>
  </li>
</template>

<style scoped src="./SubjectCategoryTreeNode.scss"></style>
