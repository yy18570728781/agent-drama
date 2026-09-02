<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { DirectingProject } from '@/components/director-3d/director3D.types';

const props = defineProps<{
  project: DirectingProject;
}>();

const emit = defineEmits<{
  (e: 'updateProject', proj: DirectingProject): void;
}>();

const showGrid = computed(() => props.project.showGrid !== false);
const groundVisible = computed(() => props.project.groundVisible !== false);

function onToggleGround(visible: boolean) {
  emit('updateProject', { ...props.project, groundVisible: visible });
}

function onToggleGrid(visible: boolean) {
  emit('updateProject', { ...props.project, showGrid: visible });
}

function onResetGround() {
  emit('updateProject', {
    ...props.project,
    showGrid: true,
    groundVisible: true,
    ground: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }
  });
}
</script>

<template>
  <div class="space-y-4 text-left animate-fade-in" id="ground-controls-container">
    <div class="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1.5">
      <h4 class="text-xs font-sans font-bold text-[#3b82f6] uppercase flex items-center gap-1">
        <Icon icon="lucide:grid" :width="13" />
        <span>场景地面对齐系统</span>
      </h4>
      <p class="text-[10px] text-gray-400 leading-relaxed font-sans">
        你可以对 3D 舞台地面进行整体<b>平移、旋转、缩放</b>，可在 3D 视口中使用 Transform 控制轴对地面做交互操作。
      </p>
    </div>

    <div class="space-y-2">
      <div
        role="button" tabindex="0"
        @click="onToggleGround(!groundVisible)"
        @keydown.enter.prevent="onToggleGround(!groundVisible)"
        @keydown.space.prevent="onToggleGround(!groundVisible)"
        :class="[
          'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-sans text-xs transition-colors cursor-pointer border w-full',
          groundVisible ? 'bg-[#3b82f6]/10 text-white border-[#3b82f6]/30' : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/10'
        ]"
      >
        <Icon icon="lucide:square" :width="13" />
        <span>{{ groundVisible ? '地面物体已显示' : '地面物体已隐藏' }}</span>
      </div>

      <div
        role="button" tabindex="0"
        @click="onToggleGrid(!showGrid)"
        @keydown.enter.prevent="onToggleGrid(!showGrid)"
        @keydown.space.prevent="onToggleGrid(!showGrid)"
        :class="[
          'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-sans text-xs transition-colors cursor-pointer border w-full',
          showGrid ? 'bg-[#3b82f6]/10 text-white border-[#3b82f6]/30' : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/10'
        ]"
      >
        <Icon icon="lucide:grid" :width="13" />
        <span>{{ showGrid ? '网格已显示' : '网格已隐藏' }}</span>
      </div>
    </div>

    <div
      role="button" tabindex="0"
      @click="onResetGround"
      @keydown.enter.prevent="onResetGround"
      @keydown.space.prevent="onResetGround"
      class="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/10 transition-colors flex items-center justify-center gap-1 text-xs font-mono cursor-pointer"
    >
      <Icon icon="lucide:eye-off" :width="13" />
      <span>重置地面</span>
    </div>
  </div>
</template>
