export interface ProjectExample {
  id: string
  name: string
  description?: string
  nodeCount: number
  definition: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
