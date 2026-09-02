<script setup lang="ts">
import type { FlowLibraryCanvas } from '@/api/flowLibrary'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import '@/styles/cardActionPopover.scss'

defineOptions({ name: 'FlowCanvasGrid' })
const props = defineProps<{
  canDelete: boolean
  canEdit: boolean
  canvases: FlowLibraryCanvas[]
  favoritePendingIds: Set<string>
}>()
const emit = defineEmits<{
  delete: [canvas: FlowLibraryCanvas]
  edit: [canvas: FlowLibraryCanvas]
  favorite: [canvas: FlowLibraryCanvas]
  open: [canvasId: string]
  openNewWindow: [canvasId: string]
}>()
const failedCoverUrls = ref(new Set<string>())
const openMenuCanvasId = ref('')

function handleCoverError(coverUrl: string): void {
  failedCoverUrls.value = new Set([...failedCoverUrls.value, coverUrl])
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚更新'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function handleMenuAction(action: 'delete' | 'edit' | 'open-new-window', canvas: FlowLibraryCanvas): void {
  if (action === 'open-new-window') emit('openNewWindow', canvas.id)
  if (action === 'edit' && props.canEdit) emit('edit', canvas)
  if (action === 'delete' && props.canDelete) emit('delete', canvas)
}

function handleMenuVisibility(canvasId: string, visible: boolean): void {
  if (visible) {
    openMenuCanvasId.value = canvasId
    return
  }
  if (openMenuCanvasId.value === canvasId) openMenuCanvasId.value = ''
}
</script>

<template>
  <div class="canvas-grid">
    <article
      v-for="canvas in canvases"
      :key="canvas.id"
      class="canvas-card"
      :class="{ 'is-menu-open': openMenuCanvasId === canvas.id }"
      role="button"
      tabindex="0"
      @click="emit('open', canvas.id)"
      @keydown.enter="emit('open', canvas.id)"
      @keydown.space.prevent="emit('open', canvas.id)"
    >
      <span class="canvas-cover">
        <span class="cover-placeholder" aria-hidden="true">
          <span class="cover-placeholder__graphic"><Icon icon="lucide:workflow" /></span>
        </span>
        <img
          v-if="canvas.cover && !failedCoverUrls.has(canvas.cover)"
          :src="canvas.cover"
          :alt="canvas.name"
          @error="handleCoverError(canvas.cover)"
        />
        <el-popover
          placement="bottom-end"
          trigger="hover"
          popper-class="card-action-popover"
          :offset="4"
          :show-arrow="false"
          :width="136"
          @show="handleMenuVisibility(canvas.id, true)"
          @hide="handleMenuVisibility(canvas.id, false)"
        >
          <template #reference>
            <button
              class="canvas-card__more"
              type="button"
              aria-haspopup="menu"
              :aria-expanded="openMenuCanvasId === canvas.id"
              aria-label="更多画布操作"
              title="更多操作"
              @click.stop
              @keydown.stop
            >
              <Icon icon="lucide:ellipsis" />
            </button>
          </template>
          <div class="card-action-menu" role="menu" @click.stop>
            <button
              class="card-action-menu__item"
              type="button"
              role="menuitem"
              @click.stop="handleMenuAction('open-new-window', canvas)"
            >
              <Icon icon="lucide:external-link" /><span>新窗口打开</span>
            </button>
            <div
              v-if="canEdit || canDelete"
              class="card-action-menu__separator"
              role="separator"
            />
            <button
              v-if="canEdit"
              class="card-action-menu__item"
              type="button"
              role="menuitem"
              @click.stop="handleMenuAction('edit', canvas)"
            >
              <Icon icon="lucide:pencil" /><span>编辑</span>
            </button>
            <button
              v-if="canDelete"
              class="card-action-menu__item is-danger"
              type="button"
              role="menuitem"
              @click.stop="handleMenuAction('delete', canvas)"
            >
              <Icon icon="lucide:trash-2" /><span>删除</span>
            </button>
          </div>
        </el-popover>
      </span>
      <span class="canvas-info">
        <strong>{{ canvas.name }}</strong>
        <button
          class="canvas-card__favorite"
          :class="{ 'is-active': canvas.isFavorite }"
          type="button"
          :disabled="favoritePendingIds.has(canvas.id)"
          :aria-label="canvas.isFavorite ? '取消收藏' : '收藏画布'"
          :title="canvas.isFavorite ? '取消收藏' : '收藏画布'"
          @click.stop="emit('favorite', canvas)"
          @keydown.stop
        >
          <Icon
            :icon="favoritePendingIds.has(canvas.id) ? 'lucide:loader-circle' : 'lucide:heart'"
            :class="{ spin: favoritePendingIds.has(canvas.id) }"
          />
        </button>
        <small>{{ formatUpdatedAt(canvas.updatedAt) }}</small>
      </span>
    </article>
  </div>
</template>

<style scoped lang="scss" src="./FlowCanvasGrid.scss"></style>
