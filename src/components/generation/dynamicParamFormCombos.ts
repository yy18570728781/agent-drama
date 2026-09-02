type DynamicParam = {
  name?: string
  label?: string
  type?: string
  hidden?: boolean
  min?: number
  max?: number
}

type DimensionCombo = {
  widthParam: DynamicParam & { name: string }
  heightParam: DynamicParam & { name: string }
}

type DimensionPreset = {
  label: string
  width: number
  height: number
}

function isDimensionParam(param: DynamicParam | undefined, fallbackNames: string[]): boolean {
  const name = String(param?.name || '').toLowerCase()
  const label = String(param?.label || '').toLowerCase()
  return fallbackNames.some((item) => name === item || label.includes(item))
}

function clampPreset(value: number, min?: number, max?: number): number {
  if (typeof min === 'number' && value < min) return min
  if (typeof max === 'number' && value > max) return max
  return value
}

export function filterDynamicVisibleParams<T extends DynamicParam>(params: T[], excludedNames: string[] = []): T[] {
  const excluded = new Set(excludedNames)
  return params.filter((param) => (
    param
    && !param.hidden
    && !excluded.has(param.name || '')
    && param.type !== 'images'
    && param.type !== 'file'
    && param.type !== 'file_list'
    && param.type !== 'files'
  ))
}

export function buildDynamicParamRenderItems(params: DynamicParam[]) {
  const items = []
  const consumed = new Set<string>()
  for (let index = 0; index < params.length; index += 1) {
    const param = params[index]
    if (!param?.name || consumed.has(param.name)) continue
    const nextParam = params[index + 1]
    const currentIsWidth = isDimensionParam(param, ['width', 'w'])
    const currentIsHeight = isDimensionParam(param, ['height', 'h'])
    const nextIsWidth = nextParam && isDimensionParam(nextParam, ['width', 'w'])
    const nextIsHeight = nextParam && isDimensionParam(nextParam, ['height', 'h'])
    if (nextParam?.name && ((currentIsWidth && nextIsHeight) || (currentIsHeight && nextIsWidth))) {
      const widthParam = (currentIsWidth ? param : nextParam) as DynamicParam & { name: string }
      const heightParam = (currentIsHeight ? param : nextParam) as DynamicParam & { name: string }
      items.push({ kind: 'combo', comboType: 'dimension', widthParam, heightParam, insertIndex: index })
      consumed.add(widthParam.name)
      consumed.add(heightParam.name)
      continue
    }
    items.push({ kind: 'param', param })
    consumed.add(param.name)
  }
  return items
}

export function resolveDimensionPresets(widthParam?: DynamicParam, heightParam?: DynamicParam): DimensionPreset[] {
  const presets = [
    { label: '1:1 1024', width: 1024, height: 1024 },
    { label: '3:4 864x1152', width: 864, height: 1152 },
    { label: '4:3 1152x864', width: 1152, height: 864 },
    { label: '9:16 720x1280', width: 720, height: 1280 },
    { label: '16:9 1280x720', width: 1280, height: 720 },
  ]
  return presets
    .map((preset) => ({
      ...preset,
      width: clampPreset(preset.width, widthParam?.min, widthParam?.max),
      height: clampPreset(preset.height, heightParam?.min, heightParam?.max),
    }))
    .filter((preset) => {
      if (typeof widthParam?.min === 'number' && preset.width < widthParam.min) return false
      if (typeof widthParam?.max === 'number' && preset.width > widthParam.max) return false
      if (typeof heightParam?.min === 'number' && preset.height < heightParam.min) return false
      if (typeof heightParam?.max === 'number' && preset.height > heightParam.max) return false
      return true
    })
}

export function getDimensionSummary(combo: DimensionCombo, formData: Record<string, unknown>): string {
  const width = formData?.[combo.widthParam.name]
  const height = formData?.[combo.heightParam.name]
  if (!width || !height) return combo.widthParam.label || combo.heightParam.label || '尺寸'
  return `${width} x ${height}`
}

export function applyDimensionPreset(
  combo: DimensionCombo,
  formData: Record<string, number>,
  preset: DimensionPreset,
): void {
  formData[combo.widthParam.name] = preset.width
  formData[combo.heightParam.name] = preset.height
}
