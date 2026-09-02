import type {
  DragResizeBindingSnapshot,
  DragResizeCollapsedChangeHandler,
  DragResizeCollapsedState,
  DragResizeDirection,
  DragResizeEndHandler,
  DragResizeModifiers,
  DragResizeSizeMap,
} from './dragResize.types'

const DIRECTIONS: readonly DragResizeDirection[] = ['left', 'right', 'top', 'bottom']
const DEFAULT_MIN_SIZE = 100
const DEFAULT_MAX_SIZE = Number.POSITIVE_INFINITY

type MutableSizeMap = Record<DragResizeDirection, number>
type UnknownRecord = Readonly<Record<string, unknown>>
type SizeValidator = (value: unknown) => value is number

export interface ResolvedDragResizeOptions {
  directions: readonly DragResizeDirection[]
  isDefer: boolean
  isPut: boolean
  max: DragResizeSizeMap
  min: DragResizeSizeMap
  onCollapsedChange?: DragResizeCollapsedChangeHandler
  onDragEnd?: DragResizeEndHandler
}

function createSizeMap(size: number): MutableSizeMap {
  return { left: size, right: size, top: size, bottom: size }
}

function isOptionRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidMaximum(value: unknown): value is number {
  return isValidSize(value) || value === Number.POSITIVE_INFINITY
}

function applyDirectionSizes(
  target: MutableSizeMap,
  source: UnknownRecord,
  validator: SizeValidator,
): void {
  DIRECTIONS.forEach((direction: DragResizeDirection): void => {
    const size = source[direction]
    if (validator(size)) target[direction] = size
  })
}

function applySizeLimit(
  target: MutableSizeMap,
  limit: unknown,
  validator: SizeValidator,
): void {
  if (validator(limit)) {
    DIRECTIONS.forEach((direction: DragResizeDirection): void => {
      target[direction] = limit
    })
    return
  }
  if (isOptionRecord(limit)) applyDirectionSizes(target, limit, validator)
}

function normalizeMaximums(min: DragResizeSizeMap, max: MutableSizeMap): void {
  DIRECTIONS.forEach((direction: DragResizeDirection): void => {
    max[direction] = Math.max(min[direction], max[direction])
  })
}

function getConfiguredDirections(value: unknown): DragResizeDirection[] {
  if (!isOptionRecord(value)) return []
  const min = isOptionRecord(value.min) ? value.min : {}
  const max = isOptionRecord(value.max) ? value.max : {}
  return DIRECTIONS.filter((direction: DragResizeDirection): boolean => (
    isValidSize(value[direction])
    || isValidSize(min[direction])
    || isValidMaximum(max[direction])
  ))
}

function resolveDirections(binding: DragResizeBindingSnapshot): DragResizeDirection[] {
  const modifierDirections = getDragResizeDirections(binding.modifiers)
  if (modifierDirections.length > 0) return modifierDirections
  const configuredDirections = getConfiguredDirections(binding.value)
  return configuredDirections.length > 0 ? configuredDirections : [...DIRECTIONS]
}

function resolveCollapsedChangeHandler(
  value: UnknownRecord,
): DragResizeCollapsedChangeHandler | undefined {
  const handler = value.onCollapsedChange
  if (typeof handler !== 'function') return undefined
  const typedHandler = handler as DragResizeCollapsedChangeHandler
  return (collapsed: Readonly<DragResizeCollapsedState>): void => typedHandler(collapsed)
}

function resolveDragEndHandler(value: UnknownRecord): DragResizeEndHandler | undefined {
  const handler = value.onDragEnd
  if (typeof handler !== 'function') return undefined
  return handler as DragResizeEndHandler
}

/**
 * Returns only enabled resize directions, ignoring non-direction modifiers.
 *
 * @param modifiers - Directive modifiers captured from Vue.
 * @returns Enabled directions in stable visual order.
 */
export function getDragResizeDirections(
  modifiers: DragResizeModifiers,
): DragResizeDirection[] {
  return DIRECTIONS.filter(
    (direction: DragResizeDirection): boolean => modifiers[direction] === true,
  )
}

/**
 * Resolves a directive binding into validated runtime options.
 *
 * @param binding - Immutable snapshot of the Vue directive binding.
 * @returns Normalized directions, limits, modes, and optional callback.
 */
export function resolveDragResizeOptions(
  binding: DragResizeBindingSnapshot,
): ResolvedDragResizeOptions {
  const min = createSizeMap(DEFAULT_MIN_SIZE)
  const max = createSizeMap(DEFAULT_MAX_SIZE)
  const value = binding.value
  let onCollapsedChange: DragResizeCollapsedChangeHandler | undefined
  let onDragEnd: DragResizeEndHandler | undefined

  if (isValidSize(value)) {
    applySizeLimit(min, value, isValidSize)
  } else if (isOptionRecord(value)) {
    applyDirectionSizes(min, value, isValidSize)
    applySizeLimit(min, value.min, isValidSize)
    applySizeLimit(max, value.max, isValidMaximum)
    onCollapsedChange = resolveCollapsedChangeHandler(value)
    onDragEnd = resolveDragEndHandler(value)
  }

  normalizeMaximums(min, max)
  return {
    directions: resolveDirections(binding),
    isDefer: binding.modifiers.defer === true,
    isPut: binding.argument === 'put',
    max,
    min,
    onCollapsedChange,
    onDragEnd,
  }
}
