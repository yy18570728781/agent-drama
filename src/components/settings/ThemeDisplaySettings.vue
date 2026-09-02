<template>
  <div class="theme-display-settings">
    <div class="display-header">
      <div>
        <h3>个人配置</h3>
        <p>切换主题模式和通用选项，变更会自动保存。</p>
      </div>
      <div class="display-status">
        <div class="status-badge">
          <Sun :size="14" />
          <span>{{ resolvedModeLabel }}</span>
        </div>
      </div>
    </div>

    <section class="settings-card">
      <div class="card-title">
        <Sparkles :size="16" />
        <span>主题</span>
      </div>

      <div class="setting-row">
        <span class="setting-label">模式</span>
        <div class="option-row">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            type="button"
            class="option-chip"
            :class="{ active: mode === option.value }"
            :aria-pressed="mode === option.value"
            @click="setMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="card-title">
        <Settings :size="16" />
        <span>生成设置</span>
      </div>

      <div class="toggle-row">
        <label class="toggle-check">
          <input type="checkbox" :checked="autoCompressOriginalRatio" @change="onToggleAutoCompress" />
          <span class="toggle-label">自动原比例压缩</span>
        </label>
        <div class="threshold-inline">
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            :value="compressThresholdMb"
            @input="onThresholdInput"
            class="threshold-slider"
          />
          <span class="threshold-value">{{ compressThresholdMb }} MB</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ThemeMode } from '@/styles/theme/types/theme'
import { computed } from 'vue'
import { Settings, Sparkles, Sun } from '@/components/common/icon/lucide'
import { useTheme } from '@/styles/theme/composables/useTheme'

const {
  mode,
  resolvedMode,
  autoCompressOriginalRatio,
  compressThresholdMb,
  setMode,
  setAutoCompressOriginalRatio,
  setCompressThresholdMb,
} = useTheme()

const modeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
]

const resolvedModeLabelMap = {
  light: '当前为浅色模式',
  dark: '当前为深色模式',
} as const

const resolvedModeLabel = computed(() => resolvedModeLabelMap[resolvedMode.value])

function onToggleAutoCompress(event: Event) {
  setAutoCompressOriginalRatio((event.target as HTMLInputElement).checked)
}

function onThresholdInput(event: Event) {
  setCompressThresholdMb(Number((event.target as HTMLInputElement).value))
}
</script>

<style scoped>
@import './ThemeDisplaySettings.css';
</style>
