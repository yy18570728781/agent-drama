import { subjectAssetApi, type RawAsset, type RawMedia } from './subjectAsset'

// ================== 类型定义 ==================

export interface Subject {
  id: string
  name: string
  description?: string
  category_id: string
  media: SubjectMedia[]
  code?: string
  thumb?: string | null
  media_type?: 'image' | 'video'
  source_url?: string | null
}

export interface SubjectMedia {
  id: string
  file_id: string
  name?: string
  type?: string
  thumb?: string
  source_url?: string
  width?: number
  height?: number
  source: string
  is_primary: boolean
  sort_order: number
  relation_id: string
}

export interface SubjectCreateParams {
  name: string
  description?: string
  category_id: string
}

export interface SubjectUpdateParams {
  name?: string
  description?: string
  category_id?: string
}

export interface SubjectMediaAttachParams {
  media_file_id: string
  source?: string
  name?: string
  thumb?: string
  type?: string
  width?: number
  height?: number
}

// ================== 数据映射 ==================

function parseContent(raw: RawAsset['content']): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function extractDescription(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const val = (content as Record<string, unknown>).description
  return typeof val === 'string' ? val : ''
}

function mapAssetToSubject(raw: RawAsset, media: SubjectMedia[] = []): Subject {
  const content = parseContent(raw.content)
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    description: extractDescription(content),
    category_id: String(raw.category_id ?? ''),
    media,
    code: raw.code ?? '',
  }
}

function mapRawMedia(raw: RawMedia, coverId?: string | number | null): SubjectMedia {
  const id = String(raw.id)
  const isPrimary = coverId != null
    ? String(coverId) === id
    : raw.is_cover === '1' || raw.is_cover === 1
  return {
    id,
    file_id: id,
    name: raw.md5_name || undefined,
    type: raw.type,
    thumb: raw.thumb,
    source_url: /\.[a-z0-9]{2,5}(?:[?#]|$)/i.test(raw.path || '') ? raw.path : raw.thumb,
    width: raw.width,
    height: raw.height,
    source: 'teamones',
    is_primary: isPrimary,
    sort_order: 0,
    relation_id: id,
  }
}

function normalizeMediaOrder(media: SubjectMedia[]): SubjectMedia[] {
  if (!media.length) return []
  const cover = media.find((item) => item.is_primary) || media[0]
  const ordered = [cover, ...media.filter((item) => item.id !== cover.id)]
  return ordered.map((item, index) => ({
    ...item,
    is_primary: index === 0,
    sort_order: index,
  }))
}

// ================== 主体 CRUD ==================

/**
 * 获取主体详情（含媒体列表）。
 */
export async function getSubjectDetail(id: string): Promise<Subject | null> {
  const [detail, media] = await Promise.all([
    subjectAssetApi.getDetail(id),
    subjectAssetApi.getMedia(id),
  ])
  if (!detail) return null
  const coverId = detail.media?.cover ?? null
  return mapAssetToSubject(
    detail,
    normalizeMediaOrder((media || []).map((item) => mapRawMedia(item, coverId))),
  )
}

/**
 * 创建主体。
 */
export async function createSubject(params: SubjectCreateParams): Promise<Subject> {
  const code = subjectAssetApi.genCode('subject')
  const { id } = await subjectAssetApi.create(
    params.name,
    code,
    { description: params.description || '' },
    Number(params.category_id),
  )
  return {
    id,
    name: params.name,
    description: params.description,
    category_id: params.category_id,
    media: [],
    code,
  }
}

/**
 * 更新主体。
 */
export async function updateSubject(id: string, params: SubjectUpdateParams): Promise<Subject> {
  const content: Record<string, unknown> = {}
  if (params.description !== undefined) content.description = params.description

  await subjectAssetApi.update(id, params.name ?? '', content)

  const updated = await getSubjectDetail(id)
  return updated ?? {
    id,
    name: params.name ?? '',
    description: params.description,
    category_id: params.category_id ?? '',
    media: [],
  }
}

/**
 * 删除主体。
 */
export async function deleteSubject(id: string): Promise<void> {
  await subjectAssetApi.del(id)
}

// ================== 主体媒体 ==================

/**
 * 移除主体关联的媒体。
 */
export async function detachSubjectMedia(subjectId: string, mediaFileId: string): Promise<void> {
  await subjectAssetApi.detachMedia(subjectId, mediaFileId)
}

/**
 * 设置主体封面。
 */
export async function changeSubjectCover(subjectId: string, mediaId: string): Promise<void> {
  await subjectAssetApi.changeCover(subjectId, mediaId)
}
