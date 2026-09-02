<script setup lang="ts">
import { RefreshCw } from '@/components/common/icon/lucide'

defineOptions({ name: 'ChargeLogToolbar' })

interface BizTypeOption {
  value: number | ''
  label: string
}

interface OwnerOption {
  value: string
  label: string
}

defineProps<{
  activeBizType: number | null
  activeOwnerKey: string | null
  balanceDisplay: string
  totalConsumedDisplay: string
  loading: boolean
  ownerLoading: boolean
  ownerOptions: OwnerOption[]
  options: BizTypeOption[]
}>()

const emit = defineEmits<{
  refresh: []
  reset: []
  'update:activeBizType': [value: number | null]
  'update:activeOwnerKey': [value: string | null]
}>()

function handleBizTypeChange(value: number | ''): void {
  emit('update:activeBizType', value === '' ? null : value)
}

function handleOwnerChange(value: string): void {
  emit('update:activeOwnerKey', value || null)
}
</script>

<template>
  <header class="toolbar">
    <div class="toolbar-title">
      <h2>积分明细</h2>
      <p>查看账户积分的收入、消耗与计费归属</p>
    </div>

    <div class="metrics">
      <div class="metric-card">
        <span class="metric-label">当前剩余积分</span>
        <strong>{{ balanceDisplay }}</strong>
      </div>
      <div class="metric-divider" />
      <div class="metric-card">
        <span class="metric-label">累计消耗积分</span>
        <strong>{{ totalConsumedDisplay }}</strong>
      </div>
    </div>

    <div class="toolbar-actions">
      <el-select
        :model-value="activeOwnerKey"
        class="owner-select"
        placeholder="查询范围"
        :loading="ownerLoading"
        :disabled="ownerLoading && !ownerOptions.length"
        @change="handleOwnerChange"
      >
        <el-option
          v-for="option in ownerOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-select
        :model-value="activeBizType"
        class="biz-select"
        placeholder="全部业务类型"
        @change="handleBizTypeChange"
      >
        <el-option
          v-for="option in options"
          :key="String(option.value)"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <el-button class="reset-button" :disabled="loading" @click="emit('reset')">
        重置
      </el-button>
      <el-button class="refresh-button" :loading="loading" @click="emit('refresh')">
        <RefreshCw :size="15" />
        <span>刷新</span>
      </el-button>
    </div>
  </header>
</template>

<style scoped>
@import './ChargeLogToolbar.scss';
</style>
