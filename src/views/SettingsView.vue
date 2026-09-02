<template>
  <div class="settings-view">
    <div class="settings-container">
      <!-- 左侧边栏 -->
      <div class="settings-sidebar">
        <!-- 用户信息卡片 -->
        <div
          class="user-card"
          :class="{ active: activeTab === 'user' }"
          @click="activeTab = 'user'"
        >
          <div class="user-avatar">
            <img v-if="userAvatar" :src="userAvatar" alt="avatar" />
            <span v-else class="avatar-text">{{ sidebarAvatarText }}</span>
          </div>
          <div class="user-info">
            <div class="user-name">{{ sidebarUserLabel }}</div>
            <div class="user-company">{{ sidebarStatusText }}</div>
          </div>
        </div>

        <div class="sidebar-divider"></div>

        <!-- 设置菜单 -->
        <div class="sidebar-menu">
          <div v-if="personalMenuItems.length" class="menu-section menu-section-flat">
            <button
              v-for="item in personalMenuItems"
              :key="item.key"
              class="menu-item"
              :class="{ active: activeTab === item.key }"
              @click="activeTab = item.key"
            >
              <component :is="item.icon" :size="16" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧内容区 -->
      <div class="settings-main">
        <!-- 用户信息 -->
        <div v-if="activeTab === 'user'" class="content-panel">
          <UserInfoTab />
        </div>

        <!-- 注册表驱动的设置页 -->
        <component
          v-else-if="currentTabItem"
          :is="currentTabItem.component"
          :key="activeTab"
          class="content-panel"
        />

        <!-- 默认 -->
        <div v-else class="content-panel">
          <p class="panel-hint">请从左侧菜单选择配置项</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'SettingsView' })

import { computed, ref, onMounted, onActivated } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import UserInfoTab from '@/components/settings/UserInfoTab.vue'
import { getSettingsTabs, getSettingsTab } from '@/components/settings/settingsTabs'
import { useUserStore } from '@/stores/auth.store'

const route = useRoute()
const userStore = useUserStore()
const { sidebarAvatarText, sidebarStatusText, sidebarUserLabel, userAvatar } = storeToRefs(userStore)

const activeTab = ref('user')
const personalMenuItems = computed(() => getSettingsTabs())
const currentTabItem = computed(() => getSettingsTab(activeTab.value))

onMounted(() => {
  const tab = route.query.tab as string
  if (tab) {
    activeTab.value = tab || 'user'
  }
})

onActivated(() => {
  const tab = route.query.tab as string
  if (tab) {
    activeTab.value = tab || 'user'
  }
})
</script>

<style scoped>
@import './SettingsView.css';
</style>
