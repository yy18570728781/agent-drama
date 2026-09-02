<script setup lang="ts">
import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import { Icon } from '@iconify/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowCanvasCreateDialog from '@/components/flow/library/FlowCanvasCreateDialog.vue'
import FlowCanvasGrid from '@/components/flow/library/FlowCanvasGrid.vue'
import FlowCanvasPaginationState from '@/components/flow/library/FlowCanvasPaginationState.vue'
import FlowCanvasTreeLeaf from '@/components/flow/library/FlowCanvasTreeLeaf.vue'
import FlowCategoryPermissionDialog from '@/components/flow/library/FlowCategoryPermissionDialog.vue'
import FlowCategoryTreeNode from '@/components/flow/library/FlowCategoryTreeNode.vue'
import FlowLibraryFolderHeader from '@/components/flow/library/FlowLibraryFolderHeader.vue'
import FlowLibrarySplitLayout from '@/components/flow/library/FlowLibrarySplitLayout.vue'
import { activeWorkflowName } from '@/composables/flow/useFlowCore'
import { useFlowLibrary } from '@/composables/flow/useFlowLibrary'

defineOptions({ name: 'FlowLibraryView' })

const props = withDefaults(defineProps<{
  activeCanvasId?: string
  editorActive?: boolean
}>(), {
  activeCanvasId: '',
  editorActive: false,
})

const emit = defineEmits<{
  openCanvas: [canvasId: string]
  openCanvasNewWindow: [canvasId: string, categoryId: string]
}>()

const route = useRoute()
const router = useRouter()
const {
  cancelFolderCreation, canCreateCanvas, canDeleteCanvas, canEditCanvas, canManageRootCategory,
  canManageRootPermissions,
  canvases, confirmCreateCanvas, confirmEditCanvas, createCanvas,
  createCategoryOptions, createDialogVisible,
  createFolder, createRootFolder,
  deleteCanvas, deleteFolder, editCanvas, editDialogVisible, editingCanvas,
  errorMessage, favoritePendingIds, folderSearchKeyword,
  hasMoreCanvases, isCreatingCanvas, isEditingCanvas, isLoading, isLoadingMoreCanvases,
  loadedTreeCategoryIds, loadMoreCanvases, lockedPermissionUserIds, openPermissionDialog,
  openRootPermissionDialog, permissionCategory, rootCategoryId,
  permissionDialogVisible, refreshCategoryPermissions, refreshLibrary, renameFolder,
  requiresCreateCategory, searchKeyword, selectedCategoryId, selectCategory, toggleCanvasFavorite,
  selectRootCategory, treeCanvasesByCategory, treeLoadingCategoryId, visibleFolderTree,
} = useFlowLibrary()
const canvasScrollRef = ref<HTMLElement | null>(null)
const canOpenBlankCanvas = computed(() => !canCreateCanvas.value && (!!errorMessage.value || !selectedCategoryId.value))
const rootTreeCanvases = computed(() => {
  const rootCanvases = treeCanvasesByCategory.value[rootCategoryId.value] || []
  const keyword = folderSearchKeyword.value.trim().toLocaleLowerCase()
  if (!keyword) return rootCanvases
  return rootCanvases.filter((canvas) => canvas.name.toLocaleLowerCase().includes(keyword))
})

async function fillCanvasViewport(): Promise<void> {
  await nextTick()
  const element = canvasScrollRef.value
  if (!element || isLoading.value || isLoadingMoreCanvases.value || !hasMoreCanvases.value) return
  const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
  if (remaining <= 160) await loadMoreCanvases()
}

function handleCanvasScroll(): void {
  void fillCanvasViewport()
}

async function createCanvasInFolder(categoryId: string): Promise<void> {
  await selectCategory(categoryId)
  createCanvas()
}

async function createCanvasInRoot(): Promise<void> {
  if (canOpenBlankCanvas.value) {
    openBlankCanvas()
    return
  }
  await selectRootCategory()
  createCanvas()
}

function openBlankCanvas(): void {
  void router.push({
    name: route.meta.standalone === true ? 'flow-single' : 'flow',
    query: { new: '1' },
  })
}

function handleCreateCanvasClick(): void {
  if (canCreateCanvas.value) createCanvas()
  else openBlankCanvas()
}

async function editTreeCanvas(canvas: FlowLibraryCanvas, categoryId: string): Promise<void> {
  await selectCategory(categoryId)
  await editCanvas(canvas)
}

async function deleteTreeCanvas(canvas: FlowLibraryCanvas, categoryId: string): Promise<void> {
  await selectCategory(categoryId)
  await deleteCanvas(canvas)
}

watch(
  [() => canvases.value.length, isLoading, isLoadingMoreCanvases, hasMoreCanvases],
  () => { void fillCanvasViewport() },
  { flush: 'post' },
)

watch(activeWorkflowName, (name: string) => {
  const canvasId = props.activeCanvasId
  if (!canvasId) return
  const activeCanvas = canvases.value.find((canvas) => canvas.id === canvasId)
  if (activeCanvas) activeCanvas.name = name
  Object.values(treeCanvasesByCategory.value).forEach((categoryCanvases) => {
    const treeCanvas = categoryCanvases.find((canvas) => canvas.id === canvasId)
    if (treeCanvas) treeCanvas.name = name
  })
}, { flush: 'sync' })
</script>

<template>
  <section class="flow-library-page">
    <div class="flow-library">
      <FlowLibrarySplitLayout>
        <template #sidebar>
          <aside class="folder-sidebar">
            <FlowLibraryFolderHeader
              v-model:search-keyword="folderSearchKeyword"
              :can-manage-root="canManageRootCategory"
              :can-manage-root-permissions="canManageRootPermissions"
              :is-loading="isLoading"
              @create-canvas="createCanvasInRoot"
              @create-folder="createRootFolder"
              @open-permission="openRootPermissionDialog"
              @refresh="refreshLibrary"
            />
            <nav class="folder-list" aria-label="文件夹">
              <ul v-if="visibleFolderTree.length || rootTreeCanvases.length" class="folder-tree" role="tree">
                <FlowCategoryTreeNode
                  v-for="folder in visibleFolderTree"
                  :key="folder.id"
                  :active-canvas-id="activeCanvasId"
                  :canvases-by-category="treeCanvasesByCategory"
                  :loaded-category-ids="loadedTreeCategoryIds"
                  :loading-category-id="treeLoadingCategoryId"
                  :node="folder"
                  :selected-category-id="selectedCategoryId"
                  @cancel-create="cancelFolderCreation"
                  @create-canvas="createCanvasInFolder"
                  @create-child="createFolder"
                  @delete-canvas="deleteTreeCanvas"
                  @delete="deleteFolder"
                  @edit-canvas="editTreeCanvas"
                  @open-canvas="emit('openCanvas', $event)"
                  @open-canvas-new-window="(canvasId, categoryId) => emit('openCanvasNewWindow', canvasId, categoryId)"
                  @permission="openPermissionDialog"
                  @rename="renameFolder"
                  @select="selectCategory"
                />
                <FlowCanvasTreeLeaf
                  v-for="canvas in rootTreeCanvases"
                  :key="canvas.id"
                  :active="activeCanvasId === canvas.id"
                  :can-delete="selectedCategoryId === rootCategoryId && canDeleteCanvas"
                  :can-edit="selectedCategoryId === rootCategoryId && canEditCanvas"
                  :canvas="canvas"
                  @delete="deleteTreeCanvas($event, rootCategoryId)"
                  @edit="editTreeCanvas($event, rootCategoryId)"
                  @open="emit('openCanvas', $event)"
                  @open-new-window="emit('openCanvasNewWindow', $event, rootCategoryId)"
                />
              </ul>
              <p v-else-if="!isLoading" class="folder-empty">
                {{ folderSearchKeyword ? '没有匹配的目录' : '暂无目录' }}
              </p>
            </nav>
          </aside>
        </template>

        <template #content>
          <div class="library-content" :class="{ 'is-editor': editorActive }">
            <slot v-if="editorActive" name="editor" />
            <template v-else>
              <div class="content-toolbar">
                <button
                  class="create-canvas-button"
                  type="button"
                  :title="canCreateCanvas ? '新建画布' : '新建本地空白画布'"
                  @click="handleCreateCanvasClick"
                >
                  <Icon icon="lucide:plus" /><span>新建画布</span>
                </button>
                <label class="canvas-search">
                  <Icon icon="lucide:search" />
                  <input v-model="searchKeyword" type="search" placeholder="搜索画布名称" />
                </label>
              </div>

              <div ref="canvasScrollRef" class="canvas-scroll" @scroll.passive="handleCanvasScroll">
                <div v-if="isLoading" class="library-state"><Icon icon="lucide:loader-circle" class="spin" />正在加载画布</div>
                <div v-else-if="errorMessage" class="library-state error"><Icon icon="lucide:circle-alert" />{{ errorMessage }}</div>
                <div v-else-if="!selectedCategoryId" class="library-state"><Icon icon="lucide:folder-open" />请先选择文件夹</div>
                <div v-else-if="!canvases.length" class="library-state"><Icon icon="lucide:panels-top-left" />暂无画布</div>
                <FlowCanvasGrid
                  v-else
                  :can-delete="canDeleteCanvas"
                  :can-edit="canEditCanvas"
                  :canvases="canvases"
                  :favorite-pending-ids="favoritePendingIds"
                  @delete="deleteCanvas"
                  @edit="editCanvas"
                  @favorite="toggleCanvasFavorite"
                  @open="emit('openCanvas', $event)"
                  @open-new-window="emit('openCanvasNewWindow', $event, selectedCategoryId)"
                />
                <FlowCanvasPaginationState
                  :has-items="!!canvases.length"
                  :has-more="hasMoreCanvases"
                  :loading="isLoadingMoreCanvases"
                />
              </div>
            </template>
          </div>
        </template>
      </FlowLibrarySplitLayout>

      <FlowCategoryPermissionDialog
        v-if="permissionCategory"
        v-model:visible="permissionDialogVisible"
        :category-id="permissionCategory.id"
        :category-name="permissionCategory.name"
        :locked-user-ids="lockedPermissionUserIds"
        @updated="refreshCategoryPermissions"
      />

      <FlowCanvasCreateDialog
        v-model:visible="createDialogVisible"
        :category-options="requiresCreateCategory ? createCategoryOptions : []"
        :loading="isCreatingCanvas"
        :require-category="requiresCreateCategory"
        @confirm="confirmCreateCanvas"
      />

      <FlowCanvasCreateDialog
        v-if="editingCanvas"
        v-model:visible="editDialogVisible"
        :default-cover-url="editingCanvas.cover"
        :default-name="editingCanvas.name"
        :loading="isEditingCanvas"
        mode="edit"
        @confirm="confirmEditCanvas"
      />

    </div>
  </section>
</template>

<style scoped src="./FlowLibraryView.scss"></style>
