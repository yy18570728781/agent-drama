import { ref, computed, type ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import { useGenerationHistoryStore } from '@/stores/generationHistory.store'
import { useAssetStore } from '@/stores/assets.store'
import { findTeamonesAigcRecord, getAsset } from '@/api/assets'
import { getApiBase } from '@/api/client'
import { getReferenceUrls, assetToHistoryRecord } from '@/components/generation/generationResultAdapters'
import { useAssetDeleteConfirm } from '@/composables/assets/useAssetDeleteConfirm'

export function useCardViewDetail(params: {
  completedAssets: ComputedRef<any[]>
  getAssetModelLabel: (asset: any) => string
}) {
  const store = useGenerationHistoryStore()
  const assetStore = useAssetStore()
  const { completedAssets, getAssetModelLabel } = params
  const { confirmDeleteOne } = useAssetDeleteConfirm()

  const detailVisible = ref(false)
  const detailRecord = ref<any>(null)
  const modelViewerUrl = ref('')
  const detailInitialIndex = ref(0)

  const detailImages = computed(() => {
    if (!detailRecord.value) return []
    const isVideo = detailRecord.value.type === 'video' || detailRecord.value.genType === 'video'
    return isVideo
      ? (detailRecord.value.media?.length ? detailRecord.value.media : [])
      : (detailRecord.value.images?.length ? detailRecord.value.images : [])
  })

  const detailIsVideo = computed(() => {
    return detailRecord.value?.type === 'video' || detailRecord.value?.genType === 'video'
  })

  const detailRecordId = computed(() => {
    return detailRecord.value?.id
  })

  const detailAssetId = computed(() => {
    return String((detailRecord.value as any)?._asset?.id || detailRecord.value?.id || '').trim()
  })

  const detailIsFavorited = computed(() => {
    const assetId = detailAssetId.value
    const storeAsset = assetStore.items.find((asset: any) => String(asset.id) === assetId)
    const detailAsset = (detailRecord.value as any)?._asset
    return Boolean(storeAsset?.is_favorites ?? detailAsset?.is_favorites)
  })

  const isDetailModel = computed(() => isModelAsset((detailRecord.value as any)?._asset || detailRecord.value))

  const detailImageInfo = computed(() => {
    if (!detailRecord.value) return null
    const rec = detailRecord.value
    const generateParams = rec.param || null
    return {
      prompt: rec.prompt || '',
      model: rec.modelInfo || generateParams?.params?.model || '',
      modelDisplayName: getAssetModelLabel((rec as any)._asset || rec) || (rec as any).model_display_name || rec.modelDisplayName || (rec as any).model_info?.display_name || (rec as any).model_info?.name || rec.modelInfo || '',
      modelVendor: (() => { const v = (rec as any).modelVendor || (rec as any).model_info?.publisher || (rec as any)._asset?.model_info?.publisher; return v ? (typeof v === 'string' ? v : v.id || v.name || '') : '' })(),
      capability: rec.capability || generateParams?.capability || '',
      mode: generateParams?.mode || rec.mode || '',
      createTime: rec.date || '',
      referenceUrls: getReferenceUrls(rec),
      paramsDisplay: (rec.params_display || []).filter((param: any) => param?.key !== 'prompt'),
      generateParams,
      originUrl: (rec as any)?._asset?.media?.[0]?.origin_url || (rec as any)?.media?.[0]?.origin_url || (rec as any)?.url?.origin_url || '',
    }
  })

  // ── URL 解析工具 ──
  function resolveAssetUrl(raw: any): string {
    if (!raw) return ''
    if (typeof raw === 'object') return raw.origin_url || raw.proxy_url || ''
    if (typeof raw === 'string') {
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
      return getApiBase() + raw
    }
    return ''
  }

  function resolveModelUrlValue(raw: any): string {
    if (!raw) return ''
    if (typeof raw === 'object') {
      const candidate = raw.origin_url || raw.proxy_url || raw.url || ''
      if (!candidate) return ''
      if (typeof candidate === 'string' && (candidate.startsWith('http://') || candidate.startsWith('https://'))) {
        return candidate
      }
      return getApiBase() + candidate
    }
    if (typeof raw === 'string') {
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
      return getApiBase() + raw
    }
    return ''
  }

  function resolveDragAssetUrl(asset: any): string {
    const mediaOriginUrl =
      asset?.media?.[0]?.origin_url
      || asset?._asset?.media?.[0]?.origin_url
      || asset?.media?.[0]?.url
      || asset?._asset?.media?.[0]?.url
      || asset?.url?.origin_url
      || asset?._asset?.url?.origin_url
      || asset?.url
      || asset?._asset?.url
      || asset?.thumbnail_url
      || asset?._asset?.thumbnail_url
      || ''
    return resolveAssetUrl(mediaOriginUrl)
  }

  function inferAssetType(asset: any): string {
    return String(
      asset?.type
      || asset?.genType
      || asset?.capability
      || asset?._asset?.type
      || asset?._asset?.genType
      || asset?._asset?.capability
      || ''
    ).toLowerCase()
  }

  function isModelAsset(asset: any): boolean {
    const type = inferAssetType(asset)
    return type === 'model' || type === '3d' || type.includes('model')
  }

  function isModelFileUrl(url: string): boolean {
    if (!url) return false
    return /\.(glb|gltf)(?:$|[?#])/i.test(url)
  }

  function collectModelUrlCandidates(asset: any): string[] {
    const rawCandidates = [
      asset?.media?.[0]?.origin_url,
      asset?._asset?.media?.[0]?.origin_url,
      asset?.media?.[0]?.proxy_url,
      asset?._asset?.media?.[0]?.proxy_url,
      asset?.media?.[0]?.url,
      asset?._asset?.media?.[0]?.url,
      asset?.url?.origin_url,
      asset?._asset?.url?.origin_url,
      asset?.url?.proxy_url,
      asset?._asset?.url?.proxy_url,
      asset?.url,
      asset?._asset?.url,
      asset?.thumbnail_url,
      asset?._asset?.thumbnail_url,
    ]
    return rawCandidates
      .map(candidate => resolveModelUrlValue(candidate))
      .filter((url, index, arr) => Boolean(url) && arr.indexOf(url) === index)
  }

  function resolveModelAssetUrl(asset: any): string {
    const candidates = collectModelUrlCandidates(asset)
    return candidates.find(isModelFileUrl) || candidates[0] || ''
  }

  // ── 详情面板操作 ──
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return dateStr.replace('T', ' ').substring(0, 16)
  }

  const getDetailInfo = (record: any) => {
    const params = record.param || {}
    let w = Number(params.width)
    let h = Number(params.height)
    if ((!w || !h) && params.size && typeof params.size === 'string') {
      const parts = params.size.split('x')
      if (parts.length === 2) {
        w = Number(parts[0])
        h = Number(parts[1])
      }
    }
    const fps = params.fps || params.frame_rate || 24
    let ratio = '-'
    let resolution = '标准'
    if (w && h) {
      const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
      const d = gcd(w, h)
      ratio = `${w/d}:${h/d}`
      const total = w * h
      if (total >= 3840 * 2160) resolution = '4K'
      else if (total >= 2560 * 1440) resolution = '2K'
      else if (total >= 1920 * 1080) resolution = '1080P'
      else if (total >= 1280 * 720) resolution = '720P'
      else resolution = '标准'
    }
    return {
      ratio,
      fps,
      resolution,
      time: formatDate(record.date || record.created_at),
      prompt: record.prompt || '无',
    }
  }

  const openDetail = (record: any) => {
    detailRecord.value = record
    detailInitialIndex.value = 0
    detailVisible.value = true
  }

  const openModelViewer = async (asset: any) => {
    let viewerUrl = resolveModelAssetUrl(asset)
    try {
      if ((!viewerUrl || !isModelFileUrl(viewerUrl)) && asset?.source === 'teamones_aigc_record' && asset?.record_id) {
        const detail = await findTeamonesAigcRecord(asset.record_id)
        if (detail) {
          viewerUrl = resolveModelAssetUrl(detail) || viewerUrl
        }
      }
      if ((!viewerUrl || !isModelFileUrl(viewerUrl)) && asset?.id) {
        const detail = await getAsset(asset.id)
        if (detail) {
          viewerUrl = resolveModelAssetUrl(detail) || viewerUrl
        }
      }
    } catch (e) {
    }
    if (!viewerUrl) {
      ElMessage.warning('无法获取模型文件地址')
      return
    }
    if (!isModelFileUrl(viewerUrl)) {
      ElMessage.warning('拿到的不是模型文件地址，请检查返回的资源链接')
      return
    }
    modelViewerUrl.value = viewerUrl
    detailVisible.value = true
  }

  const openAssetDetail = async (asset: any) => {
    if (isModelAsset(asset)) {
      await openModelViewer(asset)
      return
    }
    const record = assetToHistoryRecord(asset)
    openDetail(record)
    try {
      if (asset?.source === 'teamones_aigc_record' && asset?.record_id) {
        const detail = await findTeamonesAigcRecord(asset.record_id)
        if (detail) {
          const fullUrl = resolveAssetUrl(detail.url || asset.url)
          detailRecord.value = assetToHistoryRecord({ ...asset, ...detail }, fullUrl || undefined)
        }
        return
      }
      const detail = await getAsset(asset.id)
      const fullUrl = resolveAssetUrl(detail.url)
      if (fullUrl) {
        detailRecord.value = assetToHistoryRecord({ ...asset, ...detail }, fullUrl)
      }
    } catch (e) {
    }
  }

  const handleSelectHistoryFromPreview = async (id: number | string) => {
    const target = completedAssets.value.find((asset: any) => String(asset.id) === String(id))
    if (!target) return
    await openAssetDetail(target)
  }

  const handleDetailClose = () => {
    detailVisible.value = false
    modelViewerUrl.value = ''
  }

  const handleDetailReEdit = (_image: string, _index: number) => {
    detailVisible.value = false
  }

  const handleDetailEdit = (record: any) => {
    detailVisible.value = false
  }

  const handleDetailRegenerate = (_image: string, _index: number) => {
    detailVisible.value = false
  }

  const handleDetailDelete = async (id: number | string) => {
    try {
      await confirmDeleteOne()
      if (typeof id === 'string') {
        await assetStore.doDelete(id)
      } else {
        store.deleteRecord(id)
      }
      detailVisible.value = false
    } catch {
    }
  }

  async function handleDetailFavorite(): Promise<void> {
    const assetId = detailAssetId.value
    if (!assetId) return
    const nextFavorite = await assetStore.doToggleFavorite(assetId)
    if (nextFavorite === undefined || !detailRecord.value) return
    const record = detailRecord.value as any
    if (record._asset) {
      record._asset.is_favorites = nextFavorite
    }
    record.opType = nextFavorite ? 'favorite' : 'normal'
  }

  return {
    detailVisible,
    detailRecord,
    modelViewerUrl,
    detailInitialIndex,
    detailImages,
    detailIsVideo,
    detailRecordId,
    detailIsFavorited,
    isDetailModel,
    detailImageInfo,
    formatDate,
    getDetailInfo,
    openAssetDetail,
    openModelViewer,
    openDetail,
    handleSelectHistoryFromPreview,
    handleDetailClose,
    handleDetailReEdit,
    handleDetailEdit,
    handleDetailRegenerate,
    handleDetailDelete,
    handleDetailFavorite,
    resolveAssetUrl,
    resolveModelUrlValue,
    resolveDragAssetUrl,
    inferAssetType,
    isModelAsset,
    isModelFileUrl,
    collectModelUrlCandidates,
    resolveModelAssetUrl,
  }
}
