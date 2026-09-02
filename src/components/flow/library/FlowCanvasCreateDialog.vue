<script setup lang="ts">
import type { FlowCanvasCategoryOption, FlowCanvasCreateDraft } from './flowLibrary.types'
import type { ComputedRef } from 'vue'
import { Icon } from '@iconify/vue'
import { ImagePlus, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  FLOW_CANVAS_NAME_MAX_LENGTH,
  normalizeFlowCanvasName,
} from '@/composables/flow/flowNameValidation'
import './FlowCanvasCreateDialog.scss'

interface FlowCanvasCategoryNode extends FlowCanvasCategoryOption {
  children: FlowCanvasCategoryNode[]
}

defineOptions({ name: 'FlowCanvasCreateDialog' })

const props = withDefaults(defineProps<{
  categoryError?: string
  categoryLoading?: boolean
  categoryOptions?: readonly FlowCanvasCategoryOption[]
  defaultCoverUrl?: string
  defaultName?: string
  loading: boolean
  mode?: 'create' | 'edit'
  requireCategory?: boolean
}>(), {
  categoryError: '',
  categoryLoading: false,
  categoryOptions: () => [],
  defaultCoverUrl: '',
  defaultName: '',
  mode: 'create',
  requireCategory: false,
})

const emit = defineEmits<{
  confirm: [draft: FlowCanvasCreateDraft]
}>()

const visible = defineModel<boolean>('visible', { default: false })
const canvasName = ref('')
const selectedCategoryId = ref('')
const coverFile = ref<File | null>(null)
const coverPreviewUrl = ref('')
const objectPreviewUrl = ref('')
const removeCover = ref(false)
const errorMessage = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const dialogCopy = computed(() => props.mode === 'edit'
  ? {
      action: '保存修改',
      description: '更新画布名称与封面。',
      loadingAction: '保存中...',
      title: '编辑画布',
    }
  : {
      action: '创建画布',
      description: '创建后可继续添加节点、素材与子图。',
      loadingAction: '创建中...',
      title: '新建画布',
    })
const categoryTree: ComputedRef<FlowCanvasCategoryNode[]> = computed(() => {
  const nodeById = new Map<string, FlowCanvasCategoryNode>()
  props.categoryOptions.forEach((item) => nodeById.set(item.id, { ...item, children: [] }))
  const roots: FlowCanvasCategoryNode[] = []
  props.categoryOptions.forEach((item) => {
    const node = nodeById.get(item.id)
    if (!node) return
    const parent = nodeById.get(item.pid)
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  })
  return roots
})

function releaseObjectPreview(): void {
  if (objectPreviewUrl.value) URL.revokeObjectURL(objectPreviewUrl.value)
  objectPreviewUrl.value = ''
}

function clearCover(): void {
  releaseObjectPreview()
  coverPreviewUrl.value = ''
  coverFile.value = null
  removeCover.value = !!props.defaultCoverUrl
}

function resetForm(): void {
  releaseObjectPreview()
  canvasName.value = normalizeFlowCanvasName(props.defaultName)
  selectedCategoryId.value = ''
  coverFile.value = null
  coverPreviewUrl.value = props.defaultCoverUrl
  removeCover.value = false
  errorMessage.value = ''
}

function closeDialog(): void {
  if (props.loading) return
  visible.value = false
}

function confirmSubmission(): void {
  if (props.categoryLoading) return
  const name = normalizeFlowCanvasName(canvasName.value)
  if (!name) {
    errorMessage.value = '请输入画布名称'
    return
  }
  if ((props.requireCategory || props.categoryOptions.length) && !selectedCategoryId.value) {
    if (props.categoryError) {
      errorMessage.value = props.categoryError
      return
    }
    errorMessage.value = '请选择保存目录'
    return
  }
  emit('confirm', {
    categoryId: selectedCategoryId.value || undefined,
    name,
    coverFile: coverFile.value,
    removeCover: removeCover.value,
  })
}

function selectCategory(node: FlowCanvasCategoryNode): void {
  if (node.disabled) return
  selectedCategoryId.value = node.id
  errorMessage.value = ''
}

function selectCover(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  releaseObjectPreview()
  coverFile.value = file
  removeCover.value = false
  objectPreviewUrl.value = URL.createObjectURL(file)
  coverPreviewUrl.value = objectPreviewUrl.value
}

watch(visible, async (isVisible: boolean) => {
  if (!isVisible) {
    releaseObjectPreview()
    return
  }
  resetForm()
  await nextTick()
  inputRef.value?.focus()
})

onBeforeUnmount(releaseObjectPreview)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogCopy.title"
    width="500px"
    :close-on-click-modal="!loading"
    :close-on-press-escape="!loading"
    :show-close="false"
    append-to-body
    class="flow-canvas-create-dialog"
  >
    <template #header>
      <header class="canvas-dialog-heading">
        <h3>{{ dialogCopy.title }}</h3>
        <button
          class="canvas-dialog-close"
          type="button"
          :disabled="loading"
          :aria-label="`关闭${dialogCopy.title}`"
          title="关闭"
          @click="closeDialog"
        >
          <X :size="18" />
        </button>
        <p>{{ dialogCopy.description }}</p>
      </header>
    </template>
    <div class="canvas-create-form">
      <div v-if="requireCategory || categoryOptions.length" class="canvas-form-field">
        <span>保存目录 <b>*</b></span>
        <div class="canvas-category-tree">
          <el-tree
            v-if="!categoryLoading && categoryOptions.length"
            :data="categoryTree"
            node-key="id"
            default-expand-all
            highlight-current
            :expand-on-click-node="false"
            :props="{ children: 'children', label: 'label', disabled: 'disabled' }"
            @node-click="selectCategory"
          >
            <template #default="{ data }">
              <span class="canvas-category-tree__node">
                <Icon :icon="selectedCategoryId === data.id ? 'lucide:folder-open' : 'lucide:folder'" />
                <span>{{ data.label }}</span>
              </span>
            </template>
          </el-tree>
          <div v-else class="canvas-category-tree__state">
            {{ categoryLoading ? '正在加载文件夹...' : '暂无可选文件夹' }}
          </div>
        </div>
        <small v-if="categoryError">{{ categoryError }}</small>
      </div>
      <label class="canvas-form-field">
        <span>名称 <b>*</b></span>
        <input
          ref="inputRef"
          v-model="canvasName"
          :maxlength="FLOW_CANVAS_NAME_MAX_LENGTH"
          placeholder="请输入画布名称"
          @input="errorMessage = ''"
          @keydown.enter.prevent="confirmSubmission"
        />
        <small v-if="errorMessage">{{ errorMessage }}</small>
      </label>

      <div class="canvas-form-field">
        <span>封面</span>
        <div class="cover-picker">
          <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="画布封面预览" />
          <label v-else class="cover-picker__empty">
            <ImagePlus :size="25" />
            <span>添加封面</span>
            <small>支持 JPG、PNG、GIF</small>
            <input type="file" accept="image/jpeg,image/png,image/gif" @change="selectCover" />
          </label>
          <label v-if="coverPreviewUrl" class="cover-picker__replace">
            <ImagePlus :size="14" />
            <span>更换</span>
            <input type="file" accept="image/jpeg,image/png,image/gif" @change="selectCover" />
          </label>
          <button v-if="coverPreviewUrl" type="button" title="移除封面" @click="clearCover">
            <X :size="14" />
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="dialog-button secondary" type="button" :disabled="loading" @click="closeDialog">
        取消
      </button>
      <button
        class="dialog-button primary"
        type="button"
        :disabled="loading || categoryLoading || (requireCategory && !!categoryError)"
        @click="confirmSubmission"
      >
        {{ loading ? dialogCopy.loadingAction : dialogCopy.action }}
      </button>
    </template>
  </el-dialog>
</template>
