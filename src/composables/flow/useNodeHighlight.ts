import type { Ref } from 'vue'

export const HIGHLIGHT_COLORS = [
  '#ec4899',
  '#6366f1',
  '#10b981',
  '#f59e0b',
]

export const HIGHLIGHT_STYLE_VAR = '--node-highlight-color'

export interface UseNodeHighlightDeps {
  nodes: Ref<any[]>
  saveHistory: () => void
  findNode?: (id: string) => any
}

/**
 * 色号直接挂在 node.style['--node-highlight-color']：
 * - style 由 serializeNodes/loadDefinition 原样保留，天然持久化
 * - 视觉效果由 CSS 选择器 [style*='--node-highlight-color'] 驱动，无需维护 class
 */
export function useNodeHighlight(deps: UseNodeHighlightDeps) {
  function findNodeById(id: string): any {
    if (typeof deps.findNode === 'function') return deps.findNode(id)
    return deps.nodes.value.find((n: any) => n?.id === id)
  }

  function applyHighlight(nodeIds: string[], colorIndex: number) {
    const idx = Math.max(0, Math.min(HIGHLIGHT_COLORS.length - 1, colorIndex))
    const color = HIGHLIGHT_COLORS[idx]
    for (const id of nodeIds) {
      const node = findNodeById(id)
      if (!node) continue
      const styleObj: Record<string, any> = { ...(node.style || {}) }
      styleObj[HIGHLIGHT_STYLE_VAR] = color
      node.style = styleObj
    }
    deps.saveHistory()
  }

  function clearHighlight(nodeIds: string[]) {
    let changed = false
    for (const id of nodeIds) {
      const node = findNodeById(id)
      if (!node?.style) continue
      if (!Object.prototype.hasOwnProperty.call(node.style, HIGHLIGHT_STYLE_VAR)) continue
      const styleObj: Record<string, any> = { ...node.style }
      delete styleObj[HIGHLIGHT_STYLE_VAR]
      node.style = styleObj
      changed = true
    }
    if (changed) deps.saveHistory()
  }

  function clearAllHighlight() {
    let changed = false
    for (const node of deps.nodes.value) {
      if (!node?.style || !Object.prototype.hasOwnProperty.call(node.style, HIGHLIGHT_STYLE_VAR)) continue
      const styleObj: Record<string, any> = { ...node.style }
      delete styleObj[HIGHLIGHT_STYLE_VAR]
      node.style = styleObj
      changed = true
    }
    if (changed) deps.saveHistory()
  }

  function getNodeHighlightColor(nodeId: string): number | null {
    const node = findNodeById(nodeId)
    const color = node?.style?.[HIGHLIGHT_STYLE_VAR]
    if (typeof color !== 'string' || !color) return null
    const idx = HIGHLIGHT_COLORS.indexOf(color)
    return idx >= 0 ? idx : null
  }

  return {
    HIGHLIGHT_COLORS,
    applyHighlight,
    clearHighlight,
    clearAllHighlight,
    getNodeHighlightColor,
  }
}
