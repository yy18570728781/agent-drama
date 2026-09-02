<script setup lang="ts">
import { ImagePlaneObject, BlendMode } from '@/components/director-3d/director3D.types';

const props = defineProps<{
  image: ImagePlaneObject;
}>();

const emit = defineEmits<{
  (e: 'changeImage', updatedImage: ImagePlaneObject): void;
  (e: 'deleteImage'): void;
}>();

function updateProp(key: keyof ImagePlaneObject, value: any) {
  emit('changeImage', {
    ...props.image,
    [key]: value,
  });
}

function updateVector(key: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z', val: number) {
  emit('changeImage', {
    ...props.image,
    [key]: {
      ...props.image[key],
      [axis]: val,
    },
  });
}
</script>

<template>
  <div class="space-y-4 bg-[#14171d]/90 p-4 rounded-xl border border-white/5 shadow-xl text-gray-200 animate-fade-in" id="image-controls-root">
    <!-- 3D/360 切换 -->
    <div>
      <div class="flex items-center justify-between bg-[#3b82f6]/5 p-2 rounded border border-[#3b82f6]/10">
        <div class="flex flex-col text-left">
          <span class="text-[10px] font-bold text-[#3b82f6]">切换360°全景图</span>
        </div>
        <div
          role="button"
          tabindex="0"
          @click="updateProp('renderMode', image.renderMode === '360-Panoramic' ? '3D' : '360-Panoramic')"
          @keydown.enter.prevent="updateProp('renderMode', image.renderMode === '360-Panoramic' ? '3D' : '360-Panoramic')"
          @keydown.space.prevent="updateProp('renderMode', image.renderMode === '360-Panoramic' ? '3D' : '360-Panoramic')"
          :class="[
            'px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer',
            image.renderMode === '360-Panoramic'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-black/40 text-gray-400 hover:text-white border border-white/10'
          ]"
          id="toggle-360-skybox"
        >
          {{ image.renderMode === '360-Panoramic' ? '球体' : '平面' }}
        </div>
      </div>
    </div>

    <!-- 混合模式与透明度 -->
    <div class="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
      <div>
        <label class="block text-[11px] text-gray-400 mb-1">色彩混合叠照模式</label>
        <select
          :value="image.blendMode"
          @change="updateProp('blendMode', ($event.target as HTMLSelectElement).value as BlendMode)"
          class="w-full text-xs bg-black/40 border border-white/10 rounded px-2 py-1.5 text-white focus:outline-none cursor-pointer"
          id="image-blend-mode"
        >
          <option value="normal">正常透明度混合</option>
          <option value="screen">发光滤色混合</option>
          <option value="multiply">正片叠底阴影</option>
          <option value="overlay">柔和高光叠加</option>
        </select>
      </div>
      <div>
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>透明度</span>
          <input
            type="number"
            step="any"
            :value="Number(image.opacity.toFixed(2))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v >= 0 && v <= 1) updateProp('opacity', v); }"
            class="w-10 text-[10px] font-mono text-[#3b82f6] font-bold text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="image.opacity"
          @input="updateProp('opacity', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer mt-2"
          id="image-opacity-slider"
        />
      </div>
    </div>

    <!-- 平移拉伸尺寸调整 -->
    <div class="border-t border-white/5 pt-3 space-y-3">
      <h4 class="text-[11px] font-bold text-[#3b82f6] uppercase">位移坐标与尺寸宽度</h4>

      <div>
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>
            {{ image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? '横向 X 轴位移' : '屏幕 X 左右偏移' }}
          </span>
          <input
            type="number"
            step="any"
            :value="Number(image.position.x.toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) updateVector('position', 'x', v); }"
            class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          :min="image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? -15 : -3"
          :max="image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? 15 : 3"
          step="0.1"
          :value="image.position.x"
          @input="updateVector('position', 'x', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          id="image-pos-x-slider"
        />
      </div>

      <div>
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>
            {{ image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? '高度 Y 轴位移' : '屏幕 Y 上下偏移' }}
          </span>
          <input
            type="number"
            step="any"
            :value="Number(image.position.y.toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) updateVector('position', 'y', v); }"
            class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          :min="image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? -2 : -3"
          :max="image.renderMode === '3D' || image.renderMode === '360-Panoramic' ? 10 : 3"
          step="0.1"
          :value="image.position.y"
          @input="updateVector('position', 'y', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          id="image-pos-y-slider"
        />
      </div>

      <div v-if="image.renderMode === '3D' || image.renderMode === '360-Panoramic'">
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>深度 Z 轴位移</span>
          <input
            type="number"
            step="any"
            :value="Number(image.position.z.toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) updateVector('position', 'z', v); }"
            class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          min="-20"
          max="20"
          step="0.1"
          :value="image.position.z"
          @input="updateVector('position', 'z', parseFloat(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          id="image-pos-z-slider"
        />
      </div>

      <!-- 缩放尺寸 -->
      <div v-if="image.renderMode === '360-Panoramic'" class="pt-1">
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>统一缩放</span>
          <input
            type="number"
            step="any"
            :value="Number(image.scale.x.toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) emit('changeImage', { ...image, scale: { x: v, y: v, z: v } }); }"
            class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          min="0.5"
          max="25"
          step="0.2"
          :value="image.scale.x"
          @input="($event) => {
            const val = parseFloat(($event.target as HTMLInputElement).value);
            emit('changeImage', { ...image, scale: { x: val, y: val, z: val } });
          }"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
        />
      </div>
      <div v-else class="grid grid-cols-2 gap-3 pt-1">
        <div>
          <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
            <span>拉伸宽度</span>
            <input
              type="number"
              step="any"
              :value="Number(image.scale.x.toFixed(1))"
              @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) updateVector('scale', 'x', v); }"
              class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
            />
          </div>
          <input
            type="range"
            min="0.5"
            max="25"
            step="0.2"
            :value="image.scale.x"
            @input="updateVector('scale', 'x', parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>
        <div>
          <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
            <span>拉伸高度</span>
            <input
              type="number"
              step="any"
              :value="Number(image.scale.y.toFixed(1))"
              @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) updateVector('scale', 'y', v); }"
              class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
            />
          </div>
          <input
            type="range"
            min="0.5"
            max="25"
            step="0.2"
            :value="image.scale.y"
            @input="updateVector('scale', 'y', parseFloat(($event.target as HTMLInputElement).value))"
            class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      <!-- 旋转 -->
      <div v-if="image.renderMode === '3D' || image.renderMode === '360-Panoramic'" class="pt-2">
        <div class="flex justify-between items-center text-[11px] text-gray-400 mb-1">
          <span>旋转</span>
          <input
            type="number"
            step="any"
            :value="image.rotation.y"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) updateVector('rotation', 'y', v); }"
            class="w-10 text-[10px] font-mono text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-[#3b82f6] outline-none shrink-0"
          />
        </div>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          :value="image.rotation.y"
          @input="updateVector('rotation', 'y', parseInt(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
          id="image-yaw-slider"
        />
      </div>
    </div>
  </div>
</template>
