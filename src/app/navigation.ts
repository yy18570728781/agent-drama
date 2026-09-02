export interface NavItem {
  page: string
  to: string
  label: string
  iconClass?: string
}

export const primaryNavItems: NavItem[] = [
  {
    page: 'discover',
    to: '/discover',
    label: '发现',
    iconClass: 'custom-icon-zhinanzhen',
  },
  {
    page: 'card',
    to: '/card',
    label: '生成',
    iconClass: 'custom-icon-shengcheng1',
  },
  {
    page: 'flow',
    to: '/flow',
    label: '画布',
    iconClass: 'custom-icon-huabu',
  },
  {
    page: 'subjects',
    to: '/subjects',
    label: '资产库',
    iconClass: 'custom-icon-zhuti',
  },
]

export const accountNavItems: NavItem[] = [
  {
    page: 'logs',
    to: '/logs',
    label: '日志',
  },
  {
    page: 'settings',
    to: '/settings',
    label: '设置',
  },
]
