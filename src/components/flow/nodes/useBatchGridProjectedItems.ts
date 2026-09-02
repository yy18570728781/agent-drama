import { computed, type ComputedRef } from 'vue'

interface BatchGridProjectedItem {
  id: string
  pbrChannel: string
  recordId: string
  url: string
  thumb: string
  displayUrl: string
  mediaType: string
  label: string
  status: string
  failReason: string
  progress?: number
  width?: number
  height?: number
  aspectRatio?: number
  mediaMeta?: Record<string, any>
  type: string
}

interface UseBatchGridProjectedItemsOptions {
  type: ComputedRef<string>
  rawItems: ComputedRef<any[]>
  channels: ComputedRef<string[]>
}

function readPositiveNumber(value: unknown): number | undefined {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : undefined
}

function readItemMediaMetrics(data: Record<string, any>) {
  const mediaMeta = data?.mediaMeta && typeof data.mediaMeta === 'object' ? data.mediaMeta : {}
  const width = readPositiveNumber(mediaMeta.width) || readPositiveNumber(data.width)
  const height = readPositiveNumber(mediaMeta.height) || readPositiveNumber(data.height)
  const aspectRatio = readPositiveNumber(mediaMeta.aspectRatio) || (width && height ? width / height : undefined)
  return { width, height, aspectRatio }
}

function projectItem(item: any): BatchGridProjectedItem {
  if (item?.data && typeof item.data === 'object') {
    const data = item.data
    const mediaMetrics = readItemMediaMetrics(data)
    return {
      id: String(item.id || ''),
      pbrChannel: String(item.pbrChannel || ''),
      recordId: String(data.recordId || ''),
      url: String(data.url || ''),
      thumb: String(data.thumb || data.thumbnail_url || ''),
      displayUrl: String(data.thumb || data.thumbnail_url || data.url || ''),
      mediaType: String(data.mediaType || 'image'),
      label: String(data.label || item.pbrChannel || ''),
      status: String(data.status || (data.isGenerating ? 'running' : '')),
      failReason: String(data.failReason || data.statusText || data.fail_reason || ''),
      progress: typeof data.progress === 'number' ? data.progress : undefined,
      width: mediaMetrics.width,
      height: mediaMetrics.height,
      aspectRatio: mediaMetrics.aspectRatio,
      mediaMeta: data.mediaMeta && typeof data.mediaMeta === 'object' ? data.mediaMeta : undefined,
      type: String(item.type || ''),
    }
  }
  const width = readPositiveNumber(item?.width)
  const height = readPositiveNumber(item?.height)
    return {
      id: String(item?.id || ''),
      pbrChannel: String(item?.pbrChannel || ''),
      recordId: String(item?.recordId || ''),
      url: String(item?.url || ''),
    thumb: String(item?.thumb || ''),
    displayUrl: String(item?.thumb || item?.url || ''),
    mediaType: String(item?.mediaType || 'image'),
    label: String(item?.label || ''),
    status: String(item?.status || ''),
    failReason: String(item?.failReason || item?.statusText || item?.fail_reason || ''),
    progress: typeof item?.progress === 'number' ? item.progress : undefined,
    width,
    height,
    aspectRatio: readPositiveNumber(item?.aspectRatio) || (width && height ? width / height : undefined),
    mediaMeta: item?.mediaMeta && typeof item.mediaMeta === 'object' ? item.mediaMeta : undefined,
    type: String(item?.type || ''),
  }
}

export function useBatchGridProjectedItems(options: UseBatchGridProjectedItemsOptions) {
  const items = computed(() => {
    const rawItems = Array.isArray(options.rawItems.value) ? options.rawItems.value : []
    void options.channels.value
    return rawItems.map(projectItem)
  })

  return { items }
}
