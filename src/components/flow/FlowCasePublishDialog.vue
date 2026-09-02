<script setup lang="ts">
import type { FlowCaseCategory } from '@/api/flowCases'
import type { FlowCasePublishDraft } from './flowCasePublication.types'
import { ImagePlus, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { buildFlowCaseCategoryTree } from '@/services/flow/flowCaseCategory.service'
import './FlowCasePublishDialog.scss'

defineOptions({ name: 'FlowCasePublishDialog' })

const props = defineProps<{
  categories: FlowCaseCategory[]
  defaultName: string
  loading: boolean
  publishing: boolean
}>()

const emit = defineEmits<{
  confirm: [draft: FlowCasePublishDraft]
}>()

const visible = defineModel<boolean>('visible', { default: false })
const caseName = ref('')
const selectedCategoryId = ref('')
const coverFile = ref<File | null>(null)
const coverPreviewUrl = ref('')
const errorMessage = ref('')
const categoryTree = computed(() => buildFlowCaseCategoryTree(props.categories))

function clearCover(): void {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value)
  coverPreviewUrl.value = ''
  coverFile.value = null
}

function selectCover(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  clearCover()
  coverFile.value = file
  coverPreviewUrl.value = URL.createObjectURL(file)
}

function confirmPublication(): void {
  const name = caseName.value.trim()
  if (!selectedCategoryId.value || !name) {
    errorMessage.value = !selectedCategoryId.value ? '请选择发布目录' : '请输入案例名称'
    return
  }
  emit('confirm', {
    categoryId: selectedCategoryId.value,
    coverFile: coverFile.value,
    name,
  })
}

watch(visible, (isVisible: boolean) => {
  if (!isVisible) {
    clearCover()
    return
  }
  caseName.value = `${props.defaultName || '未命名画布'}案例`
  selectedCategoryId.value = ''
  errorMessage.value = ''
  clearCover()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="发布案例"
    width="560px"
    :close-on-click-modal="!publishing"
    :close-on-press-escape="!publishing"
    :show-close="!publishing"
    class="flow-case-publish-dialog"
  >
    <div class="case-publish-form">
      <div class="case-publish-field">
        <span>发布目录 <b>*</b></span>
        <el-tree-select
          v-model="selectedCategoryId"
          class="case-category-select"
          :data="categoryTree"
          node-key="id"
          :props="{ value: 'id', label: 'name', children: 'children', disabled: 'disabled' }"
          :loading="loading"
          check-strictly
          clearable
          default-expand-all
          filterable
          loading-text="案例目录加载中..."
          no-data-text="暂无可发布的案例目录"
          no-match-text="未找到匹配的案例目录"
          placeholder="请选择或搜索案例目录"
          @change="errorMessage = ''"
        />
      </div>

      <label class="case-publish-field">
        <span>案例名称 <b>*</b></span>
        <input
          v-model="caseName"
          maxlength="128"
          placeholder="请输入案例名称"
          @input="errorMessage = ''"
          @keydown.enter.prevent="confirmPublication"
        />
      </label>

      <div class="case-publish-field">
        <span>封面</span>
        <div class="case-cover-picker">
          <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="案例封面预览" />
          <label v-else class="case-cover-picker__empty">
            <ImagePlus :size="24" />
            <span>添加封面</span>
            <small>支持 JPG、PNG、GIF</small>
            <input type="file" accept="image/jpeg,image/png,image/gif" @change="selectCover" />
          </label>
          <button v-if="coverPreviewUrl" type="button" title="移除封面" @click="clearCover">
            <X :size="14" />
          </button>
        </div>
      </div>
      <small v-if="errorMessage" class="case-publish-error">{{ errorMessage }}</small>
    </div>

    <template #footer>
      <button class="case-dialog-button secondary" type="button" :disabled="publishing" @click="visible = false">
        取消
      </button>
      <button
        class="case-dialog-button primary"
        type="button"
        :disabled="publishing || loading"
        @click="confirmPublication"
      >
        {{ publishing ? '发布中...' : '发布案例' }}
      </button>
    </template>
  </el-dialog>
</template>
