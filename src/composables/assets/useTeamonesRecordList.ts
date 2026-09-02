import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { countTeamonesAigcRecords, listTeamonesAigcRecords, type AssetItem } from '@/api/assets'
import client from '@/api/client'
import type { UseTeamonesRecordListReturn } from './teamonesRecordList.types'

function getThumbnailUrl(record: AssetItem): string {
  const value = record.thumbnail_url ?? record.url
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.origin_url || value.proxy_url || ''
}

function getRecordId(record: AssetItem): string {
  return String(record.record_id || record.id || '')
}

function hasRecordMedia(record: AssetItem): boolean {
  return Boolean(getThumbnailUrl(record))
}

function getStatusTagType(status?: string): string {
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'cancelled') return 'danger'
  if (status === 'running' || status === 'pending') return 'warning'
  return 'info'
}

function getRecordStatusText(record: AssetItem): string {
  if (record.status === 'failed') return '失败'
  if (record.status === 'cancelled') return '已取消'
  if (record.status === 'completed') return '已完成'
  if (record.status === 'running') return '生成中'
  if (record.status === 'pending') return '排队中'
  return record.statusText || record.status || '未知'
}

function getRecordFailReason(record: AssetItem): string {
  return String(
    record.failReason
      ?? record.fail_reason?.error_message
      ?? record.fail_reason?.message
      ?? record.statusText
      ?? record.error
      ?? '',
  ).trim()
}

function formatRecordDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return fallback
  const response = 'response' in error ? error.response : null
  if (!response || typeof response !== 'object' || !('data' in response)) return fallback
  const data = response.data
  if (!data || typeof data !== 'object' || !('msg' in data)) return fallback
  return typeof data.msg === 'string' && data.msg ? data.msg : fallback
}

/**
 * Handles Teamones record listing, repair, and trash-mode querying.
 * @returns Reactive page state and handlers for Teamones record list
 */
export function useTeamonesRecordList(): UseTeamonesRecordListReturn {
  const loading = ref(false)
  const errorMessage = ref('')
  const records = ref<AssetItem[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const trashMode = ref(false)
  const repairingIds = ref(new Set<string>())

  const pageTitle = computed(() => trashMode.value ? '抽卡记录回收站' : '抽卡记录')
  function canRepairRecord(record: AssetItem): boolean {
    return !trashMode.value && (record.status === 'failed' || !hasRecordMedia(record))
  }

  async function repairRecord(record: AssetItem): Promise<void> {
    const recordId = getRecordId(record)
    if (!recordId) {
      ElMessage.warning('无法获取记录ID')
      return
    }
    const next = new Set(repairingIds.value)
    next.add(recordId)
    repairingIds.value = next
    try {
      const { data } = await client.post(`/api/aigc_record/${encodeURIComponent(recordId)}/repair`)
      const body = data?.data ?? data
      if (body?.rescue?.rescued === true) {
        ElMessage.success('记录修复成功')
        await fetchRecords(false)
        return
      }
      ElMessage.warning('未修复记录')
    } catch (error: unknown) {
      ElMessage.error(resolveErrorMessage(error, '记录修复失败'))
    } finally {
      const updated = new Set(repairingIds.value)
      updated.delete(recordId)
      repairingIds.value = updated
    }
  }

  async function fetchRecords(refreshTotal: boolean): Promise<void> {
    loading.value = true
    errorMessage.value = ''
    const requestFilter: Record<string, unknown> = trashMode.value ? { is_delete: true } : {}
    try {
      const offset = (currentPage.value - 1) * pageSize.value
      const countRequest = refreshTotal
        ? countTeamonesAigcRecords(requestFilter)
        : Promise.resolve(total.value)
      const [count, response] = await Promise.all([
        countRequest,
        listTeamonesAigcRecords({
          filter: requestFilter,
          limit: pageSize.value,
          offset,
          includeCount: false,
        }),
      ])
      total.value = count
      const lastPage = Math.max(1, Math.ceil(Math.max(count, 1) / pageSize.value))
      if (count > 0 && currentPage.value > lastPage) {
        currentPage.value = lastPage
        await fetchRecords(false)
        return
      }
      records.value = response.items || []
    } catch (error: unknown) {
      records.value = []
      total.value = 0
      errorMessage.value = resolveErrorMessage(error, '抽卡记录加载失败')
    } finally {
      loading.value = false
    }
  }

  function loadRecords(): Promise<void> {
    return fetchRecords(true)
  }

  function handleCurrentChange(page: number): void {
    currentPage.value = page
    void fetchRecords(false)
  }

  function handleSizeChange(size: number): void {
    pageSize.value = size
    currentPage.value = 1
    void fetchRecords(false)
  }

  function toggleTrashMode(): void {
    trashMode.value = !trashMode.value
    currentPage.value = 1
    void fetchRecords(true)
  }

  async function copyRecordFailReason(record: AssetItem): Promise<void> {
    const message = getRecordFailReason(record)
    if (!message) {
      ElMessage.warning('没有可复制的错误信息')
      return
    }
    try {
      await navigator.clipboard.writeText(message)
      ElMessage.success('错误信息已复制')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '复制失败')
    }
  }

  return {
    loading,
    errorMessage,
    records,
    total,
    currentPage,
    pageSize,
    trashMode,
    repairingIds,
    pageTitle,
    thumbnailUrl: getThumbnailUrl,
    recordFailReason: getRecordFailReason,
    copyRecordFailReason,
    getRecordId,
    canRepairRecord,
    repairRecord,
    formatDate: formatRecordDate,
    recordStatusText: getRecordStatusText,
    statusTagType: getStatusTagType,
    loadRecords,
    handleCurrentChange,
    handleSizeChange,
    toggleTrashMode,
  }
}
