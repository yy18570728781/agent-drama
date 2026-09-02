import {
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  type Position,
} from '@vue-flow/core'

type FlowEdgePathOptions = Pick<
  EdgeProps,
  'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
>

function replaceRoundedSegmentsWithLines(path: string): string {
  return path.replace(/Q\s*[-0-9.]+,[-0-9.]+\s+([-0-9.]+,[-0-9.]+)/g, 'L $1')
}

function getDynamicCenterX(options: FlowEdgePathOptions): number | undefined {
  const dx = options.targetX - options.sourceX
  if (dx <= 40) return undefined
  const dy = options.targetY - options.sourceY
  const variance = (Math.abs(dy) * 0.3) % 20
  const shift = dy > 0 ? variance : -variance
  return options.sourceX + (dx / 2) + shift
}

function getSmoothStepFlowPath(options: FlowEdgePathOptions, borderRadius = 20): string {
  const [path] = getSmoothStepPath({
    ...options,
    borderRadius,
    centerX: getDynamicCenterX(options),
  })
  return path
}

function getStepFlowPath(options: FlowEdgePathOptions): string {
  const [path] = getSmoothStepPath({
    ...options,
    borderRadius: 0,
  })
  return path
}

function getStraightFlowPath(options: FlowEdgePathOptions): string {
  const [path] = getStraightPath(options)
  return path
}

function getManhattanFlowPath(options: FlowEdgePathOptions): string {
  return replaceRoundedSegmentsWithLines(getSmoothStepFlowPath(options))
}

function getMetroFlowPath(options: FlowEdgePathOptions): string {
  return getSmoothStepFlowPath(options, 28)
}

function getErFlowPath(options: FlowEdgePathOptions): [string, string] {
  const horizontal = Math.abs(options.targetX - options.sourceX)
  const vertical = Math.abs(options.targetY - options.sourceY)
  const offset = horizontal >= vertical ? { x: 0, y: 7 } : { x: 7, y: 0 }
  return [
    getManhattanFlowPath({
      ...options,
      sourceX: options.sourceX - offset.x,
      sourceY: options.sourceY - offset.y,
      targetX: options.targetX - offset.x,
      targetY: options.targetY - offset.y,
    }),
    getManhattanFlowPath({
      ...options,
      sourceX: options.sourceX + offset.x,
      sourceY: options.sourceY + offset.y,
      targetX: options.targetX + offset.x,
      targetY: options.targetY + offset.y,
    }),
  ]
}

export function getFlowEdgePath(style: string, options: FlowEdgePathOptions): string {
  if (style === 'default') {
    const [path] = getBezierPath(options)
    return path
  }
  if (style === 'simplebezier') {
    const [path] = getSimpleBezierPath(options)
    return path
  }
  if (style === 'smoothstep') return getSmoothStepFlowPath(options)
  if (style === 'step') return getStepFlowPath(options)
  if (style === 'straight') return getStraightFlowPath(options)
  if (style === 'manhattan') return getManhattanFlowPath(options)
  if (style === 'metro') return getMetroFlowPath(options)
  if (style === 'er') return getManhattanFlowPath(options)
  return getSmoothStepFlowPath(options)
}

export function getFlowErEdgePaths(options: FlowEdgePathOptions): [string, string] {
  return getErFlowPath(options)
}

export function getConnectionEdgePath(
  style: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
): string {
  return getFlowEdgePath(style, {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
}
