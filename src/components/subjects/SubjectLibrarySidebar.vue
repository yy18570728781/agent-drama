<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  FolderOpen, FolderPlus, Loader2, Plus, RefreshCw, Search,
} from '@/components/common/icon/lucide'
import SubjectCategoryTreeNode from '@/components/subjects/SubjectCategoryTreeNode.vue'
import type { CategoryOption } from '@/composables/subjects/useSubjectCategories'
import type { SubjectCategoryRenamePayload } from '@/composables/subjects/subjectLibrary.types'

defineProps<{
  categories: CategoryOption[]
  selectedCategoryId: number | null
  loading: boolean
}>()
const emit = defineEmits<{
  select: [categoryId: number | null]
  createRoot: []
  createChild: [categoryId: number]
  createSubject: [categoryId: number | null]
  rename: [payload: SubjectCategoryRenamePayload]
  delete: [category: CategoryOption]
  refresh: []
}>()
const searchKeyword = defineModel<string>('searchKeyword', { default: '' })
const isSearchActive = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

async function activateSearch(): Promise<void> {
  isSearchActive.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

function handleCreateCommand(command: string): void {
  if (command === 'folder') emit('createRoot')
  if (command === 'subject') emit('createSubject', null)
}
</script>

<template>
  <aside class="subject-folder-sidebar">
    <header class="subject-folder-header">
      <strong>文件夹</strong>
      <div class="subject-folder-header__actions">
        <button
          v-if="!isSearchActive"
          class="subject-folder-header__action"
          :class="{ active: !!searchKeyword }"
          type="button"
          title="搜索目录"
          @click="activateSearch"
        ><Search :size="15" /></button>
        <label v-else class="subject-folder-search">
          <Search :size="14" />
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            type="search"
            placeholder="搜索"
            @blur="isSearchActive = false"
            @keydown.esc.prevent="searchInputRef?.blur()"
          />
        </label>
        <button
          v-if="!isSearchActive"
          class="subject-folder-header__action"
          type="button"
          title="刷新目录"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <Loader2 v-if="loading" :size="15" class="spin" />
          <RefreshCw v-else :size="15" />
        </button>
        <el-dropdown v-if="!isSearchActive" popper-class="subject-category-create-popper" @command="handleCreateCommand">
          <button class="subject-folder-header__action" type="button" title="新建" @click.stop>
            <Plus :size="16" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="folder"><FolderPlus :size="13" />新建文件夹</el-dropdown-item>
              <el-dropdown-item command="subject" divided><Plus :size="13" />新建主体</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>
    <nav class="subject-folder-list" aria-label="主体文件夹">
      <button
        class="subject-root-folder"
        :class="{ active: selectedCategoryId === null }"
        type="button"
        @click="emit('select', null)"
      >
        <FolderOpen :size="16" /><span>全部主体</span>
      </button>
      <ul v-if="categories.length" class="subject-folder-tree" role="tree">
        <SubjectCategoryTreeNode
          v-for="category in categories"
          :key="category.id"
          :node="category"
          :selected-category-id="selectedCategoryId"
          @select="emit('select', $event)"
          @create-child="emit('createChild', $event)"
          @create-subject="emit('createSubject', $event)"
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
        />
      </ul>
      <p v-else-if="!loading" class="subject-folder-empty">
        {{ searchKeyword ? '没有匹配的目录' : '暂无目录' }}
      </p>
    </nav>
  </aside>
</template>

<style scoped src="./SubjectLibrarySidebar.scss"></style>
