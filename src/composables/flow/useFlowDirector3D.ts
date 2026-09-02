import type { Ref } from 'vue'
import { createFlowEdgeId, createFlowNodeId } from '@/utils/flowId'
import {
  director3DActiveNodeId,
  edges,
  nodes,
} from './useFlowCore'

interface DirectorWorkspaceApi {
  propagateDataFlow?: () => void
}

interface FlowDirector3DReturn {
  handleDirector3DRemoveUpstream: (sourceNodeId: string) => void
  handleDirector3DRequestPropagate: () => void
  handleDirector3DSnapshot: (url: string) => void
}

/**
 * 管理 3D 导演台与画布节点、连接线之间的交互。
 * @param workspaceRef 画布工作区公开方法引用。
 * @returns 删除上游、传播数据和创建截图节点的方法。
 */
export function useFlowDirector3D(
  workspaceRef: Ref<DirectorWorkspaceApi | null>,
): FlowDirector3DReturn {
  function handleDirector3DRemoveUpstream(sourceNodeId: string): void {
    const targetNodeId = director3DActiveNodeId.value
    if (!sourceNodeId || !targetNodeId) return
    edges.value = edges.value.filter((edge) => (
      edge.source !== sourceNodeId || edge.target !== targetNodeId
    ))
  }

  function handleDirector3DRequestPropagate(): void {
    workspaceRef.value?.propagateDataFlow?.()
  }

  function handleDirector3DSnapshot(url: string): void {
    const sourceNodeId = director3DActiveNodeId.value
    const sourceNode = sourceNodeId ? nodes.value.find((node) => node.id === sourceNodeId) : null
    const x = sourceNode ? sourceNode.position.x + (sourceNode.dimensions?.width || 320) + 50 : 100
    const y = sourceNode ? sourceNode.position.y : 100
    const nodeId = createFlowNodeId()
    nodes.value = [...nodes.value, {
      id: nodeId,
      type: 'file_input',
      position: { x, y },
      data: {
        url,
        preview: url,
        imageUrl: url,
        mediaType: 'image',
        label: '3D 导演台截图',
        nodeType: 'file_input',
        ports: {
          inputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'input', visible: true }],
          outputs: [{ id: 'image', label: 'Image', mediaType: 'image', direction: 'output', visible: true }],
        },
      },
      style: { width: '320px', height: '180px' },
    }]
    if (!sourceNodeId) return
    edges.value = [...edges.value, {
      id: createFlowEdgeId(),
      source: sourceNodeId,
      sourceHandle: 'text',
      target: nodeId,
      targetHandle: 'image',
      type: 'smoothstep',
    }]
  }

  return {
    handleDirector3DRemoveUpstream,
    handleDirector3DRequestPropagate,
    handleDirector3DSnapshot,
  }
}
