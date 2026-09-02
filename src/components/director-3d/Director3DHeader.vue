<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { DirectingProject } from '@/components/director-3d/director3D.types';

defineProps<{
  project: DirectingProject;
  showShortcuts: boolean;
  customEditorCamera: boolean;
}>();

const emit = defineEmits<{
  (e: 'changeViewMode', mode: '3D' | '2D'): void;
  (e: 'openCameraMonitor'): void;
  (e: 'saveProject'): void;
  (e: 'resetProject'): void;
  (e: 'toggleShortcuts'): void;
}>();
</script>

<template>
  <header class="h-14 bg-[#090b0e] border-b border-white/5 flex items-center justify-between px-3 sm:px-5 shrink-0 z-40 shadow-md overflow-hidden">
    <!-- Platform Title area -->
    <div class="flex items-center gap-2 sm:gap-3 shrink-0">
      <div class="h-8 w-8 rounded bg-gradient-to-tr from-[#2563eb] to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-lg">
        <Icon icon="lucide:film" :width="15" />
      </div>
      <div class="hidden md:block">
        <h1 class="text-sm font-semibold tracking-wider text-white">3D 导演台</h1>
      </div>
    </div>

    <!-- View Mode Toggles in Top Center -->
    <div class="flex items-center bg-black/40 p-1 rounded-lg border border-white/10 shadow-inner">
      <div
        role="button"
        tabindex="0"
        @click="emit('changeViewMode', '3D')"
        @keydown.enter.prevent="emit('changeViewMode', '3D')"
        @keydown.space.prevent="emit('changeViewMode', '3D')"
        :class="[
          'px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer',
          project.viewMode === '3D'
            ? 'bg-[#1e293b]/90 border border-white/10 text-[#60a5fa] shadow-md shadow-black/40'
            : 'text-gray-400 hover:text-gray-200'
        ]"
        id="view-mode-3d-button"
      >
        <span class="hidden sm:inline">3D 导演排演空间</span><span class="sm:hidden">3D</span>
      </div>
      <div
        role="button"
        tabindex="0"
        @click="emit('openCameraMonitor')"
        @keydown.enter.prevent="emit('openCameraMonitor')"
        @keydown.space.prevent="emit('openCameraMonitor')"
        :class="[
          'px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer',
          !customEditorCamera
            ? 'bg-[#1e293b]/90 border border-white/10 text-[#c084fc] shadow-md shadow-black/40'
            : 'text-gray-400 hover:text-gray-200'
        ]"
        id="view-mode-2d-button"
      >
        <span class="hidden sm:inline">相机画面监视器</span><span class="sm:hidden">监视器</span>
      </div>
    </div>

    <!-- Action button grouping -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <div
        role="button"
        tabindex="0"
        @click="emit('saveProject')"
        @keydown.enter.prevent="emit('saveProject')"
        @keydown.space.prevent="emit('saveProject')"
        class="flex items-center gap-1.5 text-[11px] font-medium bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-2 sm:px-3 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer transition-colors shadow-sm"
        id="top-save-project"
      >
        <Icon icon="lucide:check" :width="12" />
        <span class="hidden sm:inline">保存工程</span>
      </div>

      <div
        role="button"
        tabindex="0"
        @click="emit('resetProject')"
        @keydown.enter.prevent="emit('resetProject')"
        @keydown.space.prevent="emit('resetProject')"
        class="flex items-center gap-1.5 text-[11px] font-medium bg-red-500/10 hover:bg-red-500/25 text-red-400 px-2 sm:px-3 py-1.5 rounded-lg border border-red-500/20 cursor-pointer transition-colors shadow-sm"
        id="top-reset-project"
      >
        <Icon icon="lucide:rotate-ccw" :width="12" />
        <span class="hidden sm:inline">复位画布</span>
      </div>

      <div
        role="button"
        tabindex="0"
        @click="emit('toggleShortcuts')"
        @keydown.enter.prevent="emit('toggleShortcuts')"
        @keydown.space.prevent="emit('toggleShortcuts')"
        :class="[
          'p-1.5 rounded-lg border cursor-pointer transition-colors',
          showShortcuts
            ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
            : 'bg-white/5 hover:bg-white/10 border-white/5 text-gray-400 hover:text-white'
        ]"
        title="快捷键信息"
        id="top-hint-info"
      >
        <Icon icon="lucide:help-circle" :width="14" />
      </div>
    </div>
  </header>
</template>
