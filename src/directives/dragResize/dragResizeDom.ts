import type { DragResizeDirection } from './dragResize.types'

const HANDLE_THICKNESS = 3
const ACTIVE_COLOR = 'var(--accent, #22d3ee)'
const ELEMENT_STYLE_PROPERTIES = ['position', 'overflow', 'width', 'height'] as const
const PUT_STYLE_PROPERTIES = [
  'z-index',
  'opacity',
  'position',
  'top',
  'left',
  'cursor',
] as const

interface InlineStyleValue {
  priority: string
  value: string
}

export interface DragResizePutNodes {
  bottom: HTMLElement | null
  left: HTMLElement | null
  right: HTMLElement | null
  top: HTMLElement | null
}

export type DragResizeInlineStyleSnapshot = ReadonlyMap<string, InlineStyleValue>
export type DragResizePutStyleSnapshots = ReadonlyMap<HTMLElement, DragResizeInlineStyleSnapshot>

function applyStyles(element: HTMLElement, styles: Readonly<Record<string, string>>): void {
  Object.entries(styles).forEach(([property, value]: [string, string]): void => {
    element.style.setProperty(property, value)
  })
}

function getHandleDirectionStyles(
  direction: DragResizeDirection,
): Readonly<Record<string, string>> {
  if (direction === 'left') {
    return { left: '0', top: '0', width: '3px', height: '100%', cursor: 'col-resize' }
  }
  if (direction === 'right') {
    return { right: '0', top: '0', width: '3px', height: '100%', cursor: 'col-resize' }
  }
  if (direction === 'top') {
    return { top: '0', left: '0', width: '100%', height: '3px', cursor: 'row-resize' }
  }
  return { bottom: '0', left: '0', width: '100%', height: '3px', cursor: 'row-resize' }
}

/**
 * Finds optional collapse controls inside a directive host.
 *
 * @param element - Directive host element.
 * @returns One optional put element for each resize direction.
 */
export function findDragResizePutNodes(element: HTMLElement): DragResizePutNodes {
  return {
    left: element.querySelector<HTMLElement>('.left-put'),
    right: element.querySelector<HTMLElement>('.right-put'),
    top: element.querySelector<HTMLElement>('.top-put'),
    bottom: element.querySelector<HTMLElement>('.bottom-put'),
  }
}

/**
 * Captures selected inline styles, including their important priority.
 *
 * @param element - Element whose inline styles may be mutated.
 * @param properties - CSS property names to capture.
 * @returns A restorable snapshot of the requested properties.
 */
export function captureInlineStyles(
  element: HTMLElement,
  properties: readonly string[],
): DragResizeInlineStyleSnapshot {
  const snapshot = new Map<string, InlineStyleValue>()
  properties.forEach((property: string): void => {
    snapshot.set(property, {
      priority: element.style.getPropertyPriority(property),
      value: element.style.getPropertyValue(property),
    })
  })
  return snapshot
}

/**
 * Restores inline styles captured before directive setup.
 *
 * @param element - Element whose styles should be restored.
 * @param snapshot - Snapshot returned by `captureInlineStyles`.
 */
export function restoreInlineStyles(
  element: HTMLElement,
  snapshot: DragResizeInlineStyleSnapshot,
): void {
  snapshot.forEach(({ priority, value }: InlineStyleValue, property: string): void => {
    if (value) element.style.setProperty(property, value, priority)
    else element.style.removeProperty(property)
  })
}

/**
 * Keeps directive-owned handles anchored without changing positioned hosts.
 *
 * @param element - Directive host whose positioning context must be valid.
 */
export function ensureDragResizePosition(element: HTMLElement): void {
  const computedPosition = window.getComputedStyle(element).position
  if (!computedPosition || computedPosition === 'static') {
    element.style.position = 'relative'
  }
}

/**
 * Prepares the directive host and captures every inline style the runtime changes.
 *
 * @param element - Directive host element.
 * @param hideOverflow - Whether content should be clipped during resizing.
 * @returns Styles to restore when the directive is destroyed.
 */
export function prepareDragResizeElement(
  element: HTMLElement,
  hideOverflow: boolean,
): DragResizeInlineStyleSnapshot {
  const snapshot = captureInlineStyles(element, ELEMENT_STYLE_PROPERTIES)
  ensureDragResizePosition(element)
  if (hideOverflow) element.style.overflow = 'hidden'
  return snapshot
}

/**
 * Hides put controls initially while preserving their existing inline styles.
 *
 * @param nodes - Put controls found inside the directive host.
 * @returns Per-element snapshots for teardown.
 */
export function prepareDragResizePutNodes(
  nodes: DragResizePutNodes,
): DragResizePutStyleSnapshots {
  const snapshots = new Map<HTMLElement, DragResizeInlineStyleSnapshot>()
  Object.values(nodes).forEach((node: HTMLElement | null): void => {
    if (!node || snapshots.has(node)) return
    snapshots.set(node, captureInlineStyles(node, PUT_STYLE_PROPERTIES))
    setDragResizePutVisible(node, false)
  })
  return snapshots
}

/**
 * Restores all put controls changed during directive setup.
 *
 * @param snapshots - Snapshots returned by `prepareDragResizePutNodes`.
 */
export function restoreDragResizePutNodes(snapshots: DragResizePutStyleSnapshots): void {
  snapshots.forEach(
    (snapshot: DragResizeInlineStyleSnapshot, node: HTMLElement): void => {
      restoreInlineStyles(node, snapshot)
    },
  )
}

/**
 * Shows or visually removes a directional collapse control.
 *
 * @param node - Put control, if the host provides one.
 * @param visible - Whether the control should be available.
 */
export function setDragResizePutVisible(
  node: HTMLElement | null,
  visible: boolean,
): void {
  if (!node) return
  applyStyles(node, visible
    ? { 'z-index': '9', opacity: '1', position: 'relative', top: '0', left: '0', cursor: 'pointer' }
    : { 'z-index': '-10000', opacity: '0', position: 'absolute', top: '-10000px', left: '-10000px' })
}

/**
 * Creates an inline-styled resize handle for one direction.
 *
 * @param direction - Edge controlled by the handle.
 * @returns A detached handle ready for listener registration.
 */
export function createDragResizeHandle(direction: DragResizeDirection): HTMLDivElement {
  const handle = document.createElement('div')
  handle.classList.add('drag-resize-handle', `drag-resize-handle-${direction}`)
  handle.dataset.dragResizeDirection = direction
  applyStyles(handle, {
    position: 'absolute',
    background: 'transparent',
    'z-index': '9',
    'pointer-events': 'auto',
    'touch-action': 'none',
    'user-select': 'none',
  })
  applyStyles(handle, getHandleDirectionStyles(direction))
  return handle
}

/**
 * Applies hover or drag emphasis to a resize handle.
 *
 * @param handle - Handle created by `createDragResizeHandle`.
 * @param active - Whether emphasis should be visible.
 */
export function setDragResizeHandleActive(handle: HTMLElement, active: boolean): void {
  handle.style.backgroundColor = active ? ACTIVE_COLOR : 'transparent'
}

/**
 * Creates a detached preview line for deferred resizing.
 *
 * @param direction - Edge represented by the preview line.
 * @returns A detached ghost element.
 */
export function createDragResizeGhost(direction: DragResizeDirection): HTMLDivElement {
  const ghost = document.createElement('div')
  ghost.classList.add('drag-resize-ghost', `drag-resize-ghost-${direction}`)
  applyStyles(ghost, {
    position: 'fixed',
    background: ACTIVE_COLOR,
    'z-index': '10',
    'pointer-events': 'none',
  })
  return ghost
}

/**
 * Positions a preview line at the candidate edge of the resized host.
 *
 * @param ghost - Ghost created by `createDragResizeGhost`.
 * @param direction - Edge represented by the ghost.
 * @param rect - Current host viewport bounds.
 * @param size - Candidate width or height before clamping.
 */
export function positionDragResizeGhost(
  ghost: HTMLElement,
  direction: DragResizeDirection,
  rect: DOMRect,
  size: number,
): void {
  const vertical = direction === 'left' || direction === 'right'
  const offset = direction === 'left' || direction === 'top' ? 0 : HANDLE_THICKNESS
  const coordinate = direction === 'left'
    ? rect.right - size
    : direction === 'right'
      ? rect.left + size - offset
      : direction === 'top'
        ? rect.bottom - size
        : rect.top + size - offset
  applyStyles(ghost, vertical
    ? { top: `${rect.top}px`, left: `${coordinate}px`, width: `${HANDLE_THICKNESS}px`, height: `${rect.height}px` }
    : { top: `${coordinate}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${HANDLE_THICKNESS}px` })
}

/**
 * Removes an optional directive-owned node from the DOM.
 *
 * @param node - Handle or ghost to remove.
 */
export function removeDragResizeNode(node: HTMLElement | null): void {
  node?.remove()
}
