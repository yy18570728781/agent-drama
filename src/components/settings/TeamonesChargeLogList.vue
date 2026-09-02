<script setup lang="ts">
import { onMounted } from 'vue'
import MediaPreviewModal from '@/components/common/ImagePreviewModal.vue'
import ChargeLogTable from '@/components/settings/chargeLogs/ChargeLogTable.vue'
import ChargeLogToolbar from '@/components/settings/chargeLogs/ChargeLogToolbar.vue'
import { useChargeLogDetail } from '@/composables/settings/useChargeLogDetail'
import { useTeamonesChargeLogs } from '@/composables/settings/useTeamonesChargeLogs'

defineOptions({ name: 'TeamonesChargeLogList' })

const {
  activeBizType,
  activeOwnerKey,
  balanceDisplay,
  billingOwnerTypeText,
  currentPage,
  errorMessage,
  handleCurrentChange,
  handleSizeChange,
  loadCurrentUserPoints,
  loadLogs,
  loading,
  logs,
  ownerLoading,
  ownerOptions,
  pageSize,
  resetFilters,
  setBizType,
  setOwnerKey,
  total,
  totalConsumedDisplay,
} = useTeamonesChargeLogs()
const {
  detailImageInfo,
  detailImages,
  detailIsVideo,
  detailRecordId,
  detailVisible,
  handleDetailClose,
  openRecord,
} = useChargeLogDetail()

const bizTypeOptions = [
  { value: '', label: '全部业务类型' },
  { value: 1, label: '确认扣费' },
  { value: 2, label: '失败退款' },
  { value: 3, label: '人工调账' },
]

onMounted(async () => {
  await loadCurrentUserPoints()
  await loadLogs()
})

</script>

<template>
  <section class="charge-log-page">
    <ChargeLogToolbar
      :active-biz-type="activeBizType"
      :active-owner-key="activeOwnerKey"
      :balance-display="balanceDisplay"
      :total-consumed-display="totalConsumedDisplay"
      :loading="loading"
      :owner-loading="ownerLoading"
      :owner-options="ownerOptions"
      :options="bizTypeOptions"
      @update:active-biz-type="setBizType"
      @update:active-owner-key="setOwnerKey"
      @refresh="loadLogs"
      @reset="resetFilters"
    />

    <el-alert
      v-if="errorMessage"
      class="page-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="errorMessage"
    />

    <div class="table-card">
      <ChargeLogTable
        :billing-owner-text="billingOwnerTypeText"
        :loading="loading"
        :logs="logs"
        @open-record="openRecord"
      />
    </div>

    <footer class="page-footer">
      <span class="footer-summary">共 <strong>{{ total }}</strong> 条记录</span>
      <el-pagination
        background
        layout="sizes, prev, pager, next"
        :total="total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </footer>

    <MediaPreviewModal
      v-model:visible="detailVisible"
      :images="detailImages"
      :initial-index="0"
      :image-info="detailImageInfo"
      :full-mode="true"
      :show-inspector="true"
      :show-actions="true"
      :show-ai-tools="true"
      :show-workflow-actions="false"
      :show-favorite="false"
      :show-share="false"
      :show-delete="false"
      :is-favorited="false"
      :is-video="detailIsVideo"
      :record-id="detailRecordId"
      @close="handleDetailClose"
    />
  </section>
</template>

<style scoped>
@import './TeamonesChargeLogList.css';
</style>
