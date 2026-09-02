import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AssetItem } from '@/api/assets'
import { listTeamonesAigcRecords } from '@/api/assets'
import { restoreAigcRecord } from '@/services/assets/aigcRecord.service'

function getThumbnailUrl(record: AssetItem): string {
  const value = record.thumbnail_url ?? record.url
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.origin_url || value.proxy_url || ''
}

function getRecordVendor(record: AssetItem): string {
  return String(
    record.vendor
      ?? record.param?.vendor
      ?? record.param?.params?.vendor
      ?? '',
  ).trim()
}

function getRecordId(record: AssetItem): string {
  return String(record.record_id || record.id || '')
}

function formatRecordDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function getStatusTagType(status?: string): string {
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'cancelled') return 'danger'
  if (status === 'running' || status === 'pending') return 'warning'
  return 'info'
}

/**
 * Loads deleted Teamones records for the generation-page trash dialog.
 * @returns Deleted-record table state and pagination handlers
 */
export function useDeletedTeamonesRecords() {
  const loading = ref(false)
  const loadingMore = ref(false)
  const errorMessage = ref('')
  const records = ref<AssetItem[]>([])
  const total = ref(0)
  const offset = ref(0)
  const pageSize = ref(30)
  const restoringIds = ref(new Set<string>())
  const selectedIds = ref(new Set<string>())
  const hasMore = computed(() => records.value.length < total.value)

  async function loadRecords(reset = true): Promise<void> {
    if (reset) {
      loading.value = true
      offset.value = 0
      selectedIds.value = new Set()
      errorMessage.value = ''
    } else if (loading.value || loadingMore.value || !hasMore.value) {
      return
    } else {
      loadingMore.value = true
    }

    const deletedFilter = { is_delete: true }
    try {
      const response = await listTeamonesAigcRecords({
        filter: deletedFilter,
        limit: pageSize.value,
        offset: offset.value,
        includeCount: reset,
      })
      if (reset) total.value = response.total
      const nextItems = response.items || []
      records.value = reset ? nextItems : [...records.value, ...nextItems]
      offset.value += nextItems.length
    } catch (error: any) {
      if (reset) {
        records.value = []
        total.value = 0
      }
      errorMessage.value = error?.response?.data?.msg || error?.message || '已删除记录加载失败'
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  function toggleSelect(record: AssetItem): void {
    const recordId = getRecordId(record)
    if (!recordId) return
    const next = new Set(selectedIds.value)
    next.has(recordId) ? next.delete(recordId) : next.add(recordId)
    selectedIds.value = next
  }

  async function restoreRecord(record: AssetItem): Promise<void> {
    const recordId = getRecordId(record)
    if (!recordId || restoringIds.value.has(recordId)) return
      const next = new Set(restoringIds.value)
    next.add(recordId)
    restoringIds.value = next
    try {
      await restoreAigcRecord(recordId)
      records.value = records.value.filter(item => getRecordId(item) !== recordId)
      total.value = Math.max(0, total.value - 1)
      const selected = new Set(selectedIds.value)
      selected.delete(recordId)
      selectedIds.value = selected
      ElMessage.success('记录已恢复')
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.msg || error?.message || '恢复记录失败')
    } finally {
      const updated = new Set(restoringIds.value)
      updated.delete(recordId)
      restoringIds.value = updated
    }
  }

  async function restoreSelected(): Promise<void> {
    const ids = Array.from(selectedIds.value)
    if (!ids.length) return
    for (const recordId of ids) {
      const record = records.value.find(item => getRecordId(item) === recordId)
      if (record) await restoreRecord(record)
    }
  }

  return {
    loading,
    loadingMore,
    errorMessage,
    records,
    total,
    pageSize,
    hasMore,
    restoringIds,
    selectedIds,
    thumbnailUrl: getThumbnailUrl,
    recordVendor: getRecordVendor,
    getRecordId,
    formatDate: formatRecordDate,
    statusTagType: getStatusTagType,
    loadRecords,
    toggleSelect,
    restoreRecord,
    restoreSelected,
  }
}
