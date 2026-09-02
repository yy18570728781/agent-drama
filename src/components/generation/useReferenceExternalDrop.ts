import {
  collectSupportedReferenceFiles,
  normalizeDroppedUrl,
  parseDroppedAssetInfo,
} from '@/composables/useFileDrop'
import type { ReferenceExternalDropPayload } from './referenceMedia.types'

function buildDroppedUrls(event: DragEvent): string[] {
  const raw = event.dataTransfer?.getData('application/x-asset-url')
    || event.dataTransfer?.getData('text/uri-list')
    || event.dataTransfer?.getData('text/plain')
    || ''
  return raw
    .split(/\r?\n/)
    .map(line => normalizeDroppedUrl(line))
    .filter((url, index, list) =>
      !!url
      && (url.startsWith('http://') || url.startsWith('https://'))
      && list.indexOf(url) === index
    )
}

export function buildReferenceExternalDropPayload(
  event: DragEvent,
  replaceIndex?: number,
): ReferenceExternalDropPayload | null {
  const files = event.dataTransfer?.files?.length
    ? collectSupportedReferenceFiles(event.dataTransfer.files)
    : []
  const urls = buildDroppedUrls(event)
  const assetInfo = parseDroppedAssetInfo(event.dataTransfer?.getData('application/x-asset-info') || '')

  if (!files.length && !urls.length && !assetInfo) {
    return null
  }

  return {
    ...(files.length ? { files } : {}),
    ...(urls.length ? { urls } : {}),
    ...(assetInfo ? { assetInfo } : {}),
    ...(typeof replaceIndex === 'number' ? { replaceIndex } : {}),
  }
}
