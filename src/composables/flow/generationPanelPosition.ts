export interface GenerationPanelAnchorPosition {
  left: number
  top: number
}

/**
 * Anchors a generation panel directly below a node while keeping both horizontal centers aligned.
 * @param anchorCenterX Node center relative to the canvas wrapper
 * @param anchorBottomY Node bottom relative to the canvas wrapper
 * @param panelWidth Current generation panel width
 * @param gap Fixed vertical distance between node and panel
 * @returns Absolute panel coordinates relative to the canvas wrapper
 */
export function resolveGenerationPanelAnchor(
  anchorCenterX: number,
  anchorBottomY: number,
  panelWidth: number,
  gap = 12,
): GenerationPanelAnchorPosition {
  return {
    left: anchorCenterX - panelWidth / 2,
    top: anchorBottomY + gap,
  }
}
