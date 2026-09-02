<script setup lang="ts">
import type { CameraConfig } from '@/components/director-3d/director3D.types';

const props = defineProps<{
  camera: CameraConfig;
}>();

const emit = defineEmits<{
  (e: 'updateCamera', id: string, patch: Partial<CameraConfig>): void;
  (e: 'commitHistory'): void;
}>();

type ToneMappingOption = CameraConfig['toneMapping'];
const TONE_OPTIONS: { value: ToneMappingOption; label: string }[] = [
  { value: 'ACESFilmic', label: 'ACES 电影级' },
  { value: 'Linear', label: '线性无压缩' },
  { value: 'Reinhard', label: 'Reinhard 柔和' },
  { value: 'Cineon', label: 'Cineon 胶片' },
  { value: 'AgX', label: 'AgX 高动态' },
];

function patch(patch: Partial<CameraConfig>) {
  emit('commitHistory');
  emit('updateCamera', props.camera.id, patch);
}

function handleFocalLengthChange(val: number) {
  const fov = 2 * Math.atan(12 / val) * (180 / Math.PI);
  emit('commitHistory');
  emit('updateCamera', props.camera.id, { focalLength: val, fov: parseFloat(fov.toFixed(1)) });
}

function handleFovChange(val: number) {
  const fl = 12 / Math.tan((val / 2) * (Math.PI / 180));
  emit('commitHistory');
  emit('updateCamera', props.camera.id, { fov: val, focalLength: parseFloat(fl.toFixed(1)) });
}

function handleNumChange(key: keyof CameraConfig, val: string) {
  const n = parseFloat(val);
  if (!isNaN(n)) patch({ [key]: n });
}
</script>

<template>
  <div class="space-y-4 bg-[#14171d]/90 p-4 rounded-xl border border-white/5 shadow-xl text-gray-200">
    <h5 class="text-xs font-bold tracking-wider text-[#3b82f6] uppercase flex items-center gap-1.5">
      <span>专业镜头参数</span>
    </h5>

    <!-- 区块1：镜头基础 -->
    <div class="bg-black/20 p-3 rounded border border-white/5 space-y-3">
      <div class="text-[10px] font-medium text-gray-400 pb-1.5 border-b border-white/5">镜头基础</div>

      <div class="space-y-1">
        <label class="text-[10px] text-gray-400 block">镜头类型</label>
        <select
          :value="camera.cameraType || 'perspective'"
          @change="patch({ cameraType: ($event.target as HTMLSelectElement).value as any })"
          class="w-full text-xs bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="perspective">透视镜头 (Perspective)</option>
          <option value="orthographic">正交镜头 (Orthographic)</option>
        </select>
      </div>

      <div v-if="camera.cameraType !== 'orthographic'" class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>焦距 (mm)</span>
          <input type="number" step="any" :value="Number((camera.focalLength ?? 50).toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) handleFocalLengthChange(v); }"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="14" max="300" step="1" :value="camera.focalLength ?? 50"
          @input="handleFocalLengthChange(parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>

      <div v-if="camera.cameraType !== 'orthographic'" class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>视场角 FOV (°)</span>
          <input type="number" step="any" :value="Number(camera.fov.toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) handleFovChange(v); }"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="5" max="120" step="0.5" :value="camera.fov"
          @input="handleFovChange(parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>

      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>近裁剪面</span>
          <input type="number" step="any" :value="Number(camera.near.toFixed(2))"
            @change="($event) => handleNumChange('near', ($event.target as HTMLInputElement).value)"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="0.01" max="100" step="0.1" :value="camera.near"
          @input="patch({ near: parseFloat(($event.target as HTMLInputElement).value) })"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>

      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>远裁剪面</span>
          <input type="number" step="any" :value="Number(camera.far.toFixed(0))"
            @change="($event) => handleNumChange('far', ($event.target as HTMLInputElement).value)"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="100" max="50000" step="100" :value="camera.far"
          @input="patch({ far: parseFloat(($event.target as HTMLInputElement).value) })"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>
    </div>

    <!-- 区块2：正交参数（仅 orthographic 显示） -->
    <div v-if="camera.cameraType === 'orthographic'" class="bg-black/20 p-3 rounded border border-white/5 space-y-3">
      <div class="text-[10px] font-medium text-gray-400 pb-1.5 border-b border-white/5">正交参数</div>
      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>正交视野范围</span>
          <input type="number" step="any" :value="Number((camera.orthoSize ?? 5).toFixed(1))"
            @change="($event) => handleNumChange('orthoSize', ($event.target as HTMLInputElement).value)"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="0.5" max="50" step="0.5" :value="camera.orthoSize ?? 5"
          @input="patch({ orthoSize: parseFloat(($event.target as HTMLInputElement).value) })"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>
    </div>

    <!-- 区块3：画面效果 -->
    <div class="bg-black/20 p-3 rounded border border-white/5 space-y-3">
      <div class="text-[10px] font-medium text-gray-400 pb-1.5 border-b border-white/5">画面效果</div>

      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-400">
          <span>曝光</span>
          <input type="number" step="any" :value="Number((camera.exposure ?? 1.0).toFixed(2))"
            @change="($event) => handleNumChange('exposure', ($event.target as HTMLInputElement).value)"
            class="w-12 font-mono text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0 text-gray-300" />
        </div>
        <input type="range" min="0" max="5" step="0.05" :value="camera.exposure ?? 1.0"
          @input="patch({ exposure: parseFloat(($event.target as HTMLInputElement).value) })"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer" />
      </div>

      <div class="space-y-1">
        <label class="text-[10px] text-gray-400 block">色调映射</label>
        <select
          :value="camera.toneMapping || 'ACESFilmic'"
          @change="patch({ toneMapping: ($event.target as HTMLSelectElement).value as any })"
          class="w-full text-xs bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option v-for="opt in TONE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
    </div>
  </div>
</template>
