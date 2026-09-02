import { defineAsyncComponent, type Component } from 'vue'
import { ClipboardList, Palette } from '@/components/common/icon/lucide'

export interface SettingsTabItem {
  key: string
  label: string
  icon: Component
  component: Component
}

const SETTINGS_TABS: SettingsTabItem[] = [
  {
    key: 'teamones-my-charge-logs',
    label: '消费记录',
    icon: ClipboardList,
    component: defineAsyncComponent(() => import('@/components/settings/TeamonesChargeLogList.vue')),
  },
  {
    key: 'teamones-my-records',
    label: '抽卡记录',
    icon: ClipboardList,
    component: defineAsyncComponent(() => import('@/components/settings/TeamonesRecordList.vue')),
  },
  {
    key: 'display',
    label: '个人配置',
    icon: Palette,
    component: defineAsyncComponent(() => import('@/components/settings/ThemeDisplaySettings.vue')),
  },
]

/**
 * 获取设置页可访问的标签页。
 * @returns 个人设置标签页列表。
 */
export function getSettingsTabs(): SettingsTabItem[] {
  return SETTINGS_TABS
}

/**
 * 按键查找可访问的设置标签页。
 * @param key 标签页键。
 * @returns 匹配的标签页；不存在时返回 undefined。
 */
export function getSettingsTab(key: string): SettingsTabItem | undefined {
  return SETTINGS_TABS.find((tab) => tab.key === key)
}
