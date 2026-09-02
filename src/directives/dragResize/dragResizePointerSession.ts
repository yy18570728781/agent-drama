import {
  createDragResizeGhost,
  positionDragResizeGhost,
  removeDragResizeNode,
  setDragResizeHandleActive,
} from './dragResizeDom'
import type { DragResizeDirection } from './dragResize.types'

interface DragSession {
  captured: boolean
  direction: DragResizeDirection
  finalCandidate: number
  ghost: HTMLDivElement | null
  handle: HTMLDivElement
  pointerId: number
  startHeight: number
  startInlineSize: DragResizeInlineSizeSnapshot
  startWidth: number
  startX: number
  startY: number
}

interface DragResizeInlineSizeSnapshot {
  priority: string
  value: string
}

interface DragResizePointerSessionLateBindings {
  finish: (commit: boolean) => void
}

export interface DragResizePointerSessionDependencies {
  applyLiveSize: (direction: DragResizeDirection, candidate: number) => void
  commit: (direction: DragResizeDirection, finalCandidate: number) => void
  element: HTMLElement
  getGhostSize: (direction: DragResizeDirection, candidate: number) => number
  shouldUseGhost: () => boolean
}

export interface DragResizePointerSession {
  cancel: () => void
  cancelIfActive: (handle: HTMLDivElement, pointerId: number) => void
  isActiveHandle: (handle: HTMLDivElement) => boolean
  start: (
    direction: DragResizeDirection,
    handle: HTMLDivElement,
    event: PointerEvent,
  ) => void
}

function getCandidateSize(session: DragSession, event: PointerEvent): number {
  if (session.direction === 'left') return session.startWidth - (event.clientX - session.startX)
  if (session.direction === 'right') return session.startWidth + event.clientX - session.startX
  if (session.direction === 'top') return session.startHeight - (event.clientY - session.startY)
  return session.startHeight + event.clientY - session.startY
}

function captureInlineSize(
  element: HTMLElement,
  direction: DragResizeDirection,
): DragResizeInlineSizeSnapshot {
  const property = direction === 'left' || direction === 'right' ? 'width' : 'height'
  return {
    priority: element.style.getPropertyPriority(property),
    value: element.style.getPropertyValue(property),
  }
}

function restoreInlineSize(
  element: HTMLElement,
  direction: DragResizeDirection,
  snapshot: DragResizeInlineSizeSnapshot,
): void {
  const property = direction === 'left' || direction === 'right' ? 'width' : 'height'
  if (snapshot.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority)
    return
  }
  element.style.removeProperty(property)
}

function capturePointer(handle: HTMLDivElement, pointerId: number): boolean {
  try {
    handle.setPointerCapture(pointerId)
    return handle.hasPointerCapture(pointerId)
  } catch {
    return false
  }
}

function releasePointer(session: DragSession): void {
  if (!session.captured) return
  try {
    if (session.handle.hasPointerCapture(session.pointerId)) {
      session.handle.releasePointerCapture(session.pointerId)
    }
  } catch {
    // Pointer capture can already be released by the browser before cleanup runs.
  }
}

class DragResizePointerSessionController implements DragResizePointerSession {
  private readonly dependencies: DragResizePointerSessionDependencies
  private readonly late: DragResizePointerSessionLateBindings = {
    finish: (): never => {
      throw new Error('drag resize pointer session is not fully initialized')
    },
  }
  private activeSession: DragSession | null = null

  private readonly handleDocumentPointerMove = (event: PointerEvent): void => {
    const session = this.activeSession
    if (!session || event.pointerId !== session.pointerId) return
    event.preventDefault()
    session.finalCandidate = getCandidateSize(session, event)
    if (session.ghost) {
      positionDragResizeGhost(
        session.ghost,
        session.direction,
        this.dependencies.element.getBoundingClientRect(),
        this.dependencies.getGhostSize(session.direction, session.finalCandidate),
      )
      return
    }
    this.dependencies.applyLiveSize(session.direction, session.finalCandidate)
  }

  private readonly handleDocumentPointerEnd = (event: PointerEvent): void => {
    const session = this.activeSession
    if (!session || event.pointerId !== session.pointerId) return
    session.finalCandidate = getCandidateSize(session, event)
    if (!session.ghost) {
      this.dependencies.applyLiveSize(session.direction, session.finalCandidate)
    }
    this.late.finish(true)
  }

  private readonly handleDocumentPointerCancel = (event: PointerEvent): void => {
    if (!this.activeSession || event.pointerId !== this.activeSession.pointerId) return
    this.late.finish(false)
  }

  private readonly handleWindowBlur = (): void => {
    this.late.finish(false)
  }

  private removeDocumentListeners(): void {
    document.removeEventListener('pointermove', this.handleDocumentPointerMove, true)
    document.removeEventListener('pointerup', this.handleDocumentPointerEnd, true)
    document.removeEventListener('pointercancel', this.handleDocumentPointerCancel, true)
    window.removeEventListener('blur', this.handleWindowBlur)
  }

  private finishActiveSession(commit: boolean): void {
    const session = this.activeSession
    if (!session) return
    this.activeSession = null
    this.removeDocumentListeners()
    releasePointer(session)
    removeDragResizeNode(session.ghost)
    setDragResizeHandleActive(session.handle, false)
    if (commit) {
      this.dependencies.commit(session.direction, session.finalCandidate)
      return
    }
    if (!session.ghost) {
      restoreInlineSize(
        this.dependencies.element,
        session.direction,
        session.startInlineSize,
      )
    }
  }

  private createGhost(direction: DragResizeDirection, size: number): HTMLDivElement | null {
    if (!this.dependencies.shouldUseGhost()) return null
    const ghost = createDragResizeGhost(direction)
    document.body.appendChild(ghost)
    positionDragResizeGhost(
      ghost,
      direction,
      this.dependencies.element.getBoundingClientRect(),
      this.dependencies.getGhostSize(direction, size),
    )
    return ghost
  }

  public cancel(): void {
    this.finishActiveSession(false)
  }

  public cancelIfActive(handle: HTMLDivElement, pointerId: number): void {
    const session = this.activeSession
    if (session?.handle === handle && session.pointerId === pointerId) this.cancel()
  }

  public isActiveHandle(handle: HTMLDivElement): boolean {
    return this.activeSession?.handle === handle
  }

  public start(
    direction: DragResizeDirection,
    handle: HTMLDivElement,
    event: PointerEvent,
  ): void {
    if (event.button !== 0 || this.activeSession) return
    event.preventDefault()
    event.stopPropagation()
    const startWidth = this.dependencies.element.offsetWidth
    const startHeight = this.dependencies.element.offsetHeight
    const initialSize = direction === 'left' || direction === 'right' ? startWidth : startHeight
    this.activeSession = {
      captured: false,
      direction,
      finalCandidate: initialSize,
      ghost: this.createGhost(direction, initialSize),
      handle,
      pointerId: event.pointerId,
      startHeight,
      startInlineSize: captureInlineSize(this.dependencies.element, direction),
      startWidth,
      startX: event.clientX,
      startY: event.clientY,
    }
    this.activeSession.captured = capturePointer(handle, event.pointerId)
    setDragResizeHandleActive(handle, true)
    document.addEventListener('pointermove', this.handleDocumentPointerMove, true)
    document.addEventListener('pointerup', this.handleDocumentPointerEnd, true)
    document.addEventListener('pointercancel', this.handleDocumentPointerCancel, true)
    window.addEventListener('blur', this.handleWindowBlur)
  }

  public constructor(dependencies: DragResizePointerSessionDependencies) {
    this.dependencies = dependencies
    this.late.finish = (commit: boolean): void => this.finishActiveSession(commit)
  }
}

/**
 * Creates the pointer-session owner for one drag-resize host.
 *
 * @param dependencies - Host operations invoked while a pointer session is active.
 * @returns Pointer lifecycle methods used by the drag-resize runtime.
 */
export function createDragResizePointerSession(
  dependencies: DragResizePointerSessionDependencies,
): DragResizePointerSession {
  return new DragResizePointerSessionController(dependencies)
}
