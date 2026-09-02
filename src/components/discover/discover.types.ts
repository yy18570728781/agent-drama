export type DiscoverCategory = string

export type DiscoverCaseCategory = string

export interface DiscoverCategoryAccess {
  name: string
  permission: number
}

export type DiscoverBadgeTone = 'default' | 'exclusive'

export interface DiscoverShowcaseBadge {
  label: string
  tone?: DiscoverBadgeTone
}

export interface DiscoverShowcaseItem {
  id: string
  image: string
  imageAlt: string
  badges: readonly DiscoverShowcaseBadge[]
  title: string
  description: string
  prompt: string
  video?: string
}

export interface DiscoverCase {
  categoryId?: string
  id: string
  featured: boolean
  image: string
  imageAlt: string
  title: string
  description: string
  author: string
  authorAvatar?: string
  category: DiscoverCaseCategory
  likes?: string
  permission?: number
  prompt: string
  video?: string
}

export interface DiscoverCaseDetail extends DiscoverCase {
  assetType: number
  categoryId: string
  permission: number
}
