import type { ExpandInsets, ExpandRatioOption } from './imageExpand.types'

export const DEFAULT_EXPAND_INSETS: ExpandInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
}

export const IMAGE_EXPAND_RATIOS: ExpandRatioOption[] = [
  { label: '自由', w: 0, h: 0 },
  { label: '1:1', w: 1, h: 1 },
  { label: '3:2', w: 3, h: 2 },
  { label: '2:3', w: 2, h: 3 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:4', w: 3, h: 4 },
  { label: '5:4', w: 5, h: 4 },
  { label: '4:5', w: 4, h: 5 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '21:9', w: 21, h: 9 },
  { label: '9:21', w: 9, h: 21 },
]
