import type { FlowNode, WorkflowDefinition } from './flowCore.types'

function createPerformanceNode(index: number): FlowNode {
  return {
    id: `perf-node-${index}`,
    type: 'file_input',
    position: {
      x: (index % 60) * 420,
      y: Math.floor(index / 60) * 260,
    },
    data: {
      label: `性能节点 ${index}`,
      mediaType: 'image',
    },
    style: {
      width: '320px',
      height: '180px',
    },
  }
}

/**
 * 创建仅开发环境使用的大画布压力场景。
 * @param nodeCount 需要生成的节点数量。
 * @returns 可直接交给正常画布加载器的工作流定义。
 */
export function createFlowPerformanceFixture(nodeCount: number): WorkflowDefinition {
  const safeCount = Math.max(1, Math.min(10000, Math.floor(nodeCount)))
  return {
    nodes: Array.from({ length: safeCount }, (_, index) => createPerformanceNode(index)),
    edges: Array.from({ length: Math.max(0, safeCount - 1) }, (_, index) => ({
      id: `perf-edge-${index}`,
      source: `perf-node-${index}`,
      target: `perf-node-${index + 1}`,
    })),
    viewport: { x: 40, y: 40, zoom: 0.3 },
    subgraphs: {},
  }
}
