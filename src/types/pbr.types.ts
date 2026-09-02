export type PBRChannel = 'albedo' | 'displacement' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'edge'

export interface ColorSample {
  enabled: boolean
  color: [number, number, number]
  hueWeight: number
  satWeight: number
  lumWeight: number
  maskLow: number
  maskHigh: number
  targetValue: number
  isolate: boolean
}

export interface CurvePoint { x: number; y: number }

export interface CurvePoints {
  rgb: CurvePoint[]
  r: CurvePoint[]
  g: CurvePoint[]
  b: CurvePoint[]
}

export interface AlbedoParams {
  brightness: number
  contrast: number
  invert: boolean
  exposure: number
  exposureOffset: number
  exposureGamma: number
  colorBalanceR: number
  colorBalanceG: number
  colorBalanceB: number
  colorBalanceShadowsR: number
  colorBalanceShadowsG: number
  colorBalanceShadowsB: number
  colorBalanceMidtonesR: number
  colorBalanceMidtonesG: number
  colorBalanceMidtonesB: number
  colorBalanceHighlightsR: number
  colorBalanceHighlightsG: number
  colorBalanceHighlightsB: number
  colorBalancePreserveLuma: boolean
  blackAndWhite: boolean
  bwReds: number
  bwYellows: number
  bwGreens: number
  bwCyans: number
  bwBlues: number
  bwMagentas: number
  levelsMin: number
  levelsMax: number
  levelsMid: number
  levelsOutMin: number
  levelsOutMax: number
  levelsMinR: number
  levelsMaxR: number
  levelsMidR: number
  levelsOutMinR: number
  levelsOutMaxR: number
  levelsMinG: number
  levelsMaxG: number
  levelsMidG: number
  levelsOutMinG: number
  levelsOutMaxG: number
  levelsMinB: number
  levelsMaxB: number
  levelsMidB: number
  levelsOutMinB: number
  levelsOutMaxB: number
  curvePoints: CurvePoints
  eq1: number
  eq2: number
  eq3: number
  eq4: number
  eq5: number
  eq6: number
  hue: number
  saturation: number
  lightness: number
  vibrance: number
  colorize: boolean
  editDiffuse: EditDiffuseParams
}

export interface EditDiffuseParams {
  enabled: boolean
  blurSize: number
  avgBlurSize: number
  blurContrast: number
  lightMaskPow: number
  lightPow: number
  darkMaskPow: number
  darkPow: number
  hotSpot: number
  darkSpot: number
  finalContrast: number
  finalBias: number
  colorLerp: number
  saturation: number
}

export interface DisplacementParams {
  reveal: number
  sourceMode: 'diffuse' | 'normal'
  weights: number[]
  contrasts: number[]
  samples: ColorSample[]
  sampleBlend: number
  finalGain: number
  finalContrast: number
  finalBias: number
  invert: boolean
  spread: number
  spreadBoost: number
}

export interface NormalParams {
  reveal: number
  preContrast: number
  weights: number[]
  angularity: number
  angularIntensity: number
  finalContrast: number
  invertY: boolean
  invert: boolean
  shapeRecognition: number
  lightRotation: number
  shapeBias: number
  slopeBlur: number
}

export interface RoughnessParams {
  reveal: number
  metalSmoothness: number
  baseSmoothness: number
  samples: ColorSample[]
  sampleBlend: number
  sampleBlurSize: number
  highPassBlurSize: number
  highPassOverlay: number
  finalContrast: number
  finalBias: number
  invert: boolean
}

export interface MetallicParams {
  reveal: number
  sample: ColorSample
  blurSize: number
  overlayBlurSize: number
  highPassOverlay: number
  finalContrast: number
  finalBias: number
  invert: boolean
}

export interface AOParams {
  spread: number
  depth: number
  iterations: number
  samples: number
  invertY: boolean
  aoBlend: number
  aoPower: number
  aoBias: number
  invert: boolean
}

export interface EdgeParams {
  preContrast: number
  weights: number[]
  edgeAmount: number
  creviceAmount: number
  pinch: number
  pillow: number
  invertY: boolean
  finalContrast: number
  finalBias: number
  invert: boolean
}

export interface TilingParams {
  technique: 'overlap' | 'splat'
  outputResolution: number
  falloff: number
  overlapX: number
  overlapY: number
  splatRotation: number
  splatRotationRandom: number
  splatScale: number
  splatWobble: number
  splatRandomize: number
}

export type ChannelParams = AlbedoParams | DisplacementParams | NormalParams | RoughnessParams | MetallicParams | AOParams | EdgeParams

export interface ChannelData {
  canvas: HTMLCanvasElement | null
  thumbnail: string
  dirty: boolean
  hasCustomMap: boolean
}

export type ViewportMode = '3d' | '2d' | 'split' | 'tiling'
export type GeometryType = 'plane' | 'sphere' | 'cube' | 'cylinder' | 'imported'
export type LightingPreset = 'studio' | 'daylight' | 'warm' | 'cyberpunk' | 'custom'

export interface ExportConfig {
  format: 'png' | 'jpg' | 'bmp' | 'tga' | 'exr'
  resolution: number
  packR: PBRChannel | 'none'
  packG: PBRChannel | 'none'
  packB: PBRChannel | 'none'
  packA: PBRChannel | 'none'
}

export type PipelineMode = 'preview' | 'export'

export const ALL_CHANNELS: PBRChannel[] = ['albedo', 'displacement', 'normal', 'roughness', 'metallic', 'ao', 'edge']

export const CHANNEL_LABELS: Record<PBRChannel, string> = {
  albedo: 'Base Color',
  displacement: 'Height',
  normal: 'Normal',
  roughness: 'Roughness',
  metallic: 'Metallic',
  ao: 'AO',
  edge: 'Edge',
}

export const CHANNEL_SHORT_LABELS: Record<PBRChannel, string> = {
  albedo: 'BaseColor',
  displacement: 'Height',
  normal: 'Normal',
  roughness: 'Rough',
  metallic: 'Metal',
  ao: 'AO',
  edge: 'Edge',
}

export const CHANNEL_DEPENDENCIES: Record<PBRChannel, PBRChannel[]> = {
  albedo: [],
  displacement: ['albedo'],
  normal: ['displacement'],
  roughness: ['albedo', 'metallic'],
  metallic: ['albedo'],
  ao: ['displacement', 'normal'],
  edge: ['normal'],
}

export function computeExportClosure(channels: PBRChannel[]): PBRChannel[] {
  const needed = new Set<PBRChannel>()
  function add(ch: PBRChannel) {
    if (needed.has(ch)) return
    needed.add(ch)
    for (const dep of CHANNEL_DEPENDENCIES[ch]) add(dep)
  }
  for (const ch of channels) add(ch)
  return TOPOLOGICAL_ORDER.filter(ch => needed.has(ch))
}

export const TOPOLOGICAL_ORDER: PBRChannel[] = [
  'albedo', 'displacement', 'normal', 'metallic', 'roughness', 'ao', 'edge',
]

export const PBR_CHANNEL_INDEX: Record<PBRChannel, number> = {
  albedo: 0,
  displacement: 1,
  normal: 2,
  metallic: 3,
  roughness: 4,
  ao: 5,
  edge: 6,
}

export const DEFAULT_CHANNEL_COLORS: Record<PBRChannel, string> = {
  albedo: '#444444',
  displacement: '#000000',
  normal: '#8080ff',
  roughness: '#888888',
  metallic: '#000000',
  ao: '#ffffff',
  edge: '#808080',
}

export const UE_SUFFIX: Record<PBRChannel, string> = {
  albedo: 'BaseColor',
  displacement: 'Displacement',
  normal: 'Normal',
  roughness: 'Roughness',
  metallic: 'Metallic',
  ao: 'AmbientOcclusion',
  edge: 'Edge',
}

export const PACK_SUFFIX = {
  ue: 'ORM',
  unity: 'MetallicSmoothness',
}

export const CHANNEL_PROMPT_TEMPLATES: Record<PBRChannel, string> = {
  albedo: '生成一张 PBR 标准材质的 BaseColor(底色) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  displacement: '基于该 BaseColor 贴图生成 PBR 标准材质的 Displacement(高度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  normal: '基于该 BaseColor 贴图生成 PBR 标准材质的 Normal(法线) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  roughness: '基于该 BaseColor 贴图生成 PBR 标准材质的 Roughness(粗糙度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  metallic: '基于该 BaseColor 贴图生成 PBR 标准材质的 Metallic(金属度) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  ao: '基于该 BaseColor 贴图生成 PBR 标准材质的 AmbientOcclusion(环境遮蔽) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
  edge: '基于该 BaseColor 贴图生成 PBR 标准材质的 Edge(边缘) 贴图，四方连续贴图，3A级影视资产，8K高细节，高中低频细节丰富，虚幻5引擎渲染',
}
