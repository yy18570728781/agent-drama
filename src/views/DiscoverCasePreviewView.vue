<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Copy } from '@/components/common/icon/lucide'
import FlowReadonlyCanvas from '@/components/flow/FlowReadonlyCanvas.vue'
import FlowCanvasCreateDialog from '@/components/flow/library/FlowCanvasCreateDialog.vue'
import { useDiscoverCasePreview } from '@/composables/discover/useDiscoverCasePreview'
import { useDocumentTitle } from '@/composables/useDocumentTitle'

defineOptions({ name: 'DiscoverCasePreviewView' })

const route = useRoute()

function readCaseId(): string {
  const value = route.params.caseId
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
}

const {
  canMakeSame,
  categoryLoading,
  categoryOptions,
  createDialogVisible,
  definition,
  errorMessage,
  loading,
  makeSame,
  makeSameError,
  makingSame,
  openMakeSameDialog,
  title,
} = useDiscoverCasePreview(readCaseId())

useDocumentTitle(title)
</script>

<template>
  <section class="discover-case-preview-view">
    <header class="discover-case-preview-view__header">
      <div class="discover-case-preview-view__title">
        <strong>{{ title }}</strong>
        <span v-if="makeSameError" role="alert">{{ makeSameError }}</span>
      </div>
      <div class="discover-case-preview-view__actions">
        <button
          v-if="canMakeSame"
          class="discover-case-preview-view__make-same"
          type="button"
          :disabled="makingSame || categoryLoading"
          @click="openMakeSameDialog"
        >
          <Copy :size="15" :stroke-width="1.8" aria-hidden="true" />
          {{ categoryLoading ? '正在加载目录...' : '制作同款' }}
        </button>
      </div>
    </header>

    <main class="discover-case-preview-view__content">
      <div v-if="loading" class="discover-case-preview-view__state" role="status">
        正在加载画布内容...
      </div>
      <div v-else-if="errorMessage" class="discover-case-preview-view__state is-error" role="alert">
        {{ errorMessage }}
      </div>
      <FlowReadonlyCanvas
        v-else-if="definition"
        :aria-label="`${title}只读画布`"
        :definition="definition"
        inspectable
        instance-id="discover-case-readonly-preview"
      />
    </main>

    <FlowCanvasCreateDialog
      v-model:visible="createDialogVisible"
      :category-options="categoryOptions"
      :loading="makingSame"
      @confirm="makeSame"
    />
  </section>
</template>

<style scoped src="./DiscoverCasePreviewView.scss"></style>
