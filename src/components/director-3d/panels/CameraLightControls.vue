<script setup lang="ts">
import { computed } from 'vue';
import { CameraConfig, LightConfig } from '@/components/director-3d/director3D.types';

const props = withDefaults(defineProps<{
  cameras: CameraConfig[];
  activeCameraId: string;
  lights: LightConfig[];
  hideCameraSettings?: boolean;
  hideLightSettings?: boolean;
}>(), {
  hideCameraSettings: false,
  hideLightSettings: false
});

const emit = defineEmits<{
  (e: 'changeCameras', updated: CameraConfig[]): void;
  (e: 'changeLights', updated: LightConfig[]): void;
}>();

const activeCamera = computed(() => {
  return props.cameras.find((c) => c.id === props.activeCameraId) || props.cameras[0];
});

function handleFovChange(val: number) {
  if (activeCamera.value.locked) return;
  const updated = props.cameras.map((c) => (c.id === props.activeCameraId ? { ...c, fov: val } : c));
  emit('changeCameras', updated);
}

function handlePositionChange(axis: 'x' | 'y' | 'z', val: number) {
  if (activeCamera.value.locked) return;
  const updated = props.cameras.map((c) =>
    c.id === props.activeCameraId
      ? {
          ...c,
          position: { ...c.position, [axis]: val },
        }
      : c
  );
  emit('changeCameras', updated);
}

function handleTargetChange(axis: 'x' | 'y' | 'z', val: number) {
  if (activeCamera.value.locked) return;
  const updated = props.cameras.map((c) =>
    c.id === props.activeCameraId
      ? {
          ...c,
          target: { ...c.target, [axis]: val },
        }
      : c
  );
  emit('changeCameras', updated);
}

function handleLightIntensity(id: string, val: number) {
  const updated = props.lights.map((l) => (l.id === id ? { ...l, intensity: val } : l));
  emit('changeLights', updated);
}

function handleLightColor(id: string, color: string) {
  const updated = props.lights.map((l) => (l.id === id ? { ...l, color } : l));
  emit('changeLights', updated);
}
</script>

<template>
  <div class="space-y-4 bg-[#14171d]/90 p-4 rounded-xl border border-white/5 shadow-xl text-gray-200 animate-fade-in" id="cam-light-controls-root">
    <!-- 1. Active Camera Parameters -->
    <div v-if="!hideCameraSettings && activeCamera" class="space-y-3">
      <h5 class="text-xs text-gray-400 font-bold flex justify-between">
        <span>摄影机参数精调</span>
        <span class="text-[#3b82f6] text-[10px]">{{ activeCamera.name }}</span>
      </h5>

      <!-- FOV Lens distance -->
      <div :class="{ 'opacity-40 select-none': activeCamera.locked }">
        <div class="flex justify-between text-[11px] mb-1 text-gray-300">
          <span>焦距视野 (FOV)</span>
          <span class="text-[#3b82f6]">
            {{ activeCamera.fov }}°
            {{ activeCamera.fov <= 30 ? '长焦镜头' : (activeCamera.fov >= 50 ? '广角镜头' : '标准镜头') }}
          </span>
        </div>
        <input
          type="range"
          min="11"
          max="85"
          :value="activeCamera.fov"
          :disabled="activeCamera.locked"
          @input="handleFovChange(parseInt(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          id="camera-fov-slider"
        />
      </div>

      <!-- Camera Height -->
      <div :class="{ 'opacity-40 select-none': activeCamera.locked }">
        <div class="flex justify-between text-[11px] mb-1 text-gray-300">
          <span>镜头高度 (Y)</span>
          <span class="text-gray-305">{{ activeCamera.position.y.toFixed(2) }}米</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="45"
          step="0.1"
          :value="activeCamera.position.y"
          :disabled="activeCamera.locked"
          @input="handlePositionChange('y', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          id="camera-height-slider"
        />
      </div>

      <!-- Camera Distance -->
      <div :class="{ 'opacity-40 select-none': activeCamera.locked }">
        <div class="flex justify-between text-[11px] mb-1 text-gray-300">
          <span>轨道前后距离 (Z)</span>
          <span class="text-gray-305">{{ activeCamera.position.z.toFixed(2) }}米</span>
        </div>
        <input
          type="range"
          min="1"
          max="60"
          step="0.2"
          :value="activeCamera.position.z"
          :disabled="activeCamera.locked"
          @input="handlePositionChange('z', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          id="camera-distance-slider"
        />
      </div>

      <!-- Horizontal translation tracking -->
      <div :class="{ 'opacity-40 select-none': activeCamera.locked }">
        <div class="flex justify-between text-[11px] mb-1 text-gray-300">
          <span>机位轨道横移 (X)</span>
          <span class="text-gray-305">{{ activeCamera.position.x.toFixed(2) }}米</span>
        </div>
        <input
          type="range"
          min="-30"
          max="30"
          step="0.2"
          :value="activeCamera.position.x"
          :disabled="activeCamera.locked"
          @input="handlePositionChange('x', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          id="camera-dolly-slider"
        />
      </div>

      <!-- Focus Target Height tracking -->
      <div :class="{ 'opacity-40 select-none': activeCamera.locked }">
        <div class="flex justify-between text-[11px] mb-1 text-gray-300">
          <span>焦点朝向高度</span>
          <span class="text-gray-305">{{ activeCamera.target.y.toFixed(2) }}米</span>
        </div>
        <input
          type="range"
          min="0.0"
          max="4.0"
          step="0.05"
          :value="activeCamera.target.y"
          :disabled="activeCamera.locked"
          @input="handleTargetChange('y', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer disabled:cursor-not-allowed"
          id="camera-focus-height-slider"
        />
      </div>
    </div>

    <!-- 2. Lights Control Panel -->
    <div v-if="!hideLightSettings" class="border-t border-white/5 pt-4">
      <h4 class="text-xs font-bold tracking-wider text-[#3b82f6] uppercase mb-3">
        场景布光微调
      </h4>
      
      <div class="space-y-4">
        <div v-for="light in lights" :key="light.id" class="bg-black/20 p-2.5 rounded border border-white/5 space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-202">{{ light.name }}</span>
            <input
              type="color"
              :value="light.color"
              @input="handleLightColor(light.id, ($event.target as HTMLInputElement).value)"
              class="w-6 h-5 border-0 bg-transparent cursor-pointer rounded-sm"
              :id="'color-picker-' + light.id"
            />
          </div>
          <div class="flex gap-2 items-center">
            <span class="text-[10px] text-gray-400 w-14">光强占比</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              :value="light.intensity"
              @input="handleLightIntensity(light.id, parseFloat(($event.target as HTMLInputElement).value))"
              class="flex-grow accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
              :id="'intensity-slider-' + light.id"
            />
            <span class="text-[10px] text-gray-300 w-6 text-right">{{ (light.intensity * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
