import type { PBRChannel } from '@/types/pbr.types'

export interface PresetCategory {
  id: string
  name: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface PresetItem {
  id: string
  categoryId: string
  title: string
  content: string
  keywords: string[]
  sortOrder: number
  createdAt: number
  updatedAt: number
  pbrChannel?: PBRChannel
}
