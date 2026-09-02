<template>
  <div class="env-panel">

    <!-- Background Color -->
    <div class="env-section">
      <span class="env-label">Background</span>
      <div class="color-row">
        <button
          v-for="bg in bgColors"
          :key="bg.value"
          class="color-swatch round"
          :class="{ active: backgroundColor === bg.value }"
          :style="{ backgroundColor: bg.value }"
          :title="bg.label"
          @click="emit('update:backgroundColor', bg.value)"
        ></button>
        <div class="divider-v"></div>
        <label
          class="color-wheel-btn"
          :class="{ active: !bgColors.find(c => c.value === backgroundColor) }"
          title="Custom Color"
        >
          <div class="color-wheel-bg"></div>
          <div class="color-wheel-center"></div>
          <input
            type="color"
            :value="backgroundColor"
            @input="e => emit('update:backgroundColor', (e.target as HTMLInputElement).value)"
            class="color-input-hidden"
          />
        </label>
      </div>
    </div>

    <!-- Light Intensity -->
    <div class="env-section">
      <div class="env-label-row">
        <span class="env-label" style="margin-bottom:0">Light Intensity</span>
        <span class="env-value">{{ lightIntensity.toFixed(1) }}</span>
      </div>
      <input
        type="range"
        min="0" max="3" step="0.1"
        :value="lightIntensity"
        @input="e => emit('update:lightIntensity', parseFloat((e.target as HTMLInputElement).value))"
        class="env-slider"
      />
    </div>

    <!-- Wireframe Overlay -->
    <div class="env-section">
      <span class="env-label">Wireframe Overlay</span>
      <div class="color-row">
        <button
          v-for="color in wireframeColors"
          :key="color.value || 'none'"
          class="color-swatch square"
          :class="{ active: wireframeColor === color.value }"
          :style="{ backgroundColor: color.value || '#222' }"
          @click="emit('update:wireframeColor', color.value)"
        >
          <svg v-if="!color.value" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Single Sided Toggle -->
    <div class="env-section env-section-row">
      <span class="env-label" style="margin-bottom:0">Single Sided</span>
      <button
        class="toggle-btn"
        :class="{ on: singleSided }"
        @click="emit('update:singleSided', !singleSided)"
      >
        <div class="toggle-thumb" :class="{ on: singleSided }"></div>
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  backgroundColor: string;
  lightIntensity: number;
  wireframeColor: string | null;
  singleSided: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:backgroundColor', value: string): void;
  (e: 'update:lightIntensity', value: number): void;
  (e: 'update:wireframeColor', value: string | null): void;
  (e: 'update:singleSided', value: boolean): void;
}>();

const bgColors = [
  { value: '#1c1c1c', label: 'Dark' },
  { value: '#333333', label: 'Gray' },
  { value: '#888888', label: 'Light Gray' },
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
];

const wireframeColors = [
  { value: null },
  { value: '#ffffff' },
  { value: '#000000' },
  { value: '#ff0000' },
  { value: '#0000ff' },
  { value: '#00ff00' },
  { value: '#ffff00' },
];
</script>

<style scoped>
.env-panel {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 40;
  background: rgba(24, 24, 27, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.env-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.env-section-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  gap: 0;
}

.env-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #52525b;
  display: block;
}

.env-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.env-value {
  font-size: 11px;
  font-weight: 600;
  color: #00a8ff;
  font-variant-numeric: tabular-nums;
}

.env-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #3f3f46;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  accent-color: #00a8ff;
}

.env-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #00a8ff;
  cursor: pointer;
  border: 2px solid #18181b;
  box-shadow: 0 0 6px rgba(0, 168, 255, 0.5);
}

.color-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.color-swatch:hover { transform: scale(1.15); }
.color-swatch.active { border-color: #ffffff; transform: scale(1.15); }

.color-swatch.round { border-radius: 50%; }
.color-swatch.square { border-radius: 5px; }

.divider-v {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 2px;
}

.color-wheel-btn {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #52525b;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s, border-color 0.15s;
}
.color-wheel-btn:hover { transform: scale(1.15); }
.color-wheel-btn.active { border-color: #00a8ff; transform: scale(1.15); }

.color-wheel-bg {
  position: absolute;
  inset: 0;
  background: conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red);
}

.color-wheel-center {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, white 0%, transparent 70%);
  opacity: 0.5;
}

.color-input-hidden {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 10;
}

/* Toggle */
.toggle-btn {
  width: 40px;
  height: 20px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  position: relative;
  background: #3f3f46;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-btn.on { background: #00a8ff; }

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-thumb.on { transform: translateX(20px); }
</style>
