<script setup lang="ts">
import { DirectingProject } from '@/components/director-3d/director3D.types';

defineProps<{
  project: DirectingProject;
  customEditorCamera: boolean;
  viewportSlots: Record<string, { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }>;
  hudToast: { message: string; type: 'success' | 'info' | 'error' } | null;
}>();

const emit = defineEmits<{
  (e: 'saveViewport', slotKey: string): void;
  (e: 'loadViewport', slotKey: string): void;
  (e: 'exitCameraView'): void;
}>();
</script>

<template>
  <!-- Elegantly Floating HUD Toast for Viewport changes -->
  <div v-if="hudToast" class="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300">
    <div :class="[
      'px-4 py-2.5 rounded-xl border text-xs font-mono shadow-2xl backdrop-blur-md flex items-center gap-2',
      hudToast.type === 'success' ? 'bg-[#0f2e2a]/95 text-teal-300 border-teal-500/20' :
      hudToast.type === 'error' ? 'bg-[#3d0f0f]/95 text-red-300 border-red-500/20' :
      'bg-[#191d24]/95 text-zinc-300 border-zinc-700/20'
    ]">
      <span :class="[
        'w-1.5 h-1.5 rounded-full bg-current',
        hudToast.type === 'success' ? 'animate-pulse' : ''
      ]" />
      <span>{{ hudToast.message }}</span>
    </div>
  </div>

  <!-- Cinematic Viewfinder overlay layer in Nuke modes -->
  <div v-if="!customEditorCamera" class="absolute inset-0 border border-white/5 pointer-events-none flex flex-col justify-between p-4 mix-blend-screen z-20">
    <div class="flex justify-between items-start mt-14 w-full">
      <div class="text-xs text-gray-300 bg-black/70 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm shadow-lg flex items-center gap-2 whitespace-nowrap">
        <span class="font-medium text-white">{{ project.cameras.find(c => c.id === project.activeCameraId)?.name || '默认摄影机' }}</span>
        <span class="text-gray-500">·</span>
        <span class="font-mono text-gray-400">{{ project.aspectRatio === 'auto' || !project.aspectRatio ? 'Auto' : project.aspectRatio }}</span>
        <span class="text-gray-500">·</span>
        <span class="font-mono text-gray-400">{{ Math.round(project.cameras.find(c => c.id === project.activeCameraId)?.fov || 50) }}mm</span>
      </div>

      <div
        role="button"
        tabindex="0"
        @click="emit('exitCameraView')"
        @keydown.enter.prevent="emit('exitCameraView')"
        @keydown.space.prevent="emit('exitCameraView')"
        class="viewfinder-exit-button pointer-events-auto flex items-center gap-2 px-3 py-2 border border-red-500/40 hover:border-red-400/60 text-red-200 hover:text-white rounded-lg text-[11px] font-sans font-medium backdrop-blur-md transition-colors cursor-pointer animate-fadeIn animate-duration-300"
        title="退出当前选定摄影机画面，返回自由操控的3D上帝视角"
      >
        <span>退出机位</span>
      </div>
    </div>
    
    <div class="self-center flex justify-center items-center w-full max-w-sm pointer-events-none">
      <div class="w-6 h-6 border-t border-l border-white/25"></div>
      <div class="flex-grow border-t border-dashed border-white/5 h-px"></div>
      <div class="w-2 h-2 rounded-full bg-white/15"></div>
      <div class="flex-grow border-t border-dashed border-white/5 h-px"></div>
      <div class="w-6 h-6 border-b border-r border-white/25"></div>
    </div>
    
    <div class="self-between text-right text-xs text-gray-400 bg-black/60 p-1.5 rounded self-end border border-white/5">
      画面合成图层总数: {{ project.imagePlanes.filter(p => p.visible).length + project.mannequins.length }}
    </div>
  </div>
</template>
