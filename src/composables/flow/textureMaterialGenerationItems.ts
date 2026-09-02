import { createFlowId } from '@/utils/flowId'
import { sanitizeTextureMaterialItemData } from '@/utils/textureMaterialItems'
import type { PBRChannel } from '@/types/pbr.types'
import { applyCompletedPatch, patchDataOnCreated, patchDataOnProgress } from './generationNodeDataPatcher'

export function buildTextureMaterialSourceItem(upstreamNode: any) {
  return {
    id: createFlowId('node'),
    type: String(upstreamNode?.type || 'file_input'),
    data: sanitizeTextureMaterialItemData(String(upstreamNode?.type || 'file_input'), upstreamNode?.data || {}),
    pbrChannel: 'albedo' as PBRChannel,
  }
}

export function buildTextureMaterialGenerationItem(channel: PBRChannel) {
  return {
    id: createFlowId('node'),
    type: 'image_generation',
    data: sanitizeTextureMaterialItemData('image_generation', {
      label: channel,
      mediaType: 'image',
      status: 'waiting_submit',
      statusText: '等待提交...',
      progress: 0,
      request: {
        capability: 'image_generation',
        mode: 'standard',
        params: { prompt: channel },
      },
    }),
    pbrChannel: channel,
  }
}

export function applyTextureMaterialCreatedItem(item: any, payload: any, deps: any) {
  return {
    ...item,
    data: sanitizeTextureMaterialItemData(item.type, patchDataOnCreated(item.data || {}, payload, deps)),
  }
}

export function applyTextureMaterialProgressItem(item: any, payload: any, deps: any) {
  return {
    ...item,
    data: sanitizeTextureMaterialItemData(item.type, patchDataOnProgress(item.data || {}, payload, deps)),
  }
}

export function applyTextureMaterialCompletedItem(item: any, ctx: any, deps: any) {
  return {
    ...item,
    type: 'aigc_result',
    data: sanitizeTextureMaterialItemData('aigc_result', applyCompletedPatch(item.data || {}, ctx, deps)),
  }
}
