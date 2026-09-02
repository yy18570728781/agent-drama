import type { PBRChannel } from '@/types/pbr.types'

export const TEXTURE_MATERIAL_PORT_ORDER: PBRChannel[] = [
  'albedo',
  'normal',
  'roughness',
  'metallic',
  'ao',
  'edge',
  'displacement',
]

export function getTextureMaterialPortLabel(channel: string): string {
  switch (String(channel || '').trim()) {
    case 'albedo':
      return 'BaseColor'
    case 'normal':
      return 'Normal'
    case 'roughness':
      return 'Roughness'
    case 'metallic':
      return 'Metallic'
    case 'ao':
      return 'AO'
    case 'edge':
      return 'Edge'
    case 'displacement':
      return 'Height'
    default:
      return String(channel || 'Texture').trim() || 'Texture'
  }
}

export function buildTextureMaterialPorts() {
  return {
    inputs: TEXTURE_MATERIAL_PORT_ORDER.map((channel) => ({
      id: channel,
      label: getTextureMaterialPortLabel(channel),
      mediaType: 'image',
      direction: 'input',
      visible: true,
      multiple: false,
    })),
    outputs: [{
      id: 'material',
      label: 'Material',
      mediaType: 'texture_material',
      direction: 'output',
      visible: true,
      multiple: true,
    }],
  }
}

export function buildTextureMaterialConsumerNode(params: {
  id: string
  position: { x: number; y: number }
  label?: string
}) {
  return {
    id: params.id,
    type: 'texture_material',
    position: params.position,
    style: { width: '300px', height: '228px' },
    data: {
      label: params.label || '3D材质',
      mediaType: 'image',
      nodeKind: 'texture_material',
      ports: buildTextureMaterialPorts(),
    },
  }
}
