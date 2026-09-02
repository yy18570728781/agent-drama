<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { nextTick, ref } from 'vue'
import './FlowLibraryFolderHeader.scss'

defineOptions({ name: 'FlowLibraryFolderHeader' })

defineProps<{
  canManageRoot: boolean
  canManageRootPermissions: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  createCanvas: []
  createFolder: []
  openPermission: []
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

function deactivateSearch(): void {
  isSearchActive.value = false
}

function handleCommand(command: string): void {
  if (command === 'create-folder') emit('createFolder')
  if (command === 'create-canvas') emit('createCanvas')
  if (command === 'permission') emit('openPermission')
}
</script>

<template>
  <header class="flow-folder-header">
    <strong>文件夹</strong>
    <div class="flow-folder-header__actions">
      <button
        v-if="!isSearchActive"
        class="folder-header-action"
        :class="{ active: !!searchKeyword }"
        type="button"
        title="搜索目录"
        @click="activateSearch"
      >
        <Icon icon="lucide:search" />
      </button>
      <label v-else class="folder-search-field">
        <Icon icon="lucide:search" />
        <input
          ref="searchInputRef"
          v-model="searchKeyword"
          type="search"
          placeholder="搜索"
          @blur="deactivateSearch"
          @keydown.esc.prevent="searchInputRef?.blur()"
        />
      </label>

      <button
        v-if="!isSearchActive"
        class="folder-header-action"
        type="button"
        title="刷新目录"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <Icon icon="lucide:refresh-cw" :class="{ spin: isLoading }" />
      </button>

      <el-dropdown
        v-if="!isSearchActive && canManageRootPermissions"
        popper-class="flow-root-actions-popper"
        @command="handleCommand"
      >
        <button class="folder-header-action" type="button" title="更多操作" @click.stop>
          <Icon icon="lucide:ellipsis" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="permission">
              <Icon icon="lucide:shield-check" />权限管理
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown
        v-if="!isSearchActive && canManageRoot"
        popper-class="flow-root-actions-popper"
        @command="handleCommand"
      >
        <button class="folder-header-action" type="button" title="新建" @click.stop>
          <Icon icon="lucide:plus" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="create-folder">
              <Icon icon="lucide:folder-plus" />新建文件夹
            </el-dropdown-item>
            <el-dropdown-item command="create-canvas" divided>
              <Icon icon="lucide:panels-top-left" />新建画布
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>
