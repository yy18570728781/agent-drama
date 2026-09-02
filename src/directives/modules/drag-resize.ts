import type { Directive, DirectiveBinding } from 'vue'
import { createDragResizeRuntime } from '../dragResize/dragResizeRuntime'
import type {
  DragResizeBindingSnapshot,
  DragResizeCollapsedSnapshot,
  DragResizeElementApi,
  DragResizeModifier,
  DragResizeRuntime,
  DragResizeValue,
} from '../dragResize/dragResize.types'

const runtimes = new WeakMap<HTMLElement, DragResizeRuntime>()
type ElementApiKey = keyof DragResizeElementApi
type ElementApiDescriptors = Map<ElementApiKey, PropertyDescriptor | undefined>

const elementApiDescriptors = new WeakMap<HTMLElement, ElementApiDescriptors>()

function createBindingSnapshot(
  binding: DirectiveBinding<DragResizeValue, DragResizeModifier, 'put'>,
): DragResizeBindingSnapshot {
  return {
    argument: binding.arg === 'put' ? 'put' : undefined,
    modifiers: {
      bottom: binding.modifiers.bottom,
      defer: binding.modifiers.defer,
      left: binding.modifiers.left,
      right: binding.modifiers.right,
      top: binding.modifiers.top,
    },
    value: binding.value,
  }
}

function defineElementApiProperty(
  element: HTMLElement,
  key: ElementApiKey,
  descriptor: PropertyDescriptor,
  descriptors: ElementApiDescriptors,
): void {
  const existing = Object.getOwnPropertyDescriptor(element, key)
  if (existing && !existing.configurable) return
  if (!existing && !Object.isExtensible(element)) return
  descriptors.set(key, existing)
  Object.defineProperty(element, key, descriptor)
}

function installElementApi(element: HTMLElement, runtime: DragResizeRuntime): void {
  const descriptors: ElementApiDescriptors = new Map()
  const getCollapsedState = (): DragResizeCollapsedSnapshot => runtime.getCollapsedState()
  defineElementApiProperty(element, '__dragCollapsed__', {
    configurable: true,
    get: getCollapsedState,
  }, descriptors)
  defineElementApiProperty(element, 'getCollapsedState', {
    configurable: true,
    value: getCollapsedState,
  }, descriptors)
  elementApiDescriptors.set(element, descriptors)
}

function restoreElementApiProperty(
  element: HTMLElement,
  key: ElementApiKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  const current = Object.getOwnPropertyDescriptor(element, key)
  if (current && !current.configurable) return
  if (descriptor) Object.defineProperty(element, key, descriptor)
  else Reflect.deleteProperty(element, key)
}

function restoreElementApi(element: HTMLElement): void {
  const descriptors = elementApiDescriptors.get(element)
  descriptors?.forEach((descriptor: PropertyDescriptor | undefined, key: ElementApiKey): void => {
    restoreElementApiProperty(element, key, descriptor)
  })
  elementApiDescriptors.delete(element)
}

function destroyRuntime(element: HTMLElement): void {
  try {
    runtimes.get(element)?.destroy()
  } finally {
    restoreElementApi(element)
    runtimes.delete(element)
  }
}

function mountRuntime(
  element: HTMLElement,
  binding: DirectiveBinding<DragResizeValue, DragResizeModifier, 'put'>,
): void {
  destroyRuntime(element)
  if (binding.value === false) return
  const runtime = createDragResizeRuntime(element, createBindingSnapshot(binding))
  runtimes.set(element, runtime)
  installElementApi(element, runtime)
}

const dragResize: Directive<
  HTMLElement,
  DragResizeValue,
  DragResizeModifier,
  'put'
> = {
  beforeUpdate(
    element: HTMLElement,
    binding: DirectiveBinding<DragResizeValue, DragResizeModifier, 'put'>,
  ): void {
    if (binding.value === false) destroyRuntime(element)
  },
  mounted(
    element: HTMLElement,
    binding: DirectiveBinding<DragResizeValue, DragResizeModifier, 'put'>,
  ): void {
    mountRuntime(element, binding)
  },
  updated(
    element: HTMLElement,
    binding: DirectiveBinding<DragResizeValue, DragResizeModifier, 'put'>,
  ): void {
    if (binding.value === false) {
      destroyRuntime(element)
      return
    }
    const runtime = runtimes.get(element)
    if (runtime) runtime.update(createBindingSnapshot(binding))
    else mountRuntime(element, binding)
  },
  beforeUnmount(element: HTMLElement): void {
    destroyRuntime(element)
  },
}

export default dragResize
