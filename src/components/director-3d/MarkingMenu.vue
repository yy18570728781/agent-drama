<template>
  <div v-if="active" class="marking-menu-overlay" @contextmenu.prevent>
    <!-- Center dot -->
    <div
      class="center-dot"
      :style="{ left: cx + 'px', top: cy + 'px' }"
    ></div>

    <!-- Line to selected item -->
    <svg class="menu-svg">
      <line
        v-if="selectedIndex !== -1 && hoveredSettingsIndex === -1"
        :x1="cx"
        :y1="cy"
        :x2="items[selectedIndex].x"
        :y2="items[selectedIndex].y"
        stroke="rgba(255,255,255,0.2)"
        stroke-width="1"
        stroke-linecap="round"
      />
    </svg>

    <!-- Menu Items -->
    <div
      v-for="(item, i) in items"
      :key="item.id"
      class="menu-item"
      :class="{ 'menu-item-active': selectedIndex === i && hoveredSettingsIndex === -1 }"
      :style="{ left: item.x + 'px', top: item.y + 'px' }"
    >
      <!-- Main Item Area -->
      <div class="menu-item-main" @mouseup="selectItem(i)">
        <component :is="item.icon" class="menu-item-icon" />
        <span class="menu-item-label" :class="{ 'menu-item-label-active': selectedIndex === i && hoveredSettingsIndex === -1 }">{{ item.label }}</span>
      </div>

      <!-- Settings Box -->
      <div
        class="menu-item-settings"
        :class="{ 'menu-item-settings-hover': hoveredSettingsIndex === i }"
        @mouseenter="hoveredSettingsIndex = i"
        @mouseleave="hoveredSettingsIndex = -1"
        @mouseup="openSettings(i)"
      >
        <div class="settings-dot" :class="{ 'settings-dot-active': hoveredSettingsIndex === i }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Box, Droplet, Zap, Wind, Activity, Circle, Grid, Layout, Layers, Sun } from '@/components/common/icon/lucide';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'open-settings', val: string): void;
}>();

const active = ref(false);
const cx = ref(0);
const cy = ref(0);
const mx = ref(0);
const my = ref(0);
const selectedIndex = ref(-1);
const hoveredSettingsIndex = ref(-1);

const offsets = [
  { dx: 140, dy: 20 },
  { dx: 90,  dy: 60 },
  { dx: 0,   dy: 90 },
  { dx: -90, dy: 60 },
  { dx: -140,dy: 20 },
  { dx: -140,dy: -20 },
  { dx: -90, dy: -60 },
  { dx: 0,   dy: -90 },
  { dx: 90,  dy: -60 },
  { dx: 140, dy: -20 },
];

const baseItems = [
  { id: 'normal',       label: 'Normal Map',    icon: Activity },
  { id: 'metalness',    label: 'Metalness',     icon: Zap },
  { id: 'roughness',    label: 'Roughness',     icon: Wind },
  { id: 'wireframe',    label: 'Wireframe',     icon: Grid },
  { id: 'uvChecker',    label: 'UV Checker',    icon: Layout },
  { id: 'matcap',       label: 'Matcap',        icon: Circle },
  { id: 'matcapSurface',label: 'Matcap+Surface',icon: Layers },
  { id: 'final',        label: 'Final Render',  icon: Box },
  { id: 'baseColor',    label: 'Base Color',    icon: Droplet },
  { id: 'emissive',     label: 'Emissive',      icon: Sun },
];

const items = computed(() =>
  baseItems.map((item, i) => ({
    ...item,
    x: cx.value + offsets[i].dx,
    y: cy.value + offsets[i].dy,
  }))
);

const itemAngles = offsets.map(off => Math.atan2(off.dy, off.dx));

const globalMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

const onMouseMove = (e: MouseEvent) => {
  globalMouse.x = e.clientX;
  globalMouse.y = e.clientY;

  if (active.value) {
    mx.value = e.clientX;
    my.value = e.clientY;

    const dx = mx.value - cx.value;
    const dy = my.value - cy.value;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) {
      selectedIndex.value = -1;
    } else {
      const mouseAngle = Math.atan2(dy, dx);
      let minDiff = Infinity;
      let bestIndex = -1;
      for (let i = 0; i < itemAngles.length; i++) {
        let diff = Math.abs(mouseAngle - itemAngles[i]);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < minDiff) { minDiff = diff; bestIndex = i; }
      }
      selectedIndex.value = bestIndex;
    }
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === ' ' && !active.value && !e.repeat) {
    e.preventDefault();
    active.value = true;
    cx.value = globalMouse.x;
    cy.value = globalMouse.y;
    mx.value = globalMouse.x;
    my.value = globalMouse.y;
    selectedIndex.value = -1;
    hoveredSettingsIndex.value = -1;
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (active.value) {
      if (hoveredSettingsIndex.value !== -1) {
        emit('open-settings', items.value[hoveredSettingsIndex.value].id);
      } else if (selectedIndex.value !== -1) {
        emit('update:modelValue', items.value[selectedIndex.value].id);
      }
    }
    active.value = false;
  }
};

const selectItem = (index: number) => {
  emit('update:modelValue', items.value[index].id);
  active.value = false;
};

const openSettings = (index: number) => {
  emit('open-settings', items.value[index].id);
  active.value = false;
};

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<style scoped>
.marking-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}

.center-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.menu-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.menu-item {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: stretch;
  background: #181818;
  border: 1px solid #333;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  pointer-events: auto;
  overflow: hidden;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.menu-item-active {
  background: #252525;
  border-color: #444;
  transform: translate(-50%, -50%) scale(1.05);
}

.menu-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
}

.menu-item-icon {
  width: 16px;
  height: 16px;
  color: #00a8ff;
  flex-shrink: 0;
}

.menu-item-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: #d4d4d8;
  transition: color 0.15s;
}

.menu-item-label-active {
  color: #ffffff;
}

.menu-item-settings {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid #333;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item-settings:hover,
.menu-item-settings-hover {
  background: #333;
}

.settings-dot {
  width: 6px;
  height: 6px;
  border: 1px solid #71717a;
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}

.settings-dot-active {
  background: #ffffff;
  border-color: #ffffff;
}
</style>
