import type { PBRChannel } from '@/types/pbr.types'

const CHANNEL_KEYWORDS: Record<PBRChannel, string[]> = {
  albedo: ['base color', 'basecolor', 'albedo', 'diffuse', '底色', '基础色'],
  displacement: ['displacement', 'height', 'heightmap', '高度', '置换'],
  normal: ['normal', '法线'],
  roughness: ['roughness', 'rough', '粗糙'],
  metallic: ['metallic', 'metalness', 'metal', '金属'],
  ao: ['ambient occlusion', 'ambientocclusion', 'ao', '遮蔽', '环境遮蔽'],
  edge: ['edge', '边缘'],
}

const SPECIFIC_CHANNELS: PBRChannel[] = ['displacement', 'normal', 'roughness', 'metallic', 'ao', 'edge']

function normalizeSearchText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function includesChannelKeyword(text: string, channel: PBRChannel): boolean {
  return CHANNEL_KEYWORDS[channel].some(keyword => text.includes(keyword))
}

function matchChannelText(text: string): PBRChannel | '' {
  const specific = SPECIFIC_CHANNELS.find(channel => includesChannelKeyword(text, channel))
  if (specific) return specific
  return includesChannelKeyword(text, 'albedo') ? 'albedo' : ''
}

function getBracketText(text: string): string {
  const matches = [...text.matchAll(/\[([^\]]+)\]/g)]
  return matches.map(match => match[1]).join(' ')
}

/**
 * Infer a PBR channel from node or asset metadata.
 * @param input Node data, asset info, or API record-like object.
 * @returns The inferred channel, or an empty string when metadata is ambiguous.
 */
export function inferTextureMaterialChannel(input: any): PBRChannel | '' {
  const explicit = normalizeSearchText(input?.pbrChannel || input?.channel)
  if (Object.keys(CHANNEL_KEYWORDS).includes(explicit)) return explicit as PBRChannel

  const text = [
    input?.prompt,
    input?.param?.prompt,
    input?.param?.params?.prompt,
    input?.params?.prompt,
    input?.request?.params?.prompt,
    input?._genState?.prompt,
    input?.label,
    input?.name,
    input?.filename,
    input?.file_name,
    input?.url,
    input?.thumb,
    input?.model,
    input?.keywords,
  ].map(normalizeSearchText).filter(Boolean).join(' ')

  if (!text) return ''
  return matchChannelText(getBracketText(text))
}
