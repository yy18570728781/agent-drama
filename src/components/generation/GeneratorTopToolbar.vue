<template>
  <div
    class="generator-top-toolbar flex items-center justify-between gap-3"
    :class="{ 'is-integrated': integrated }"
  >
    <div v-if="showScreenshot" class="generator-top-toolbar__capture flex items-center">
      <button
        class="toolbar-select-btn toolbar-select-btn--compact !rounded-r-none !border-r-0"
        type="button"
        :disabled="screenshotCapturing"
        @click="$emit('request-preferred-screenshot')"
      >
        <Camera :size="14" />
        <span class="btn-label">截图</span>
      </button>
      <el-popover
        :visible="screenshotMenuVisible"
        placement="bottom-end"
        :width="150"
        popper-class="generator-screenshot-popover"
        role="dialog"
        trigger="click"
        @update:visible="(value: boolean) => $emit('update:screenshot-menu-visible', value)"
      >
        <template #reference>
          <button
            class="toolbar-select-btn toolbar-select-btn--compact !rounded-l-none !px-2"
            type="button"
            aria-label="截图方式"
            :disabled="screenshotCapturing"
          >
            <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
          </button>
        </template>
        <div class="capability-menu">
          <button
            class="capability-menu-item"
            type="button"
            :disabled="screenshotCapturing"
            @click="$emit('request-screenshot-mode', 'keep-window')"
          >
            保留客户端窗口截图
          </button>
          <button
            class="capability-menu-item"
            type="button"
            :disabled="screenshotCapturing"
            @click="$emit('request-screenshot-mode', 'hide-window')"
          >
            隐藏客户端窗口截图
          </button>
        </div>
      </el-popover>
    </div>

    <div class="generator-top-toolbar__actions flex items-center gap-2">
      <slot name="prepend-control" />
      <button
        v-if="showTextExpand"
        class="generator-panel-control-btn generator-panel-control-icon"
        type="button"
        :title="isTextExpanded ? '收起输入框' : '展开输入框'"
        :aria-label="isTextExpanded ? '收起输入框' : '展开输入框'"
        :aria-pressed="isTextExpanded"
        @click="$emit('toggle-text-expanded')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
      </button>
      <button
        v-if="showSyncUpstream"
        class="generator-panel-control-btn generator-panel-control-icon"
        type="button"
        title="反推上游"
        aria-label="反推上游"
        @click="$emit('sync-upstream')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
      </button>
      <button
        v-if="showCollapsePanel"
        class="generator-panel-control-btn generator-panel-control-icon"
        type="button"
        title="收缩整体"
        aria-label="收缩整体"
        @click="$emit('collapse-panel')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button
        v-if="showClose"
        class="generator-panel-control-btn generator-panel-control-icon text-[16px] leading-none"
        type="button"
        title="关闭"
        aria-label="关闭"
        @click="$emit('close-panel')"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Camera, ChevronDown } from '@/components/common/icon/lucide'

type ScreenshotMode = 'hide-window' | 'keep-window'

defineProps<{
  integrated?: boolean
  isTextExpanded: boolean
  screenshotCapturing: boolean
  screenshotMenuVisible: boolean
  showScreenshot: boolean
  showTextExpand: boolean
  showSyncUpstream: boolean
  showCollapsePanel: boolean
  showClose: boolean
}>()

defineEmits<{
  (e: 'request-preferred-screenshot'): void
  (e: 'request-screenshot-mode', mode: ScreenshotMode): void
  (e: 'update:screenshot-menu-visible', value: boolean): void
  (e: 'toggle-text-expanded'): void
  (e: 'sync-upstream'): void
  (e: 'collapse-panel'): void
  (e: 'close-panel'): void
}>()
</script>

<style scoped src="./GeneratorTopToolbar.css"></style>
