<script setup lang="ts">
import type { TeamonesChargeLogRecord } from '@/services/teamones/teamonesChargeLog.service'

defineOptions({ name: 'ChargeLogTable' })

defineProps<{
  billingOwnerText: (row: TeamonesChargeLogRecord) => string
  loading: boolean
  logs: TeamonesChargeLogRecord[]
}>()

const emit = defineEmits<{
  openRecord: [row: TeamonesChargeLogRecord]
}>()

function hasRecordId(value?: number | null): boolean {
  return typeof value === 'number' && value > 0
}

function bizTypeText(value?: number | null): string {
  if (value === 1) return '确认扣费'
  if (value === 2) return '失败退款'
  if (value === 3) return '人工调账'
  return '-'
}

function bizTypeTagType(value?: number | null): 'danger' | 'success' | 'info' {
  if (value === 1) return 'danger'
  if (value === 2) return 'success'
  return 'info'
}

function billingOwnerTagType(value?: string | null): 'warning' | 'primary' | 'info' {
  if (value === 'group') return 'warning'
  if (value === 'user') return 'primary'
  return 'info'
}

function isIncome(row: TeamonesChargeLogRecord): boolean {
  // TO 流水方向约定：1 为支出，2 为收入。
  return row.direction === 2
}

function formatSignedCost(row: TeamonesChargeLogRecord): string {
  const amount = Math.abs(Number(row.cost ?? 0))
  return `${isIncome(row) ? '+' : '-'}${amount.toLocaleString()}`
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

</script>

<template>
  <div class="table-shell">
    <el-table
      v-loading="loading"
      class="charge-log-table"
      :data="logs"
      height="100%"
    >
      <el-table-column label="业务类型" min-width="120">
        <template #default="scope">
          <el-tag :type="bizTypeTagType(scope.row.biz_type)" effect="plain" round>
            {{ bizTypeText(scope.row.biz_type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="积分变动" min-width="110">
        <template #default="scope">
          <span class="cost" :class="isIncome(scope.row) ? 'cost-success' : 'cost-danger'">
            {{ formatSignedCost(scope.row) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="计费归属" min-width="110">
        <template #default="scope">
          <el-tag :type="billingOwnerTagType(scope.row.billing_owner_type)" effect="light" round>
            {{ billingOwnerText(scope.row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联记录" min-width="120">
        <template #default="scope">
          <el-button
            v-if="hasRecordId(scope.row.aigc_record_id)"
            link
            type="primary"
            @click="emit('openRecord', scope.row)"
          >
            查看记录
          </el-button>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="时间" min-width="190">
        <template #default="scope">
          <span class="date-cell">{{ formatDate(scope.row.created) }}</span>
        </template>
      </el-table-column>
      <template #empty>
        <div class="record-empty">
          <strong>暂无积分明细</strong>
          <span>账户产生积分变动后会显示在这里</span>
        </div>
      </template>
    </el-table>
  </div>
</template>

<style scoped>
@import './ChargeLogTable.css';
</style>
