import type { Component } from 'vue'

export interface FlowCreationMenuItem {
  defaultCapability?: string
  key?: string
  type?: string
  label: string
  icon: Component
  color?: string
  mediaType?: string
}

const CREATION_ITEM_ORDER: Readonly<Record<string, number>> = {
  image_generation: 0,
  video_generation: 1,
  audio_generation: 2,
  text_generation: 3,
  camera_input: 4,
  annotation_note: 5,
}

// These node types remain registered so restoring their menu entries does not affect creation logic.
const TEMPORARILY_HIDDEN_CREATION_TYPES = new Set(['director_3d', 'model_generation'])

/**
 * Builds the shared ordered list used by every flow node-creation menu.
 * @param items Candidate node types supplied by the flow registry.
 * @returns Visible creation entries in their UI priority order.
 */
export function buildFlowCreationMenuItems(items: readonly FlowCreationMenuItem[]): FlowCreationMenuItem[] {
  return items
    .filter(item => !TEMPORARILY_HIDDEN_CREATION_TYPES.has(String(item.type || item.key || '')))
    .map(item => item.type === 'camera_input' ? { ...item, label: '摄像机参数' } : item)
    .sort((left, right) => {
      const leftOrder = CREATION_ITEM_ORDER[String(left.type || left.key || '')] ?? 99
      const rightOrder = CREATION_ITEM_ORDER[String(right.type || right.key || '')] ?? 99
      return leftOrder - rightOrder
    })
}
