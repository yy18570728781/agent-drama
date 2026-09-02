import {
  captureInlineStyles,
  createDragResizeHandle,
  ensureDragResizePosition,
  findDragResizePutNodes,
  prepareDragResizeElement,
  prepareDragResizePutNodes,
  removeDragResizeNode,
  restoreDragResizePutNodes,
  restoreInlineStyles,
  setDragResizeHandleActive,
  setDragResizePutVisible,
  type DragResizeInlineStyleSnapshot,
  type DragResizePutNodes,
  type DragResizePutStyleSnapshots,
} from './dragResizeDom'
import {
  resolveDragResizeOptions,
  type ResolvedDragResizeOptions,
} from './dragResizeOptions'
import {
  createDragResizePointerSession,
  type DragResizePointerSession,
} from './dragResizePointerSession'
import type {
  DragResizeBindingSnapshot,
  DragResizeCollapsedState,
  DragResizeDirection,
  DragResizeRuntime,
} from './dragResize.types'

const DIRECTIONS: readonly DragResizeDirection[] = ['left', 'right', 'top', 'bottom']

interface DragResizeHandleListeners {
  activate: () => void
  deactivate: () => void
  lostCapture: (event: PointerEvent) => void
  start: (event: PointerEvent) => void
}

function createCollapsedState(): DragResizeCollapsedState {
  return { left: false, right: false, top: false, bottom: false }
}

function createEmptyPutNodes(): DragResizePutNodes {
  return { left: null, right: null, top: null, bottom: null }
}

function isHorizontal(direction: DragResizeDirection): boolean {
  return direction === 'left' || direction === 'right'
}

function clampSize(
  size: number,
  direction: DragResizeDirection,
  options: ResolvedDragResizeOptions,
): number {
  return Math.max(options.min[direction], Math.min(size, options.max[direction]))
}

function shouldHideOverflow(options: ResolvedDragResizeOptions): boolean {
  return !options.isPut || options.isDefer
}

function collapsedStatesMatch(
  first: DragResizeCollapsedState,
  second: DragResizeCollapsedState,
): boolean {
  return DIRECTIONS.every(
    (direction: DragResizeDirection): boolean => first[direction] === second[direction],
  )
}

function sizeMapsMatch(
  first: Readonly<Record<DragResizeDirection, number>>,
  second: Readonly<Record<DragResizeDirection, number>>,
): boolean {
  return DIRECTIONS.every(
    (direction: DragResizeDirection): boolean => first[direction] === second[direction],
  )
}

function optionsSemanticallyMatch(
  first: ResolvedDragResizeOptions,
  second: ResolvedDragResizeOptions,
): boolean {
  return first.isDefer === second.isDefer
    && first.isPut === second.isPut
    && first.directions.length === second.directions.length
    && first.directions.every((direction: DragResizeDirection, index: number): boolean => (
      direction === second.directions[index]
    ))
    && sizeMapsMatch(first.min, second.min)
    && sizeMapsMatch(first.max, second.max)
}

function putNodesMatch(first: DragResizePutNodes, second: DragResizePutNodes): boolean {
  return DIRECTIONS.every(
    (direction: DragResizeDirection): boolean => first[direction] === second[direction],
  )
}

function getSameAxisDirections(
  direction: DragResizeDirection,
): readonly DragResizeDirection[] {
  return isHorizontal(direction) ? ['left', 'right'] : ['top', 'bottom']
}

class DragResizeRuntimeController implements DragResizeRuntime {
  private readonly collapsed = createCollapsedState()
  private readonly element: HTMLElement
  private readonly elementStyles: DragResizeInlineStyleSnapshot
  private readonly handleCleanups: Array<() => void> = []
  private readonly handles = new Map<DragResizeDirection, HTMLDivElement>()
  private readonly overflowStyles: DragResizeInlineStyleSnapshot
  private readonly pointerSession: DragResizePointerSession
  private readonly putCleanups: Array<() => void> = []
  private destroyed = false
  private managesOverflow: boolean
  private options: ResolvedDragResizeOptions
  private putNodes = createEmptyPutNodes()
  private putStyles: DragResizePutStyleSnapshots = new Map()

  private applyElementMode(): void {
    ensureDragResizePosition(this.element)
    if (shouldHideOverflow(this.options)) {
      this.element.style.overflow = 'hidden'
      this.managesOverflow = true
    } else if (this.managesOverflow) {
      restoreInlineStyles(this.element, this.overflowStyles)
      this.managesOverflow = false
    }
  }

  private getRestorableElementStyles(): DragResizeInlineStyleSnapshot {
    const currentPosition = this.element.style.getPropertyValue('position')
    return new Map([...this.elementStyles].filter(([property]: [string, unknown]): boolean => {
      if (property === 'overflow') return this.managesOverflow
      if (property === 'position') return currentPosition === 'relative'
      return true
    }))
  }

  private setElementSize(direction: DragResizeDirection, size: number): void {
    const property = isHorizontal(direction) ? 'width' : 'height'
    this.element.style.setProperty(property, `${size}px`)
  }

  private applyElementSize(direction: DragResizeDirection, size: number): void {
    this.setElementSize(direction, clampSize(size, direction, this.options))
  }

  private emitCollapsedChange(): void {
    this.options.onCollapsedChange?.({ ...this.collapsed })
  }

  private emitDragEnd(direction: DragResizeDirection): void {
    const width = this.element.offsetWidth
    const height = this.element.offsetHeight
    this.options.onDragEnd?.({
      collapsed: { ...this.collapsed },
      direction,
      height,
      size: isHorizontal(direction) ? width : height,
      width,
    })
  }

  private setAxisCollapsed(direction: DragResizeDirection, value: boolean): void {
    const previous = { ...this.collapsed }
    getSameAxisDirections(direction).forEach((axisDirection: DragResizeDirection): void => {
      this.collapsed[axisDirection] = value && axisDirection === direction
    })
    this.syncDirections()
    if (!collapsedStatesMatch(previous, this.collapsed)) this.emitCollapsedChange()
  }

  private syncDirection(direction: DragResizeDirection): void {
    const putNode = this.putNodes[direction]
    const collapsed = this.options.isPut && this.collapsed[direction] && Boolean(putNode)
    if (this.collapsed[direction] && !collapsed) {
      this.applyElementSize(direction, this.options.min[direction])
      this.collapsed[direction] = false
    }
    if (collapsed && putNode) {
      this.setElementSize(direction, this.getPutSize(direction, putNode))
    }
    setDragResizePutVisible(putNode, collapsed)
    const handle = this.handles.get(direction)
    if (handle) handle.style.display = collapsed ? 'none' : ''
  }

  private syncDirections(): void {
    DIRECTIONS.forEach((direction: DragResizeDirection): void => this.syncDirection(direction))
  }

  private restoreCollapsedDirection(direction: DragResizeDirection): void {
    this.applyElementSize(direction, this.options.min[direction])
    this.setAxisCollapsed(direction, false)
  }

  private getPutSize(direction: DragResizeDirection, node: HTMLElement): number {
    return isHorizontal(direction) ? node.offsetWidth : node.offsetHeight
  }

  private collapseDirection(direction: DragResizeDirection, node: HTMLElement): void {
    setDragResizePutVisible(node, true)
    this.setAxisCollapsed(direction, true)
  }

  private finishPutResize(direction: DragResizeDirection, finalCandidate: number): void {
    const putNode = this.putNodes[direction]
    if (finalCandidate < this.options.min[direction] && putNode) {
      this.collapseDirection(direction, putNode)
      return
    }
    this.applyElementSize(direction, finalCandidate)
    this.setAxisCollapsed(direction, false)
  }

  private getGhostSize(direction: DragResizeDirection, candidate: number): number {
    const collapseCandidate = this.options.isPut && candidate < this.options.min[direction]
    return collapseCandidate ? candidate : clampSize(candidate, direction, this.options)
  }

  private commitResize(direction: DragResizeDirection, finalCandidate: number): void {
    if (this.options.isPut) this.finishPutResize(direction, finalCandidate)
    else if (this.options.isDefer) this.applyElementSize(direction, finalCandidate)
    this.emitDragEnd(direction)
  }

  private createHandleListeners(
    direction: DragResizeDirection,
    handle: HTMLDivElement,
  ): DragResizeHandleListeners {
    return {
      activate: (): void => setDragResizeHandleActive(handle, true),
      deactivate: (): void => {
        if (!this.pointerSession.isActiveHandle(handle)) setDragResizeHandleActive(handle, false)
      },
      lostCapture: (event: PointerEvent): void => {
        this.pointerSession.cancelIfActive(handle, event.pointerId)
      },
      start: (event: PointerEvent): void => this.pointerSession.start(direction, handle, event),
    }
  }

  private removeHandleListeners(
    handle: HTMLDivElement,
    listeners: DragResizeHandleListeners,
  ): void {
    handle.removeEventListener('pointerenter', listeners.activate)
    handle.removeEventListener('pointerleave', listeners.deactivate)
    handle.removeEventListener('lostpointercapture', listeners.lostCapture)
    handle.removeEventListener('pointerdown', listeners.start)
    removeDragResizeNode(handle)
  }

  private addHandle(direction: DragResizeDirection): void {
    const handle = createDragResizeHandle(direction)
    const listeners = this.createHandleListeners(direction, handle)
    handle.addEventListener('pointerenter', listeners.activate)
    handle.addEventListener('pointerleave', listeners.deactivate)
    handle.addEventListener('lostpointercapture', listeners.lostCapture)
    handle.addEventListener('pointerdown', listeners.start)
    this.handleCleanups.push(
      (): void => this.removeHandleListeners(handle, listeners),
    )
    this.handles.set(direction, handle)
    this.element.appendChild(handle)
  }

  private clearHandles(): void {
    this.handleCleanups.splice(0).forEach((cleanup: () => void): void => cleanup())
    this.handles.clear()
  }

  private addPutListener(direction: DragResizeDirection, node: HTMLElement): void {
    const restore = (): void => {
      if (this.collapsed[direction]) this.restoreCollapsedDirection(direction)
    }
    node.addEventListener('click', restore)
    this.putCleanups.push((): void => node.removeEventListener('click', restore))
  }

  private clearPutNodes(): void {
    this.putCleanups.splice(0).forEach((cleanup: () => void): void => cleanup())
    restoreDragResizePutNodes(this.putStyles)
    this.putStyles = new Map()
    this.putNodes = createEmptyPutNodes()
  }

  private setupPutNodes(): void {
    if (!this.options.isPut) return
    this.putNodes = findDragResizePutNodes(this.element)
    this.putStyles = prepareDragResizePutNodes(this.putNodes)
    this.options.directions.forEach((direction: DragResizeDirection): void => {
      const node = this.putNodes[direction]
      if (node) this.addPutListener(direction, node)
    })
  }

  private reconcileCollapsed(nextOptions: ResolvedDragResizeOptions): void {
    DIRECTIONS.forEach((direction: DragResizeDirection): void => {
      const remainsEnabled = nextOptions.isPut && nextOptions.directions.includes(direction)
      if (!remainsEnabled && this.collapsed[direction]) {
        this.applyElementSize(direction, nextOptions.min[direction])
        this.collapsed[direction] = false
      }
    })
  }

  private rebuild(nextOptions: ResolvedDragResizeOptions): void {
    const previousCollapsed = { ...this.collapsed }
    this.pointerSession.cancel()
    this.clearHandles()
    this.clearPutNodes()
    this.options = nextOptions
    this.reconcileCollapsed(nextOptions)
    this.applyElementMode()
    this.setupPutNodes()
    this.options.directions.forEach(
      (direction: DragResizeDirection): void => this.addHandle(direction),
    )
    this.syncDirections()
    if (!collapsedStatesMatch(previousCollapsed, this.collapsed)) this.emitCollapsedChange()
  }

  public update(binding: DragResizeBindingSnapshot): void {
    if (this.destroyed) return
    const nextOptions = resolveDragResizeOptions(binding)
    const nextPutNodes = nextOptions.isPut ? findDragResizePutNodes(this.element) : createEmptyPutNodes()
    if (optionsSemanticallyMatch(this.options, nextOptions) && putNodesMatch(this.putNodes, nextPutNodes)) {
      this.options = nextOptions
      this.applyElementMode()
      return
    }
    this.rebuild(nextOptions)
  }

  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.pointerSession.cancel()
    this.clearHandles()
    this.clearPutNodes()
    restoreInlineStyles(this.element, this.getRestorableElementStyles())
  }

  public getCollapsedState(): DragResizeCollapsedState {
    return { ...this.collapsed }
  }

  private initialize(): void {
    this.setupPutNodes()
    this.options.directions.forEach(
      (direction: DragResizeDirection): void => this.addHandle(direction),
    )
    this.syncDirections()
  }

  public constructor(element: HTMLElement, binding: DragResizeBindingSnapshot) {
    this.element = element
    this.options = resolveDragResizeOptions(binding)
    this.overflowStyles = captureInlineStyles(element, ['overflow'])
    this.managesOverflow = shouldHideOverflow(this.options)
    this.elementStyles = prepareDragResizeElement(element, this.managesOverflow)
    this.pointerSession = createDragResizePointerSession({
      applyLiveSize: (direction: DragResizeDirection, candidate: number): void => {
        this.applyElementSize(direction, candidate)
      },
      commit: (direction: DragResizeDirection, finalCandidate: number): void => {
        this.commitResize(direction, finalCandidate)
      },
      element,
      getGhostSize: (direction: DragResizeDirection, candidate: number): number => (
        this.getGhostSize(direction, candidate)
      ),
      shouldUseGhost: (): boolean => this.options.isPut || this.options.isDefer,
    })
    this.initialize()
  }
}

/**
 * Creates the stateful DOM runtime behind one `v-drag-resize` directive host.
 *
 * @param element - Directive host whose width or height may be changed.
 * @param binding - Initial normalized Vue binding snapshot.
 * @returns Runtime methods used by the directive lifecycle adapter.
 */
export function createDragResizeRuntime(
  element: HTMLElement,
  binding: DragResizeBindingSnapshot,
): DragResizeRuntime {
  return new DragResizeRuntimeController(element, binding)
}
