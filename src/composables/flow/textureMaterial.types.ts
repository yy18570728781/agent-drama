import type { PBRChannel } from '@/types/pbr.types'

/**
 * texture_material 容器内每通道的轻量节点快照。
 *
 * 只保留持久化需要的字段，以及生成中/失败态的最小状态字段；
 * 不把 ports / inputs / outputs / paramDefs / preview / imageUrl 这类运行期字段写进 data。
 *
 * 打散时会按 type 重新 hydrate 成独立节点运行时数据。
 *
 * pbrChannel 是容器的语义标记，用于布局/标题，不进入 data。
 */
export interface TextureMaterialItem {
  /** 节点 id（打散后成为真实节点 id） */
  id: string
  /** 节点 type：'aigc_result' / 'file_input' / 'image_generation' */
  type: string
  /** 完整节点 data，与独立节点同构 */
  data: Record<string, any>
  /** 容器语义标记：PBR 通道（albedo / normal / ... ） */
  pbrChannel: PBRChannel
}

export interface TextureMaterialBatchMeta {
  sourceNodeId: string
  channels: PBRChannel[]
  active: boolean
}
