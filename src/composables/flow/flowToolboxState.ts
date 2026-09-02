import { ref } from 'vue'

/**
 * Shared state for the flow toolbox.
 * When files are placed here, the canvas enters "placement mode" —
 * the next pane click will create upload nodes at the clicked position.
 */
export const pendingToolboxFiles = ref<File[]>([])

export function setPendingToolboxFiles(files: File[]) {
  pendingToolboxFiles.value = Array.isArray(files) ? files : []
}

export function clearPendingToolboxFiles() {
  pendingToolboxFiles.value = []
}
