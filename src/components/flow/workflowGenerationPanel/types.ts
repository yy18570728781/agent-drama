export interface WorkflowGenerationPanelProps {
  node: any
  readOnly?: boolean
  style?: any
}

export interface WorkflowGenerationPanelEmits {
  (event: 'generate', payload: any): void
  (event: 'close'): void
  (event: 'focus-panel'): void
  (event: 'sync-upstream'): void
  (event: 'files-dropped', payload: { nodeId: string, files?: File[], urls?: string[], referenceNames?: string[], assetInfo?: unknown, replaceIndex?: number }): void
  (event: 'clipboard-reference-pasted', payload: { nodeId: string, files: File[] }): void
  (event: 'remove-upstream', payload: { sourceNodeId: string, targetNodeId: string }): void
  (event: 'reference-url-updated', oldUrl: string, newUrl: string): void
}
