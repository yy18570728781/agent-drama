import type { ComputedRef, Ref } from 'vue'
import type { AssetItem } from '@/api/assets'

export interface UseTeamonesRecordListReturn {
  loading: Ref<boolean>
  errorMessage: Ref<string>
  records: Ref<AssetItem[]>
  total: Ref<number>
  currentPage: Ref<number>
  pageSize: Ref<number>
  trashMode: Ref<boolean>
  repairingIds: Ref<Set<string>>
  pageTitle: ComputedRef<string>
  thumbnailUrl: (record: AssetItem) => string
  recordFailReason: (record: AssetItem) => string
  copyRecordFailReason: (record: AssetItem) => Promise<void>
  getRecordId: (record: AssetItem) => string
  canRepairRecord: (record: AssetItem) => boolean
  repairRecord: (record: AssetItem) => Promise<void>
  formatDate: (value: string) => string
  recordStatusText: (record: AssetItem) => string
  statusTagType: (status?: string) => string
  loadRecords: () => Promise<void>
  handleCurrentChange: (page: number) => void
  handleSizeChange: (size: number) => void
  toggleTrashMode: () => void
}
