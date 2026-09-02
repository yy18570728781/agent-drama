import type { ReferenceMediaType } from '@/composables/useFileDrop'
import { getOriginalImageFileName } from '@/utils/imageCompression'

interface PromptReferenceItem {
  file?: File
  referenceName?: string
  isVideo?: boolean
  mediaType?: ReferenceMediaType
}

export interface PromptReferenceMatch {
  index: number
  length: number
  referenceIndex: number
}

const MEDIA_TYPE_LABELS: Record<ReferenceMediaType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  '3d_model': '模型',
}

function getMediaType(item: PromptReferenceItem | undefined): ReferenceMediaType {
  return item?.mediaType || (item?.isVideo ? 'video' : 'image')
}

function getReferenceNameAliases(item: PromptReferenceItem): string[] {
  const name = getReferenceDisplayName(item, '')
  if (!name) return []
  const withoutExtension = name.replace(/\.[^.]+$/, '')
  return Array.from(new Set([name, withoutExtension].map(value => value.toLocaleLowerCase())))
}

function collectStructuredMatches(text: string, items: PromptReferenceItem[]): PromptReferenceMatch[] {
  const matches: PromptReferenceMatch[] = []
  const tokenRegex = /@\[([^\]\r\n]+)\]\([^)\r\n]*\)/g
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(text)) !== null) {
    const referenceName = match[1].trim().toLocaleLowerCase()
    const referenceIndex = items.findIndex(item => getReferenceNameAliases(item).includes(referenceName))
    if (referenceIndex >= 0) {
      matches.push({
        index: match.index,
        length: match[0].length,
        referenceIndex,
      })
    }
  }
  return matches
}

function collectNamedMatches(text: string, items: PromptReferenceItem[]): PromptReferenceMatch[] {
  const normalizedText = text.toLocaleLowerCase()
  const matches: PromptReferenceMatch[] = []
  items.forEach((item, referenceIndex) => {
    const name = getReferenceDisplayName(item, '')
    if (!name) return
    const token = `@${name}`
    const normalizedToken = token.toLocaleLowerCase()
    let fromIndex = 0
    while (fromIndex < normalizedText.length) {
      const index = normalizedText.indexOf(normalizedToken, fromIndex)
      if (index < 0) break
      matches.push({ index, length: token.length, referenceIndex })
      fromIndex = index + token.length
    }
  })
  return matches
}

function collectLegacyMatches(text: string, items: PromptReferenceItem[]): PromptReferenceMatch[] {
  const matches: PromptReferenceMatch[] = []
  const tokenRegex = /(图片|视频|音频|模型)\s*(\d+)/g
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(text)) !== null) {
    const mediaType = Object.entries(MEDIA_TYPE_LABELS)
      .find(([, label]) => label === match?.[1])?.[0] as ReferenceMediaType | undefined
    if (!mediaType) continue
    const referenceIndex = getReferenceIndexByOrdinal(items, mediaType, Number(match[2]))
    if (referenceIndex >= 0) {
      matches.push({ index: match.index, length: match[0].length, referenceIndex })
    }
  }
  return matches
}

function removeOverlappingMatches(matches: PromptReferenceMatch[]): PromptReferenceMatch[] {
  const sorted = [...matches].sort((a, b) => a.index - b.index || b.length - a.length)
  const result: PromptReferenceMatch[] = []
  sorted.forEach((match) => {
    const previous = result[result.length - 1]
    if (!previous || match.index >= previous.index + previous.length) result.push(match)
  })
  return result
}

/** Returns the stable prompt label, preferring the original file or subject name. */
export function getReferenceDisplayName(item: PromptReferenceItem | undefined, fallback: string): string {
  const referenceName = item?.referenceName?.trim() || ''
  if (referenceName) return referenceName
  const name = item?.file ? getOriginalImageFileName(item.file).trim() : ''
  return name && name !== 'empty' ? name : fallback
}

/** Returns the ordinal of a reference among items of the same media type. */
export function getReferenceOrdinal(items: PromptReferenceItem[], index: number): number {
  const mediaType = getMediaType(items[index])
  return items.slice(0, index + 1).filter((item) => getMediaType(item) === mediaType).length
}

/** Returns the legacy label retained for compatibility with existing prompts. */
export function getLegacyReferenceLabel(items: PromptReferenceItem[], index: number): string {
  const item = items[index]
  return item ? `${MEDIA_TYPE_LABELS[getMediaType(item)]}${getReferenceOrdinal(items, index)}` : ''
}

/** Builds a portable structured token that can be resolved after copying the prompt elsewhere. */
export function getPortableReferenceToken(items: PromptReferenceItem[], index: number): string {
  const name = getReferenceDisplayName(items[index], getLegacyReferenceLabel(items, index))
  const identifier = name
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '') || `reference_${index + 1}`
  return `@[${name}](${identifier})`
}

/** Resolves a media-type ordinal to its reference-array index. */
export function getReferenceIndexByOrdinal(
  items: PromptReferenceItem[],
  mediaType: ReferenceMediaType,
  ordinal: number,
): number {
  if (!Number.isFinite(ordinal) || ordinal <= 0) return -1
  let seen = 0
  return items.findIndex((item) => {
    if (getMediaType(item) !== mediaType) return false
    seen += 1
    return seen === ordinal
  })
}

/** Finds named `@reference` tokens and legacy numbered reference tokens in prompt text. */
export function findPromptReferenceMatches(
  text: string,
  items: PromptReferenceItem[],
): PromptReferenceMatch[] {
  return removeOverlappingMatches([
    ...collectStructuredMatches(text, items),
    ...collectNamedMatches(text, items),
    ...collectLegacyMatches(text, items),
  ])
}
