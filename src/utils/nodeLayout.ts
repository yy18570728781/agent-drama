import dagre from 'dagre'

// ==================== Types ====================

export type AlignDirection = 'alignLeft' | 'alignHCenter' | 'alignRight' | 'alignTop' | 'alignVCenter' | 'alignBottom'
export type DistributeDirection = 'horizontal' | 'vertical'

interface LayoutNode {
  id: string
  position: { x: number; y: number }
  computedPosition?: { x: number; y: number }
  dimensions?: { width: number; height: number }
}

interface LayoutEdge {
  source: string
  target: string
}

// ==================== Helpers ====================

function getNodeRect(node: LayoutNode) {
  const x = node.computedPosition?.x ?? node.position.x
  const y = node.computedPosition?.y ?? node.position.y
  const width = node.dimensions?.width || 320
  const height = node.dimensions?.height || 100
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 }
}

// ==================== Alignment ====================

/**
 * Align selected nodes in the specified direction.
 * Supports: alignLeft, alignHCenter, alignRight, alignTop, alignVCenter, alignBottom
 */
export function alignNodes(nodes: LayoutNode[], direction: AlignDirection): void {
  if (nodes.length < 2) return

  const rects = nodes.map(n => ({ node: n, ...getNodeRect(n) }))

  let targetValue: number
  switch (direction) {
    case 'alignLeft':
      targetValue = Math.min(...rects.map(r => r.x))
      break
    case 'alignRight':
      targetValue = Math.max(...rects.map(r => r.x + r.width))
      break
    case 'alignHCenter':
      targetValue = rects.reduce((s, r) => s + r.cx, 0) / rects.length
      break
    case 'alignTop':
      targetValue = Math.min(...rects.map(r => r.y))
      break
    case 'alignBottom':
      targetValue = Math.max(...rects.map(r => r.y + r.height))
      break
    case 'alignVCenter':
      targetValue = rects.reduce((s, r) => s + r.cy, 0) / rects.length
      break
  }

  const isVertical = direction === 'alignTop' || direction === 'alignVCenter' || direction === 'alignBottom'

  rects.forEach(({ node, x, y, width, height }) => {
    if (isVertical) {
      let offset: number
      switch (direction) {
        case 'alignTop': offset = targetValue - y; break
        case 'alignBottom': offset = targetValue - (y + height); break
        case 'alignVCenter': offset = targetValue - (y + height / 2); break
        default: offset = 0
      }
      node.position.y = node.position.y + offset
    } else {
      let offset: number
      switch (direction) {
        case 'alignLeft': offset = targetValue - x; break
        case 'alignRight': offset = targetValue - (x + width); break
        case 'alignHCenter': offset = targetValue - (x + width / 2); break
        default: offset = 0
      }
      node.position.x = node.position.x + offset
    }
  })
}

// ==================== Distribution ====================

/**
 * Distribute selected nodes with equal spacing horizontally or vertically.
 * Preserves the order based on current position.
 */
export function distributeNodes(nodes: LayoutNode[], direction: DistributeDirection): void {
  if (nodes.length < 3) return

  const rects = nodes.map(n => ({ node: n, ...getNodeRect(n) }))

  if (direction === 'horizontal') {
    const sorted = [...rects].sort((a, b) => a.x - b.x)
    const totalSpan = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x
    const totalNodeWidth = sorted.reduce((s, r) => s + r.width, 0)
    const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1)

    let currentX = sorted[0].x
    sorted.forEach(({ node, width }) => {
      node.position.x = node.position.x + (currentX - (node.computedPosition?.x ?? node.position.x))
      currentX += width + gap
    })
  } else {
    const sorted = [...rects].sort((a, b) => a.y - b.y)
    const totalSpan = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y
    const totalNodeHeight = sorted.reduce((s, r) => s + r.height, 0)
    const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1)

    let currentY = sorted[0].y
    sorted.forEach(({ node, height }) => {
      node.position.y = node.position.y + (currentY - (node.computedPosition?.y ?? node.position.y))
      currentY += height + gap
    })
  }
}

// ==================== Dagre Auto Layout ====================

export interface AutoLayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL'
  nodesep?: number
  ranksep?: number
}

/**
 * Auto-layout nodes using dagre (topological, respects edge connections).
 */
export function autoLayoutNodes(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: AutoLayoutOptions = {}
): void {
  if (nodes.length < 2) return

  const { rankdir = 'LR', nodesep = 80, ranksep = 120 } = options

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir, nodesep, ranksep, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  const nodeIds = new Set(nodes.map(n => n.id))

  // Add nodes
  nodes.forEach(node => {
    const rect = getNodeRect(node)
    g.setNode(node.id, { width: rect.width, height: rect.height })
  })

  // Add edges (only those connecting selected nodes)
  edges.forEach(edge => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(g)

  // Write back positions
  g.nodes().forEach(id => {
    const dagreNode = g.node(id)
    const node = nodes.find(n => n.id === id)
    if (!node || !dagreNode) return

    const rect = getNodeRect(node)
    // dagre returns center position, we need top-left
    node.position.x = Math.round((dagreNode.x - rect.width / 2) / 10) * 10
    node.position.y = Math.round((dagreNode.y - rect.height / 2) / 10) * 10
  })
}

// ==================== Grid Tidy ====================

/**
 * Tidy nodes into a grid based on their current positions (does NOT consider edge connections).
 */
export function tidyNodes(nodes: LayoutNode[]): void {
  if (nodes.length < 2) return

  const snapshot = nodes.map((node) => {
    const rect = getNodeRect(node)
    return {
      node,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    }
  })

  // 1. Group into rows
  const sortedByY = [...snapshot].sort((a, b) => a.y - b.y)

  const rows: typeof snapshot[] = []
  let currentRow = [sortedByY[0]]

  for (let i = 1; i < sortedByY.length; i++) {
    const node = sortedByY[i]
    const prevNode = currentRow[currentRow.length - 1]
    const nodeY = node.y
    const prevY = prevNode.y

    if (Math.abs(nodeY - prevY) < 200) {
      currentRow.push(node)
    } else {
      rows.push(currentRow)
      currentRow = [node]
    }
  }
  rows.push(currentRow)

  // Assign rowId and apply Y coordinates
  const nodeRowMap = new Map<string, number>()
  const rowGap = 50
  let nextRowY = Math.round((rows[0].reduce((sum, item) => sum + item.y, 0) / rows[0].length) / 10) * 10
  rows.forEach((row, rowIndex) => {
    const rowHeight = Math.max(...row.map(item => item.height))
    row.forEach(item => {
      nodeRowMap.set(item.node.id, rowIndex)
      item.node.position.y = nextRowY
    })
    nextRowY += rowHeight + rowGap
  })

  // 2. Group into columns
  const sortedByX = [...snapshot].sort((a, b) => a.x - b.x)

  const columns: { items: typeof snapshot; avgX: number }[] = []

  sortedByX.forEach(item => {
    const nodeX = item.x
    const rowId = nodeRowMap.get(item.node.id)!

    let foundCol: typeof columns[0] | null = null
    for (const col of columns) {
      const hasSameRow = col.items.some(entry => nodeRowMap.get(entry.node.id) === rowId)
      if (!hasSameRow && Math.abs(col.avgX - nodeX) < 250) {
        foundCol = col
        break
      }
    }

    if (foundCol) {
      foundCol.items.push(item)
      foundCol.avgX = foundCol.items.reduce((sum, entry) => sum + entry.x, 0) / foundCol.items.length
    } else {
      columns.push({ items: [item], avgX: nodeX })
    }
  })

  columns.sort((a, b) => a.avgX - b.avgX)

  // 3. Apply X coordinates with spacing
  const minGap = 50
  for (let i = 0; i < columns.length; i++) {
    if (i > 0) {
      const prevCol = columns[i - 1]
      let prevMaxRight = -Infinity
      prevCol.items.forEach(item => {
        const right = prevCol.avgX + item.width
        if (right > prevMaxRight) prevMaxRight = right
      })
      if (columns[i].avgX < prevMaxRight + minGap) {
        columns[i].avgX = prevMaxRight + minGap
      }
    }
    columns[i].items.forEach(item => {
      item.node.position.x = Math.round(columns[i].avgX / 10) * 10
    })
  }
}
