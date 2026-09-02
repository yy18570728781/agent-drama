import { PRESET_TEMPLATES, CONTROL_TEMPLATES, genParamId, CUSTOM_PARAM_PREFIX } from '@/components/model-param-designer/modelParamDesigner.constants'
import type { PresetTemplate, ControlTemplate, DesignerParam } from '@/components/model-param-designer/modelParamDesigner.types'

export interface UsePresetTemplatesReturn {
  /** 预置参数模板列表 */
  presetTemplates: PresetTemplate[]
  /** 自定义控件模板列表 */
  controlTemplates: ControlTemplate[]
  /** 根据 key 查找预置模板 */
  findPreset: (key: string) => PresetTemplate | undefined
  /** 根据 key 查找控件模板 */
  findControl: (key: string) => ControlTemplate | undefined
  /** 根据参数名匹配预置模板（用于回显时判定 builtin） */
  findPresetByName: (paramName: string) => PresetTemplate | undefined
  /** 生成自定义参数的自动命名 */
  generateAutoName: (existing: string[]) => string
  /** 由预置模板创建 DesignerParam */
  createPresetParam: (template: PresetTemplate) => DesignerParam
  /** 由控件模板创建 DesignerParam */
  createControlParam: (template: ControlTemplate, existingNames: string[]) => DesignerParam
  /** 创建空分组节点 */
  createGroupParam: () => DesignerParam
}

/**
 * 预置参数与自定义控件的工厂方法集合。
 * 负责把模板定义转换为设计器内部 DesignerParam 节点。
 */
export function usePresetTemplates(): UsePresetTemplatesReturn {
  const presetTemplates = PRESET_TEMPLATES
  const controlTemplates = CONTROL_TEMPLATES

  function findPreset(key: string): PresetTemplate | undefined {
    return presetTemplates.find((t) => t.key === key)
  }

  function findControl(key: string): ControlTemplate | undefined {
    return controlTemplates.find((t) => t.key === key)
  }

  function findPresetByName(paramName: string): PresetTemplate | undefined {
    return presetTemplates.find((t) => t.paramName === paramName)
  }

  function generateAutoName(existing: string[]): string {
    let index = 1
    while (existing.includes(`${CUSTOM_PARAM_PREFIX}${index}`)) index++
    return `${CUSTOM_PARAM_PREFIX}${index}`
  }

  function createPresetParam(template: PresetTemplate): DesignerParam {
    return {
      id: genParamId(),
      schema: template.create(),
      builtin: true,
      isGroup: false,
      children: [],
      expanded: true,
    }
  }

  function createControlParam(template: ControlTemplate, existingNames: string[]): DesignerParam {
    const autoName = template.key === 'group' ? '' : generateAutoName(existingNames)
    return {
      id: genParamId(),
      schema: template.create(autoName),
      builtin: false,
      isGroup: template.key === 'group',
      children: [],
      expanded: true,
    }
  }

  function createGroupParam(): DesignerParam {
    return {
      id: genParamId(),
      schema: { name: '', label: '分组', type: 'text' },
      builtin: false,
      isGroup: true,
      children: [],
      expanded: true,
    }
  }

  return {
    presetTemplates,
    controlTemplates,
    findPreset,
    findControl,
    findPresetByName,
    generateAutoName,
    createPresetParam,
    createControlParam,
    createGroupParam,
  }
}
