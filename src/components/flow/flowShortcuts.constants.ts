export interface ShortcutKeyConfig {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  key: string
}

export interface ShortcutDefinition {
  id: string
  label: string
  key: ShortcutKeyConfig
  action: string
  category: string
  readonly?: boolean
}

export const SHORTCUT_SECTION_DEFS = [
  { id: 'workflow', label: '工作流与历史' },
  { id: 'basicEdit', label: '基础编辑' },
  { id: 'node', label: '节点与分组' },
  { id: 'layout', label: '布局与对齐' },
  { id: 'marking', label: '标记与外观' },
  { id: 'view', label: '视图与导航' },
] as const

export const DEFAULT_SHORTCUTS: Record<string, ShortcutDefinition> = {
  save: { id: 'save', label: '保存工作流', key: { ctrl: true, key: 's' }, action: 'save', category: 'workflow' },
  undo: { id: 'undo', label: '撤销', key: { ctrl: true, key: 'z' }, action: 'undo', category: 'workflow' },
  redo: { id: 'redo', label: '重做', key: { ctrl: true, key: 'y' }, action: 'redo', category: 'workflow' },
  selectAll: { id: 'selectAll', label: '选中全部节点', key: { ctrl: true, key: 'a' }, action: 'selectAll', category: 'basicEdit' },
  copy: { id: 'copy', label: '复制', key: { ctrl: true, key: 'c' }, action: 'copy', category: 'basicEdit' },
  cut: { id: 'cut', label: '剪切', key: { ctrl: true, key: 'x' }, action: 'cut', category: 'basicEdit' },
  paste: { id: 'paste', label: '粘贴', key: { ctrl: true, key: 'v' }, action: 'paste', category: 'basicEdit' },
  delete: { id: 'delete', label: '删除', key: { key: 'Delete' }, action: 'delete', category: 'basicEdit' },
  cutEdge: { id: 'cutEdge', label: '按住拖拽断线', key: { key: 'x' }, action: 'cutEdge', category: 'node', readonly: true },
  group: { id: 'group', label: '将选中节点打组', key: { ctrl: true, key: 'g' }, action: 'group', category: 'node' },
  ungroup: { id: 'ungroup', label: '取消打组', key: { ctrl: true, shift: true, key: 'g' }, action: 'ungroup', category: 'node' },
  annotationNote: { id: 'annotationNote', label: '文字标注', key: { key: 't' }, action: 'annotationNote', category: 'node' },
  locationMarker: { id: 'locationMarker', label: '位置标记', key: { ctrl: true, key: 'm' }, action: 'locationMarker', category: 'node' },
  arrange: { id: 'arrange', label: '整理对齐', key: { ctrl: true, key: 'p' }, action: 'arrange', category: 'layout' },
  autoLayout: { id: 'autoLayout', label: '自动布局', key: { ctrl: true, shift: true, key: 'p' }, action: 'autoLayout', category: 'layout' },
  distributeH: { id: 'distributeH', label: '水平等间距', key: { shift: true, key: 'h' }, action: 'distributeH', category: 'layout' },
  distributeV: { id: 'distributeV', label: '垂直等间距', key: { shift: true, key: 'v' }, action: 'distributeV', category: 'layout' },
  alignTop: { id: 'alignTop', label: '顶对齐', key: { shift: true, key: 'w' }, action: 'alignTop', category: 'layout' },
  alignLeft: { id: 'alignLeft', label: '左对齐', key: { shift: true, key: 'a' }, action: 'alignLeft', category: 'layout' },
  alignBottom: { id: 'alignBottom', label: '底对齐', key: { shift: true, key: 's' }, action: 'alignBottom', category: 'layout' },
  alignRight: { id: 'alignRight', label: '右对齐', key: { shift: true, key: 'd' }, action: 'alignRight', category: 'layout' },
  highlightColor1: { id: 'highlightColor1', label: '颜色标记：玫红', key: { ctrl: true, key: '1' }, action: 'highlightColor1', category: 'marking' },
  highlightColor2: { id: 'highlightColor2', label: '颜色标记：靛蓝', key: { ctrl: true, key: '2' }, action: 'highlightColor2', category: 'marking' },
  highlightColor3: { id: 'highlightColor3', label: '颜色标记：翠绿', key: { ctrl: true, key: '3' }, action: 'highlightColor3', category: 'marking' },
  highlightColor4: { id: 'highlightColor4', label: '颜色标记：琥珀', key: { ctrl: true, key: '4' }, action: 'highlightColor4', category: 'marking' },
  fitView: { id: 'fitView', label: '适应屏幕', key: { ctrl: true, key: '0' }, action: 'fitView', category: 'view' },
  toggleGrid: { id: 'toggleGrid', label: '切换网格', key: { ctrl: true, key: ';' }, action: 'toggleGrid', category: 'view' },
  toggleMinimap: { id: 'toggleMinimap', label: '切换小地图', key: { ctrl: true, alt: true, key: 'm' }, action: 'toggleMinimap', category: 'view' },
  focusSelected: { id: 'focusSelected', label: '聚焦选中节点', key: { key: 'f' }, action: 'focusSelected', category: 'view' },
  panCanvas: { id: 'panCanvas', label: '按住拖动画布', key: { key: 'Space' }, action: 'panCanvas', category: 'view', readonly: true },
  locationMarkerNavigator: { id: 'locationMarkerNavigator', label: '位置标记导航', key: { ctrl: true, shift: true, key: 'm' }, action: 'locationMarkerNavigator', category: 'view' },
}
