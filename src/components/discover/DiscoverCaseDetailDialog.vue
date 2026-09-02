<script setup lang="ts">
import type { DiscoverCase, DiscoverCategoryAccess } from './discover.types'
import { computed, toRef } from 'vue'
import { LoaderCircle, Star, X } from '@/components/common/icon/lucide'
import { useDiscoverCaseDetail } from '@/composables/discover/useDiscoverCaseDetail'
import { useTeamonesResourcePermissions } from '@/composables/useTeamonesResourcePermissions'
import { FLOW_CATEGORY_PERMISSION } from '@/components/flow/library/flowCategoryPermission.constants'
import {
  FLOW_CASE_RELEASE_RESOURCE_CODE,
  TEAMONES_SHENSHU_APP_CODE,
} from '@/composables/flow/flowCasePermission.constants'
import FlowCanvasCreateDialog from '@/components/flow/library/FlowCanvasCreateDialog.vue'
import DiscoverCaseCover from './DiscoverCaseCover.vue'
import DiscoverCaseDetailActions from './DiscoverCaseDetailActions.vue'
import DiscoverCaseManageMenu from './DiscoverCaseManageMenu.vue'

defineOptions({ name: 'DiscoverCaseDetailDialog' })

const props = defineProps<{
  categoryAccessById: ReadonlyMap<string, DiscoverCategoryAccess>
  item: DiscoverCase | null
}>()

const emit = defineEmits<{
  caseChange: [item: DiscoverCase]
  close: []
  deleted: [caseId: string]
  recommendationChange: [caseId: string, recommended: boolean]
}>()

const {
  hasResourcePermission: hasReleaseCasePermission,
} = useTeamonesResourcePermissions(
  TEAMONES_SHENSHU_APP_CODE,
  FLOW_CASE_RELEASE_RESOURCE_CODE,
)
const {
  canEditOrDeleteCase,
  canMakeSame,
  canManageCase,
  canManageRecommendation,
  categoryLoading,
  categoryOptions,
  coverPending,
  createDialogVisible,
  deleteCase,
  detail,
  detailError,
  detailLoading,
  editDialogVisible,
  editPending,
  managementError,
  managementPending,
  makeSame,
  makeSameError,
  makingSame,
  openEditDialog,
  openMakeSameDialog,
  openPreview,
  recommendationError,
  recommendationPending,
  saveCaseChanges,
  setCaseCover,
  toggleRecommendation,
} = useDiscoverCaseDetail({
  canReleaseCase: hasReleaseCasePermission,
  categoryAccessById: toRef(props, 'categoryAccessById'),
  item: toRef(props, 'item'),
  onCaseChanged: (item) => emit('caseChange', item),
  onCreated: () => emit('close'),
  onDeleted: (caseId) => emit('deleted', caseId),
  onRecommendationChanged: (caseId, recommended) => {
    emit('recommendationChange', caseId, recommended)
  },
})

const permissionLabel = computed(() => {
  const permission = detail.value?.permission ?? 0
  if (permission >= FLOW_CATEGORY_PERMISSION.MANAGE) return '可管理'
  if (permission >= FLOW_CATEGORY_PERMISSION.EDIT) return '可编辑'
  if (permission >= FLOW_CATEGORY_PERMISSION.DOWNLOAD) return '可下载'
  return '仅可查看'
})

function closeDialog(): void {
  if (!makingSame.value && !managementPending.value) emit('close')
}
</script>

<template>
  <el-dialog
    class="discover-case-detail-dialog"
    modal-class="discover-case-detail-overlay"
    :model-value="!!item"
    append-to-body
    align-center
    destroy-on-close
    title="案例详情"
    :show-close="false"
    :close-on-click-modal="!makingSame && !managementPending"
    :close-on-press-escape="!makingSame && !managementPending"
    @close="closeDialog"
  >
    <header class="discover-case-detail__header">
      <button class="discover-case-detail__close" type="button" aria-label="关闭案例详情" @click="closeDialog">
        <X :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </header>

    <div v-if="detailLoading" class="discover-case-detail__state" role="status">
      正在加载案例详情...
    </div>
    <div v-else-if="detailError" class="discover-case-detail__state is-error" role="alert">
      {{ detailError }}
    </div>
    <div v-else-if="detail" class="discover-case-detail__body">
      <DiscoverCaseCover
        :alt="detail.imageAlt"
        :can-manage="canManageCase"
        :image="detail.image"
        :pending="coverPending"
        :video="detail.video"
        @select-cover="setCaseCover"
      />

      <section class="discover-case-detail__content" aria-labelledby="discover-case-detail-title">
        <div class="discover-case-detail__eyebrow">
          <span class="discover-case-detail__verified">VERIFIED CANVAS</span>
          <button
            v-if="canManageRecommendation"
            type="button"
            class="discover-case-detail__recommendation"
            :class="{ 'is-active': detail.featured }"
            :disabled="recommendationPending"
            :aria-label="recommendationPending ? '推荐状态处理中' : detail.featured ? '取消推荐案例' : '推荐案例'"
            :aria-pressed="detail.featured"
            @click="toggleRecommendation"
          >
            <LoaderCircle
              v-if="recommendationPending"
              class="discover-case-detail__spinner"
              :size="15"
              :stroke-width="1.8"
              aria-hidden="true"
            />
            <Star
              v-else
              :size="15"
              :stroke-width="1.8"
              :fill="detail.featured ? 'currentColor' : 'none'"
              aria-hidden="true"
            />
            {{ recommendationPending ? '处理中' : detail.featured ? '取消推荐' : '推荐' }}
          </button>
          <span v-else-if="detail.featured" class="discover-case-detail__recommendation-status">
            <Star :size="15" :stroke-width="1.8" fill="currentColor" aria-hidden="true" />
            已推荐
          </span>
          <DiscoverCaseManageMenu
            v-if="canEditOrDeleteCase"
            :pending="managementPending"
            @delete="deleteCase"
            @edit="openEditDialog"
          />
        </div>
        <h2 id="discover-case-detail-title">{{ detail.title }}</h2>
        <p class="discover-case-detail__description">{{ detail.description }}</p>

        <dl>
          <div><dt>案例分类</dt><dd>{{ detail.category || '未分类' }}</dd></div>
          <div><dt>案例作者</dt><dd>{{ detail.author }}</dd></div>
          <div><dt>当前权限</dt><dd>{{ permissionLabel }}</dd></div>
        </dl>

        <p v-if="recommendationError" class="discover-case-detail__action-error" role="alert">
          {{ recommendationError }}
        </p>
        <p v-if="makeSameError" class="discover-case-detail__action-error" role="alert">
          {{ makeSameError }}
        </p>
        <p v-if="managementError" class="discover-case-detail__action-error" role="alert">
          {{ managementError }}
        </p>

        <DiscoverCaseDetailActions
          :can-make-same="canMakeSame"
          :category-loading="categoryLoading"
          :making-same="makingSame"
          @make-same="openMakeSameDialog"
          @preview="openPreview"
        />
      </section>
    </div>
  </el-dialog>

  <FlowCanvasCreateDialog
    v-model:visible="createDialogVisible"
    :category-options="categoryOptions"
    :loading="makingSame"
    @confirm="makeSame"
  />

  <FlowCanvasCreateDialog
    v-if="detail"
    v-model:visible="editDialogVisible"
    :default-cover-url="detail.image"
    :default-name="detail.title"
    :loading="editPending"
    mode="edit"
    @confirm="saveCaseChanges"
  />
</template>

<style scoped src="./DiscoverCaseDetailDialog.scss"></style>
