export type ExpandSide = 'top' | 'right' | 'bottom' | 'left'

export type ExpandHandle =
  | ExpandSide
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface ExpandInsets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ExpandRatioOption {
  label: string
  w: number
  h: number
}

export interface ExpandPreviewInfo {
  width: number
  height: number
  originX: number
  originY: number
  sourceWidth: number
  sourceHeight: number
  hasPending: boolean
}
