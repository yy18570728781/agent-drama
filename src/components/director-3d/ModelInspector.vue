<template>
  <div class="inspector">
    <!-- Header -->
    <div class="inspector-header" @click="isOpen = !isOpen">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }"><polyline points="9 18 15 12 9 6"></polyline></svg>
      <span class="inspector-title">Model Inspector</span>
    </div>

    <div v-show="isOpen">
      <!-- Wireframe Color -->
      <div class="section">
        <div class="section-header">
          <span class="section-label">Wireframe 叠加</span>
        </div>
        <div class="color-row">
          <button
            v-for="c in wireframeColors" :key="c.value || 'none'"
            class="color-swatch"
            :class="{ active: wireframeColor === c.value }"
            :style="{ background: c.value || '#2a2a2a' }"
            @click="emit('update:wireframeColor', c.value)"
          >
            <svg v-if="!c.value" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Single Sided -->
      <div class="section section-row">
        <button class="toggle" :class="{ on: singleSided }" @click="emit('update:singleSided', !singleSided)">
          <div class="toggle-thumb" :class="{ on: singleSided }"></div>
        </button>
        <span class="toggle-label">Single Sided</span>
      </div>

      <!-- Background Color -->
      <div class="section">
        <span class="section-label">背景颜色</span>
        <div class="color-row">
          <button
            v-for="c in bgColors" :key="c.value"
            class="color-swatch"
            :class="{ active: bgColor === c.value }"
            :style="{ background: c.value, border: c.value === '#ffffff' ? '2px solid #333' : '' }"
            @click="emit('update:bgColor', c.value)"
            :title="c.label"
          ></button>
          <input
            type="color"
            class="color-picker"
            :value="bgColor"
            @input="e => emit('update:bgColor', e.target.value)"
            title="自定义颜色"
          />
        </div>
      </div>

      <!-- Light Intensity -->
      <div class="section">
        <div class="section-header-row">
          <span class="section-label" style="margin-bottom:0">灯光亮度</span>
          <span class="slider-value">{{ lightIntensity.toFixed(1) }}x</span>
        </div>
        <input
          type="range"
          class="slider"
          min="0"
          max="5"
          step="0.1"
          :value="lightIntensity"
          @input="e => emit('update:lightIntensity', parseFloat(e.target.value))"
        />
        <div class="slider-labels">
          <span>0</span><span>2.5</span><span>5</span>
        </div>
      </div>

      <!-- Render groups -->
      <div v-for="group in renderGroups" :key="group.title" class="group">
        <div class="group-title">{{ group.title }}</div>
        <button
          v-for="item in group.items" :key="item.id"
          class="mode-btn"
          :class="{ active: renderMode === item.id }"
          @click="emit('update:renderMode', item.id)"
        >
          <component :is="item.icon" :size="14" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Box, Droplet, Zap, Wind, Activity, Circle, Layers, Grid, Layout } from '@/components/common/icon/lucide';

const props = defineProps({
  renderMode: String,
  wireframeColor: { type: String, default: null },
  singleSided: Boolean,
  bgColor: { type: String, default: '#09090b' },
  lightIntensity: { type: Number, default: 1 },
});

const emit = defineEmits(['update:renderMode', 'update:wireframeColor', 'update:singleSided', 'update:bgColor', 'update:lightIntensity']);

const isOpen = ref(true);

const wireframeColors = [
  { value: null },
  { value: '#ffffff' },
  { value: '#000000' },
  { value: '#ff0000' },
  { value: '#0000ff' },
  { value: '#00ff00' },
  { value: '#ffff00' },
];

const bgColors = [
  { value: '#09090b', label: '极暗' },
  { value: '#18181b', label: '深灰' },
  { value: '#27272a', label: '中灰' },
  { value: '#52525b', label: '浅灰' },
  { value: '#ffffff', label: '白色' },
  { value: '#0f172a', label: '深蓝' },
  { value: '#1e3a5f', label: '蓝色' },
];

const renderGroups = [
  {
    title: 'Render',
    items: [{ id: 'final', label: 'Final Render', icon: Box }],
  },
  {
    title: 'Material Channels',
    items: [
      { id: 'baseColor', label: '基础色 Base Color', icon: Droplet },
      { id: 'metalness', label: '金属度 Metalness', icon: Zap },
      { id: 'roughness', label: '粗糙度 Roughness', icon: Wind },
      { id: 'normal', label: '法线 Normal Map', icon: Activity },
      { id: 'specular', label: 'Specular F0', icon: Circle },
    ],
  },
  {
    title: 'Geometry',
    items: [
      { id: 'matcap', label: 'Matcap', icon: Circle },
      { id: 'matcapSurface', label: 'Matcap + Surface', icon: Layers },
      { id: 'clay', label: '白模 Clay', icon: Box },
      { id: 'wireframe', label: '布线 Wireframe', icon: Grid },
    ],
  },
  {
    title: 'UV',
    items: [{ id: 'uvChecker', label: 'UV Checker', icon: Layout }],
  },
];
</script>

<style scoped>
.inspector {
  width: 220px;
  min-width: 220px;
  height: 100%;
  background: #111111;
  border-right: 1px solid rgba(255,255,255,0.05);
  color: #a1a1aa;
  overflow-y: auto;
  font-size: 13px;
  user-select: none;
  flex-shrink: 0;
  z-index: 20;
}

.inspector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: color 0.15s;
}
.inspector-header:hover { color: #fff; }

.inspector-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.section-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #52525b;
  margin-bottom: 10px;
  display: block;
}

.color-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, border-color 0.15s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.active { border-color: #fff; transform: scale(1.15); }

.color-picker {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: none;
  overflow: hidden;
}
.color-picker::-webkit-color-swatch-wrapper { padding: 0; }
.color-picker::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; }

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.slider-value {
  font-size: 11px;
  color: #00a8ff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #3f3f46;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #00a8ff;
  cursor: pointer;
  border: 2px solid #09090b;
  box-shadow: 0 0 4px rgba(0,168,255,0.5);
}
.slider::-webkit-slider-thumb:hover {
  background: #33bbff;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #52525b;
  margin-top: 4px;
}

.toggle {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  position: relative;
  background: #3f3f46;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle.on { background: #fff; }

.toggle-thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s, background 0.2s;
}
.toggle-thumb.on { transform: translateX(16px); background: #000; }

.toggle-label { font-size: 13px; font-weight: 600; color: #fff; }

.group { margin-top: 18px; }

.group-title {
  padding: 0 16px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #52525b;
}

.mode-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}
.mode-btn:hover { background: rgba(255,255,255,0.05); color: #e4e4e7; }
.mode-btn.active { background: #00a8ff; color: #fff; font-weight: 500; }

.inspector::-webkit-scrollbar { width: 4px; }
.inspector::-webkit-scrollbar-track { background: transparent; }
.inspector::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
.inspector::-webkit-scrollbar-thumb:hover { background: #555; }
</style>
