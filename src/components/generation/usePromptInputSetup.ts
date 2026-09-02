import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { PromptInputProps, PromptInputEmits } from './promptInput/types'
import { matchesPinyin } from './promptPinyin.utils'
import { useSubjectPicker, type SubjectPickerItem, type SubjectSelectPayload } from '@/composables/subjects/useSubjectPicker'
import {
  findPromptReferenceMatches,
  getLegacyReferenceLabel,
  getPortableReferenceToken,
  getReferenceDisplayName,
  getReferenceOrdinal as resolveReferenceOrdinal,
} from './promptReference.utils'
import { getPortablePromptSelection } from './promptClipboard.utils'

// ── @ reference menu state ──

export function usePromptInputSetup(props: PromptInputProps, emit: PromptInputEmits) {
const textareaRef = ref<HTMLElement | null>(null)
const prompt = ref(props.modelValue)
const isComposing = ref(false)

watch(() => props.modelValue, (val) => {
  if (isComposing.value) return
  if (val !== prompt.value) {
    prompt.value = val
    nextTick(() => renderPromptEditorFromState())
  }
})

function getReferenceOrdinal(index: number): number {
  return resolveReferenceOrdinal(props.refImages, index)
}

function getReferenceDisplayLabel(index: number): string {
  const item = props.refImages[index]
  if (!item) return ''
  return getReferenceDisplayName(item, getLegacyReferenceLabel(props.refImages, index))
}

//  prompt hover preview ?
let promptHoverPreviewEl: HTMLImageElement | null = null

function removePromptHoverPreview() {
  if (promptHoverPreviewEl?.parentNode) {
    promptHoverPreviewEl.parentNode.removeChild(promptHoverPreviewEl)
  }
  promptHoverPreviewEl = null
}

//  reference menu state ?
const showRefMenu = ref(false)
const refSearchQuery = ref('')
const atPosition = ref(-1)
const menuPosition = ref({ top: 0, left: 0, width: 0 })
const refMenuIndex = ref(0)

function closeReferenceMenu() {
  showRefMenu.value = false
  refSearchQuery.value = ''
}

let pendingReplaceRefTag: HTMLElement | null = null

function closeFloatingOverlays() {
  closeReferenceMenu()
  pendingReplaceRefTag = null
  removePromptHoverPreview()
}

// ── 光标位置保存/恢复：供异步操作后恢复 ref-tag 插入位置 ──
let savedRange: Range | null = null

function saveSelection(): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  savedRange = sel.getRangeAt(0).cloneRange()
}

function restoreSelection(): void {
  if (!textareaRef.value || !savedRange) return
  textareaRef.value.focus()
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(savedRange)
  savedRange = null
}

//  filtered images for @ menu
const filteredRefImages = computed(() => {
  if (!refSearchQuery.value.trim()) return props.refImages
  const query = refSearchQuery.value.toLowerCase()
  return props.refImages.filter((img, i) => {
    const label = getReferenceDisplayLabel(i)
    const numStr = String(getReferenceOrdinal(i))
    const mediaType = img.mediaType || (img.isVideo ? 'video' : 'image')
    const initials = mediaType === 'video' ? 'sp' : mediaType === 'audio' ? 'yp' : mediaType === '3d_model' ? 'mx' : 'tp'
    const fullPinyin = mediaType === 'video' ? 'shipin' : mediaType === 'audio' ? 'yinpin' : mediaType === '3d_model' ? 'moxing' : 'tupian'
    const shortRef = `${initials}${numStr}`
    return label.toLowerCase().includes(query)
      || shortRef === query
      || initials.startsWith(query)
      || fullPinyin.includes(query)
  })
})

// ── subject picker: loads subject library when menu opens ──
const { subjects: atMenuSubjects, loading: atMenuSubjectsLoading, categoryBar: atMenuCategoryBar } = useSubjectPicker(
  refSearchQuery,
  showRefMenu,
)

// ── filtered subjects for keyboard nav (client-side pinyin match) ──
const filteredSubjects = computed<SubjectPickerItem[]>(() => {
  if (!refSearchQuery.value.trim()) return atMenuSubjects.value
  return atMenuSubjects.value.filter(s => matchesPinyin(s.name, refSearchQuery.value))
})

// ── flat menu items for keyboard nav ──
interface FlatMenuItem {
  type: 'ref' | 'subject'
  id: string
  refIndex?: number
  subjectId?: string
}

const flatMenuItems = computed<FlatMenuItem[]>(() => {
  const items: FlatMenuItem[] = []
  for (let i = 0; i < filteredRefImages.value.length; i++) {
    const origIdx = props.refImages.indexOf(filteredRefImages.value[i])
    items.push({ type: 'ref', id: `ref-${origIdx}`, refIndex: origIdx })
  }
  for (const sub of filteredSubjects.value) {
    items.push({ type: 'subject', id: `sub-${sub.id}`, subjectId: sub.id })
  }
  return items
})

const activeItemId = computed(() => {
  const items = flatMenuItems.value
  if (items.length === 0) return ''
  const idx = Math.min(refMenuIndex.value, items.length - 1)
  return items[idx]?.id || ''
})

function setActiveByItemId(id: string) {
  const idx = flatMenuItems.value.findIndex(item => item.id === id)
  if (idx >= 0) refMenuIndex.value = idx
}

function openReferenceMenuAtTarget(target: HTMLElement, activeIndex = 0) {
  if (!textareaRef.value) return
  const editorRect = textareaRef.value.getBoundingClientRect()
  menuPosition.value = {
    left: editorRect.left,
    top: editorRect.top,
    width: editorRect.width,
  }
  refMenuIndex.value = Math.max(0, activeIndex)
  showRefMenu.value = true
  refSearchQuery.value = ''
}

//  contenteditable serialization
function serializePromptEditorNode(node: Node | null | undefined): string {
  if (!node) return ''
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (!(node instanceof HTMLElement)) {
    return node.textContent || ''
  }
  if (node.classList.contains('ref-tag')) {
    const index = Number(node.dataset.index ?? '-1')
    return index >= 0 ? getLegacyReferenceLabel(props.refImages, index) : (node.innerText || '')
  }
  if (node.tagName === 'BR') {
    return '\n'
  }

  const childText = Array.from(node.childNodes).map((child) => serializePromptEditorNode(child)).join('')
  if (node.tagName === 'DIV' || node.tagName === 'P') {
    return `${childText}\n`
  }
  return childText
}

function serializePromptEditorText() {
  const el = textareaRef.value
  if (!el) return ''
  const nodes = Array.from(el.childNodes)
  return nodes.map((node, index) => {
    let text = serializePromptEditorNode(node)
    if (node.nodeType === Node.TEXT_NODE) {
      let nextNode: Node | null = null
      for (let i = index + 1; i < nodes.length; i += 1) {
        const candidate = nodes[i]
        if (candidate.nodeType === Node.TEXT_NODE && !(candidate.textContent || '')) continue
        nextNode = candidate
        break
      }
      if (isPromptRefTagElement(nextNode)) {
        text = text.replace(/@(\S*)$/, '')
      }
    }
    return text
  }).join('')
}

function syncPromptFromDom(preserveWhenEmpty = false) {
  if (textareaRef.value) {
    const domPrompt = serializePromptEditorText()
    if (domPrompt.trim() || !preserveWhenEmpty || !prompt.value) {
      prompt.value = domPrompt
    }
  }
  return prompt.value
}

function prepareEmptyEditor() {
  const editor = textareaRef.value
  if (!editor || prompt.value || serializePromptEditorText()) return
  editor.replaceChildren()
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(editor, 0)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function isPromptRefTagElement(node: Node | null | undefined): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains('ref-tag')
}

function isPromptSpacingTextNode(node: Node | null | undefined) {
  if (!(node && node.nodeType === Node.TEXT_NODE)) return false
  return /^[ \t]*$/.test(node.textContent || '')
}

function findAdjacentRefTagFromCaret(range: Range, direction: 'backward' | 'forward') {
  const container = range.startContainer
  const offset = range.startOffset

  const resolvePrevious = (node: Node | null) => {
    let current = node?.previousSibling || null
    while (current && isPromptSpacingTextNode(current)) current = current.previousSibling
    return isPromptRefTagElement(current) ? current : null
  }

  const resolveNext = (node: Node | null) => {
    let current = node?.nextSibling || null
    while (current && isPromptSpacingTextNode(current)) current = current.nextSibling
    return isPromptRefTagElement(current) ? current : null
  }

  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent || ''
    if (direction === 'backward') {
      if (offset === 0) {
        return resolvePrevious(container)
      }
    } else if (offset >= text.length) {
      return resolveNext(container)
    }
  }

  if (container instanceof HTMLElement) {
    const child = container.childNodes[offset - (direction === 'backward' ? 1 : 0)] || null
    if (isPromptRefTagElement(child)) return child
    return direction === 'backward' ? resolvePrevious(child || container.childNodes[offset] || null) : resolveNext(child || container.childNodes[offset - 1] || null)
  }

  return null
}

function removePromptRefTagAtCaret(direction: 'backward' | 'forward') {
  const el = textareaRef.value
  const sel = window.getSelection()
  if (!el || !sel || sel.rangeCount === 0) return false

  const range = sel.getRangeAt(0)
  if (!range.collapsed) return false

  const refTag = findAdjacentRefTagFromCaret(range, direction)
  if (!refTag || !refTag.parentNode) return false

  const previousSibling = refTag.previousSibling
  const nextSibling = refTag.nextSibling
  const previousTextNode = previousSibling?.nodeType === Node.TEXT_NODE ? previousSibling as Text : null
  const nextTextNode = nextSibling?.nodeType === Node.TEXT_NODE ? nextSibling as Text : null
  if (isPromptSpacingTextNode(previousSibling)) (previousSibling as Node).parentNode?.removeChild(previousSibling as Node)
  if (isPromptSpacingTextNode(nextSibling)) (nextSibling as Node).parentNode?.removeChild(nextSibling as Node)
  refTag.parentNode.removeChild(refTag)

  const caretRange = document.createRange()
  if (direction === 'backward' && previousTextNode?.parentNode) {
    caretRange.setStart(previousTextNode, previousTextNode.textContent?.length || 0)
  } else if (direction === 'forward' && nextTextNode?.parentNode) {
    caretRange.setStart(nextTextNode, 0)
  } else {
    caretRange.selectNodeContents(el)
    caretRange.collapse(false)
  }
  caretRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caretRange)
  onPromptInput()
  return true
}

//  createPromptRefTag ?
function createPromptRefTag(index: number, portableToken?: string) {
  const img = props.refImages[index]
  if (!img) return null

  const label = getReferenceDisplayLabel(index)
  const wrapper = document.createElement('span')
  wrapper.className = 'ref-tag'
  wrapper.contentEditable = 'false'
  wrapper.dataset.index = String(index)
  wrapper.dataset.portableToken = portableToken || getPortableReferenceToken(props.refImages, index)
  wrapper.title = 'Click to replace reference'
  wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:3px 8px 3px 4px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:8px;color:#93c5fd;font-size:12px;line-height:1.2;vertical-align:middle;cursor:pointer;transition:all 0.2s;user-select:none;position:relative;margin:0 2px;white-space:nowrap;flex-wrap:nowrap;'

  const thumbMediaType = img.mediaType || (img.isVideo ? 'video' : 'image')
  let thumb: HTMLElement
  if (thumbMediaType === 'image') {
    const imageThumb = document.createElement('img')
    imageThumb.src = img.url
    imageThumb.className = 'ref-tag-thumb'
    imageThumb.style.cssText = 'display:inline-block;width:42px!important;height:24px!important;min-width:42px;min-height:24px;max-width:42px;max-height:24px;object-fit:cover;border-radius:4px;border:0.5px solid rgba(255,255,255,0.2);flex-shrink:0;vertical-align:middle;cursor:pointer;'

    imageThumb.addEventListener('mouseenter', (e) => {
      removePromptHoverPreview();
      const target = e.target as HTMLImageElement
      const rect = target.getBoundingClientRect()

      promptHoverPreviewEl = document.createElement('img')
      promptHoverPreviewEl.src = img.url
      promptHoverPreviewEl.style.cssText = `position:fixed;max-width:150px;max-height:75px;width:auto;height:auto;object-fit:contain;border-radius:4px;border:2px solid rgba(255,255,255,0.3);z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,0.6);pointer-events:none;left:${rect.left}px;top:${rect.bottom + 8}px;`
      document.body.appendChild(promptHoverPreviewEl)
    })

    imageThumb.addEventListener('mouseleave', () => {
      removePromptHoverPreview();
    })
    thumb = imageThumb
  } else if (thumbMediaType === 'video') {
    const videoThumb = document.createElement('video')
    videoThumb.src = img.url
    videoThumb.className = 'ref-tag-thumb'
    videoThumb.style.cssText = 'display:inline-block;width:42px!important;height:24px!important;min-width:42px;min-height:24px;max-width:42px;max-height:24px;object-fit:cover;border-radius:4px;border:0.5px solid rgba(255,255,255,0.2);flex-shrink:0;vertical-align:middle;cursor:pointer;'
    videoThumb.muted = true
    videoThumb.loop = true
    videoThumb.playsInline = true
    videoThumb.preload = 'metadata'
    videoThumb.disablePictureInPicture = true
    videoThumb.disableRemotePlayback = true
    videoThumb.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback')
    videoThumb.setAttribute('referrerpolicy', 'no-referrer')

    videoThumb.addEventListener('mouseenter', () => {
      void videoThumb.play().catch(() => {})
    })
    videoThumb.addEventListener('mouseleave', () => {
      videoThumb.pause()
      try {
        videoThumb.currentTime = 0
      } catch {}
    })
    thumb = videoThumb
  } else {
    const fileThumb = document.createElement('span')
    fileThumb.className = 'ref-tag-thumb ref-tag-thumb-file'
    fileThumb.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:42px;height:24px;min-width:42px;min-height:24px;max-width:42px;max-height:24px;border-radius:4px;border:0.5px solid rgba(255,255,255,0.2);background:linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.96));color:#dbeafe;flex-shrink:0;vertical-align:middle;'
    fileThumb.innerHTML = thumbMediaType === 'audio'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block;"><path d="M10 8v8"/><path d="M14 6v12"/><path d="M18 10v4"/><path d="M6 10v4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><path d="M3.29 7 12 12l8.71-5"></path><path d="M12 22V12"></path></svg>'
    fileThumb.setAttribute('aria-label', thumbMediaType === 'audio' ? 'audio reference' : 'model reference')
    thumb = fileThumb
  }

  wrapper.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    pendingReplaceRefTag = wrapper
    openReferenceMenuAtTarget(wrapper, index)
  })
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.background = 'rgba(59,130,246,0.25)'
    wrapper.style.borderColor = 'rgba(59,130,246,0.5)'
  })
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.background = 'rgba(59,130,246,0.15)'
    wrapper.style.borderColor = 'rgba(59,130,246,0.3)'
  })

  const labelNode = document.createElement('span')
  labelNode.className = 'ref-tag-label'
  labelNode.textContent = label
  labelNode.style.cssText = 'display:inline-block;max-width:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'

  wrapper.appendChild(thumb)
  wrapper.appendChild(labelNode)
  return wrapper
}

//  renderPromptEditorFromState
function renderPromptEditorFromState() {
  const el = textareaRef.value
  if (!el) return

  const text = prompt.value || ''
  if (!text) {
    el.innerHTML = ''
    return
  }

  if (!props.refImages.length) {
    el.textContent = text
    return
  }

  const fragment = document.createDocumentFragment()
  const tokenMatches = findPromptReferenceMatches(text, props.refImages)
  let lastIndex = 0
  for (const match of tokenMatches) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }
    const rawToken = text.slice(match.index, match.index + match.length)
    const portableToken = rawToken.startsWith('@[') ? rawToken : undefined
    const wrapper = createPromptRefTag(match.referenceIndex, portableToken)
    if (wrapper) {
      fragment.appendChild(wrapper)
    } else {
      fragment.appendChild(document.createTextNode(text.slice(match.index, match.index + match.length)))
    }
    lastIndex = match.index + match.length
  }

  if (!tokenMatches.length) {
    el.textContent = text
    return
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
  }

  el.innerHTML = ''
  el.appendChild(fragment)
}

function hasPromptReferenceTokens(text: string) {
  return findPromptReferenceMatches(text || '', props.refImages).length > 0
}

//  insertRef
const insertRef = (i: number) => {
  if (!textareaRef.value) return

  closeReferenceMenu()
  textareaRef.value.focus()
  const sel = window.getSelection()

  if (pendingReplaceRefTag && pendingReplaceRefTag.parentNode) {
    const wrapper = createPromptRefTag(i)
    if (!wrapper) return
    pendingReplaceRefTag.replaceWith(wrapper)
    pendingReplaceRefTag = null
    const replaceRange = document.createRange()
    if (wrapper.nextSibling?.nodeType === Node.TEXT_NODE) {
      replaceRange.setStart(wrapper.nextSibling, Math.min(1, wrapper.nextSibling.textContent?.length || 0))
    } else {
      replaceRange.setStartAfter(wrapper)
    }
    replaceRange.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(replaceRange)
    onPromptInput()
    return
  }

  if (!sel || sel.rangeCount === 0) {
    const range = document.createRange()
    range.selectNodeContents(textareaRef.value)
    range.collapse(false)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const textNode = range.startContainer
  if (textNode.nodeType === Node.TEXT_NODE) {
    const text = textNode.textContent || ''
    const offset = range.startOffset
    const beforeCursor = text.slice(0, offset)
    const atMatch = beforeCursor.match(/@(\S*)$/)

    if (atMatch) {
      const atStart = offset - atMatch[0].length
      const newText = text.slice(0, atStart) + text.slice(offset)
      textNode.textContent = newText
      range.setStart(textNode, atStart)
      range.setEnd(textNode, atStart)
    }
  }

  const wrapper = createPromptRefTag(i)
  if (!wrapper) return

  range.insertNode(wrapper)
  range.setStartAfter(wrapper)
  range.setEndAfter(wrapper)

  const space = document.createTextNode(' ')
  range.insertNode(space)
  range.setStartAfter(space)
  range.setEndAfter(space)

  sel.removeAllRanges()
  sel.addRange(range)

  onPromptInput()
}

// ── selectSubject: emit event for parent to fetch + add media as reference ──
function selectSubject(payload: SubjectSelectPayload) {
  if (payload.multiSelect !== true) closeReferenceMenu()
  emit('select-subject', payload)
}

// ── onPromptInput ──
const onPromptInput = () => {
  if (isComposing.value) return
  const text = syncPromptFromDom()
  emit('update:modelValue', text)
  emit('prompt-change')

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)

  let beforeCursor = ''
  const walker = document.createTreeWalker(
    textareaRef.value!,
    NodeFilter.SHOW_TEXT,
    null
  )

  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('.ref-tag')) {
      continue
    }
    if (node === range.startContainer) {
      beforeCursor += node.textContent?.slice(0, range.startOffset) || ''
      break
    } else {
      beforeCursor += node.textContent || ''
    }
  }

  const atMatch = beforeCursor.match(/@(\S*)$/)
  if (atMatch) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const editorRect = textareaRef.value!.getBoundingClientRect()

      menuPosition.value = {
        left: editorRect.left,
        top: editorRect.top,
        width: editorRect.width,
      }
    }

    showRefMenu.value = true
    refSearchQuery.value = atMatch[1] || ''
    atPosition.value = beforeCursor.length - atMatch[0].length
    refMenuIndex.value = 0
  } else {
    closeReferenceMenu()
  }
}

//  onPromptPaste
function finishComposition(data: string) {
  requestAnimationFrame(() => {
    const editor = textareaRef.value
    if (!editor) return
    const domText = serializePromptEditorText()
    if (!domText && data) {
      editor.textContent = data
    }
    onPromptInput()
  })
}

const onPromptPaste = (e: ClipboardEvent) => {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  if (!text) return

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  range.deleteContents()

  const textNode = document.createTextNode(text)
  range.insertNode(textNode)

  range.setStartAfter(textNode)
  range.setEndAfter(textNode)
  sel.removeAllRanges()
  sel.addRange(range)

  prompt.value = serializePromptEditorText()
  emit('update:modelValue', prompt.value)
  if (hasPromptReferenceTokens(prompt.value)) {
    nextTick(() => {
      renderPromptEditorFromState()
    })
  }
}

const onPromptCopy = (event: ClipboardEvent) => {
  const editor = textareaRef.value
  if (!editor || !event.clipboardData) return
  const portableText = getPortablePromptSelection(editor, window.getSelection())
  if (portableText === null) return
  event.preventDefault()
  event.clipboardData.setData('text/plain', portableText)
}

//  onPromptKeydown
const onPromptKeydown = (e: KeyboardEvent) => {
  if (isComposing.value || e.isComposing || e.keyCode === 229) return
  if (e.key === 'Backspace' && !showRefMenu.value && removePromptRefTagAtCaret('backward')) {
    e.preventDefault()
    return
  }
  if (e.key === 'Delete' && !showRefMenu.value && removePromptRefTagAtCaret('forward')) {
    e.preventDefault()
    return
  }
  if (!showRefMenu.value) return
  const flatItems = flatMenuItems.value
  const total = flatItems.length
  if (total === 0) {
    if (e.key === 'Escape') { closeReferenceMenu() }
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    refMenuIndex.value = (refMenuIndex.value + 1) % total
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    refMenuIndex.value = (refMenuIndex.value - 1 + total) % total
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    e.stopImmediatePropagation()
    const item = flatItems[refMenuIndex.value]
    if (item && item.type === 'ref') {
      insertRef(item.refIndex!)
    } else if (item && item.type === 'subject') {
      selectSubject({ subjectId: item.subjectId! })
    }
  } else if (e.key === 'Escape') {
    closeReferenceMenu()
  }
}

//  global event handlers
const onGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showRefMenu.value) {
    closeReferenceMenu()
  }
}

const onGlobalPointerDown = (e: MouseEvent | PointerEvent) => {
  const target = e.target as HTMLElement | null
  if (!target) {
    closeFloatingOverlays()
    return
  }
  if (showRefMenu.value && !target.closest('.ref-menu') && !target.closest('.sub-media-pop')) {
    closeReferenceMenu()
  }
  if (promptHoverPreviewEl && !target.closest('.ref-tag')) {
    removePromptHoverPreview()
  }
}

const onWindowBlur = () => {
  closeFloatingOverlays()
}

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown, true)
  document.addEventListener('pointerdown', onGlobalPointerDown, true)
  window.addEventListener('blur', onWindowBlur)
  renderPromptEditorFromState()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown, true)
  document.removeEventListener('pointerdown', onGlobalPointerDown, true)
  window.removeEventListener('blur', onWindowBlur)
  closeFloatingOverlays()
})

//  multiline batch mode ?
const multilinePrompts = computed(() => {
  if (!props.multilineBatchMode) return []
  return prompt.value.split('\n').map((line: string) => line.trim()).filter(Boolean)
})

function toggleMultilineBatch() {
  emit('multiline-batch-change', !props.multilineBatchMode)
}

//  expose ?
function decodeHTMLEntities(text: string): string {
  if (!text || !text.includes('&')) return text
  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

function setPrompt(newPrompt: string) {
  prompt.value = decodeHTMLEntities(newPrompt)
  emit('update:modelValue', prompt.value)
  if (textareaRef.value) {
    renderPromptEditorFromState()
  }
}

function focus() {
  textareaRef.value?.focus()
}

function getPrompt(): string {
  return prompt.value
}

const exposed = {
  setPrompt,
  focus,
  getPrompt,
  renderPromptEditorFromState,
  insertRef,
  saveSelection,
  restoreSelection,
  closeReferenceMenu,
  syncPromptFromDom,
}

return {
  textareaRef,
  isComposing,
  showRefMenu,
  menuPosition,
  refSearchQuery,
  activeItemId,
  multilinePrompts,
  atMenuSubjects,
  atMenuSubjectsLoading,
  atMenuCategoryBar,
  getReferenceDisplayLabel,
  getReferenceOrdinal,
  setActiveByItemId,
  insertRef,
  selectSubject,
  prepareEmptyEditor,
  onPromptInput,
  onPromptPaste,
  onPromptCopy,
  onPromptKeydown,
  finishComposition,
  toggleMultilineBatch,
  exposed,
}
}
