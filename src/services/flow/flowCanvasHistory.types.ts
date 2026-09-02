export type FlowCanvasHistorySaveType =
  | 'automatic'
  | 'create'
  | 'manual'
  | 'restore'
  | 'unknown'

export interface FlowCanvasHistoryVersion {
  actorAvatar: string
  actorId: string
  actorName: string
  createdAt: string
  id: string
  label: string
  objectKey: string
  revision: number
  saveType: FlowCanvasHistorySaveType
}
