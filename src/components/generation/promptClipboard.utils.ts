function serializeClipboardNode(node: Node | null | undefined): string {
  if (!node) return ''
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (!(node instanceof HTMLElement) && !(node instanceof DocumentFragment)) return node.textContent || ''
  if (node instanceof HTMLElement && node.classList.contains('ref-tag')) {
    return node.dataset.portableToken || node.innerText || ''
  }
  if (node instanceof HTMLElement && node.tagName === 'BR') return '\n'
  const text = Array.from(node.childNodes).map(serializeClipboardNode).join('')
  if (node instanceof HTMLElement && (node.tagName === 'DIV' || node.tagName === 'P')) return `${text}\n`
  return text
}

/** Returns portable plain text for the current selection when it belongs to the prompt editor. */
export function getPortablePromptSelection(editor: HTMLElement, selection: Selection | null): string | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const ancestor = range.commonAncestorContainer
  if (ancestor !== editor && !editor.contains(ancestor)) return null
  return serializeClipboardNode(range.cloneContents())
}
