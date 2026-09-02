import type { Directive } from 'vue'

export type DragResizeDirection = 'left' | 'right' | 'top' | 'bottom'

export type DragResizeSizeConfig = Readonly<Partial<Record<DragResizeDirection, number>>>

export type DragResizeSizeLimit = number | DragResizeSizeConfig

export type DragResizeSizeMap = Readonly<Record<DragResizeDirection, number>>

export type DragResizeCollapsedState = Record<DragResizeDirection, boolean>

export type DragResizeCollapsedSnapshot = Readonly<DragResizeCollapsedState>

export type DragResizeCollapsedChangeHandler = (
  collapsed: DragResizeCollapsedSnapshot,
) => void

export interface DragResizeEndPayload {
  readonly collapsed: DragResizeCollapsedSnapshot
  readonly direction: DragResizeDirection
  readonly height: number
  readonly size: number
  readonly width: number
}

export type DragResizeEndHandler = (payload: DragResizeEndPayload) => void

export type DragResizeValueOptions = DragResizeSizeConfig & Readonly<{
  max?: DragResizeSizeLimit
  min?: DragResizeSizeLimit
  onCollapsedChange?: DragResizeCollapsedChangeHandler
  onDragEnd?: DragResizeEndHandler
}>

export type DragResizeValue = false | number | DragResizeValueOptions | undefined

export type DragResizeModifier = DragResizeDirection | 'defer'

export type DragResizeModifiers = Readonly<Partial<Record<DragResizeModifier, boolean>>>

export interface DragResizeBindingSnapshot {
  argument?: 'put'
  modifiers: DragResizeModifiers
  value: DragResizeValue
}

export interface DragResizeRuntime {
  destroy: () => void
  getCollapsedState: () => DragResizeCollapsedState
  update: (binding: DragResizeBindingSnapshot) => void
}

export interface DragResizeElementApi {
  readonly __dragCollapsed__: DragResizeCollapsedSnapshot
  getCollapsedState: () => DragResizeCollapsedSnapshot
}

declare global {
  interface HTMLElement {
    readonly __dragCollapsed__?: DragResizeCollapsedSnapshot
    getCollapsedState?: () => DragResizeCollapsedSnapshot
  }
}

declare module 'vue' {
  interface GlobalDirectives {
    vDragResize: Directive<
      HTMLElement,
      DragResizeValue,
      DragResizeModifier,
      'put'
    >
  }
}
