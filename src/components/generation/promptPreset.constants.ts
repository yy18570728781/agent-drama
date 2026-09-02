import type { PresetCategory, PresetItem } from '@/components/generation/promptPreset.types'

const NOW = Date.now()

export const LEGACY_DEFAULT_ITEM_CONTENTS: Record<string, string> = {
  preset_albedo: '生成一张 PBR 标准材质的 BaseColor(底色) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_displacement: '基于该 BaseColor 贴图生成 PBR 标准材质的 Displacement(高度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_normal: '基于该 BaseColor 贴图生成 PBR 标准材质的 Normal(法线) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_metallic: '基于该 BaseColor 贴图生成 PBR 标准材质的 Metallic(金属度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_roughness: '基于该 BaseColor 贴图生成 PBR 标准材质的 Roughness(粗糙度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_ao: '基于该 BaseColor 贴图生成 PBR 标准材质的 AmbientOcclusion(环境遮蔽) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  preset_edge: '基于该 BaseColor 贴图生成 PBR 标准材质的 Edge(边缘) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
}

export const DEFAULT_CATEGORIES: PresetCategory[] = [
  {
    id: 'cat_pbr_texture',
    name: '材质贴图预设',
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

export const DEFAULT_ITEMS: PresetItem[] = [
  {
    id: 'preset_albedo',
    categoryId: 'cat_pbr_texture',
    title: '基础色 (BaseColor)',
    content: '生成一张 PBR 标准材质的 [BaseColor(底色)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['albedo', 'basecolor', '基础色', '底色'],
    sortOrder: 0,
    pbrChannel: 'albedo',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_displacement',
    categoryId: 'cat_pbr_texture',
    title: '高度图 (Displacement)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [Displacement(高度)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['height', 'displacement', '高度'],
    sortOrder: 1,
    pbrChannel: 'displacement',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_normal',
    categoryId: 'cat_pbr_texture',
    title: '法线图 (Normal)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [Normal(法线)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['normal', '法线'],
    sortOrder: 2,
    pbrChannel: 'normal',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_metallic',
    categoryId: 'cat_pbr_texture',
    title: '金属度 (Metallic)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [Metallic(金属度)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['metallic', 'metalness', '金属'],
    sortOrder: 3,
    pbrChannel: 'metallic',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_roughness',
    categoryId: 'cat_pbr_texture',
    title: '粗糙度 (Roughness)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [Roughness(粗糙度)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['roughness', '粗糙'],
    sortOrder: 4,
    pbrChannel: 'roughness',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_ao',
    categoryId: 'cat_pbr_texture',
    title: '环境光遮蔽 (AO)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [AmbientOcclusion(环境遮蔽)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['ao', 'ambient', '环境光', '遮蔽'],
    sortOrder: 5,
    pbrChannel: 'ao',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'preset_edge',
    categoryId: 'cat_pbr_texture',
    title: '边缘图 (Edge)',
    content: '基于该 BaseColor 贴图生成 PBR 标准材质的 [Edge(边缘)] 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
    keywords: ['edge', '边缘'],
    sortOrder: 6,
    pbrChannel: 'edge',
    createdAt: NOW,
    updatedAt: NOW,
  },
]
