import type { ModelParamSchema, SelectOption } from '@/api/models'

/**
 * 设计器内部使用的参数节点。
 * 在 ModelParamSchema 基础上附加运行态字段，保存时剥离并按 name 序列化回扁平结构。
 */
export interface DesignerParam {
  /** 运行态唯一标识，非持久化字段 */
  id: string
  /** 参数 schema（name/label/type/options/default 等） */
  schema: ModelParamSchema
  /** 是否为预置参数（size/resolution/prompt/aspect_ratio/file_urls），name 不可改 */
  builtin: boolean
  /** 是否为折叠分组容器；为 true 时 children 生效，schema 仅作展示 */
  isGroup: boolean
  /** 分组容器下的子参数（仅 isGroup 为 true 时有意义） */
  children: DesignerParam[]
  /** 分组是否展开（仅 isGroup 时生效） */
  expanded: boolean
  /** 分组类型：plain=普通分组, capability=能力组, mode=模式组 */
  groupType?: 'plain' | 'capability' | 'mode'
  /** 能力组对应的模式来源（仅 groupType==='capability' 时有意义），格式 { modeId: true } */
  modeChildIds?: Record<string, string>
}

/** 预置参数模板描述（左栏"预置参数"组的每一项） */
export interface PresetTemplate {
  /** 模板标识，用于去重与匹配 */
  key: string
  /** 展示名称 */
  label: string
  /** 图标名（lucide export 名） */
  icon: string
  /** 固定参数名 */
  paramName: string
  /** 所属能力 ID（仅动态预置有值） */
  capabilityId?: string
  /** 所属模式名称（仅动态预置有值，如 "text2image"） */
  modeId?: string
  /** 工厂函数：生成完整 ModelParamSchema */
  create: () => ModelParamSchema
}

/** 自定义控件模板描述（左栏"自定义控件"组的每一项） */
export interface ControlTemplate {
  /** 模板标识 */
  key: string
  /** 展示名称 */
  label: string
  /** 图标名（lucide export 名） */
  icon: string
  /** 工厂函数：生成一个初始 ModelParamSchema（name 自动生成） */
  create: (autoName: string) => ModelParamSchema
}

/** 序列化结果：扁平的以参数名为 key 的 schema map */
export type SerializedParams = Record<string, ModelParamSchema>

export type { SelectOption }
