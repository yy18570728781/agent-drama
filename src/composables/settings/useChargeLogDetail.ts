import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { findTeamonesAigcRecord, type AssetItem } from '@/api/assets'
import { assetToHistoryRecord } from '@/components/generation/generationResultAdapters'
import type { TeamonesChargeLogRecord } from '@/services/teamones/teamonesChargeLog.service'

type DetailRecord = ReturnType<typeof assetToHistoryRecord>

interface UseChargeLogDetailReturn {
  detailImageInfo: ComputedRef<Record<string, unknown> | null>
  detailImages: ComputedRef<string[]>
  detailIsVideo: ComputedRef<boolean>
  detailRecordId: ComputedRef<string | undefined>
  detailVisible: Ref<boolean>
  handleDetailClose: () => void
  openRecord: (row: TeamonesChargeLogRecord) => Promise<void>
}

/**
 * 管理积分流水关联生成记录的详情预览。
 * @returns 详情弹窗状态、派生数据与操作。
 */
export function useChargeLogDetail(): UseChargeLogDetailReturn {
  const detailVisible = ref(false)
  const detailRecord = ref<DetailRecord | null>(null)
  const detailImages = computed<string[]>(() => {
    const media = detailRecord.value?.images || detailRecord.value?.media || []
    return media.filter((item): item is string => typeof item === 'string')
  })
  const detailImageInfo = computed<Record<string, unknown> | null>(() => {
    const record = detailRecord.value
    if (!record) return null
    return {
      prompt: record.prompt || '',
      model: record.modelInfo || '',
      modelDisplayName: record.modelDisplayName || record.modelInfo || '',
      modelVendor: record.modelVendor || '',
      capability: record.model_info?.capabilities?.[0] || '',
      mode: record.param?.mode || '',
      createTime: record.date || '',
      referenceUrls: record.reference_urls || [],
      paramsDisplay: record.params_display || [],
      generateParams: record.param || null,
      originUrl: record._asset?.media?.[0]?.origin_url || normalizeOriginUrl(record._asset?.url),
    }
  })
  const detailRecordId = computed(() => detailRecord.value?.id || undefined)
  const detailIsVideo = computed(() => (
    detailRecord.value?.type === 'video' || detailRecord.value?.genType === 'video'
  ))

  function normalizeOriginUrl(value?: string | { origin_url: string }): string {
    return typeof value === 'string' ? value : value?.origin_url || ''
  }

  async function openRecord(row: TeamonesChargeLogRecord): Promise<void> {
    if (typeof row.aigc_record_id !== 'number' || row.aigc_record_id <= 0) return
    try {
      const asset = await findTeamonesAigcRecord(row.aigc_record_id)
      if (!asset) {
        ElMessage.warning('未找到对应抽卡记录')
        return
      }
      detailRecord.value = assetToHistoryRecord(asset as AssetItem)
      detailVisible.value = true
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载抽卡记录详情失败')
    }
  }

  function handleDetailClose(): void {
    detailVisible.value = false
    detailRecord.value = null
  }

  return {
    detailImageInfo, detailImages, detailIsVideo, detailRecordId,
    detailVisible, handleDetailClose, openRecord,
  }
}
