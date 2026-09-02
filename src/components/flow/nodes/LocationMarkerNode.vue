<script setup lang="ts">
defineProps<{
  data?: {
    label?: string
  }
  selected?: boolean
}>()
</script>

<template>
  <div class="location-marker-root" :title="data?.label || '位置标记'">
    <div class="location-marker-pole" :class="{ 'is-selected': selected }"></div>
    <div class="location-marker-flag" :class="{ 'is-selected': selected }">
      <div class="location-marker-cloth">
        <div class="location-marker-notch"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.location-marker-root {
  position: relative;
  width: 64px;
  height: 76px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: auto;
}

.location-marker-flag {
  position: absolute;
  top: 6px;
  left: 31px;
  width: 30px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.location-marker-root:hover .location-marker-flag {
  transform: translateY(-1px);
  filter: drop-shadow(0 8px 14px rgba(249, 115, 22, 0.28));
}

.location-marker-flag.is-selected {
  filter: drop-shadow(0 0 0 2px rgba(251, 146, 60, 0.26));
}

.location-marker-cloth {
  position: relative;
  width: 30px;
  height: 24px;
  background: linear-gradient(180deg, #fb923c 0%, #f97316 100%);
  border: 1px solid rgba(194, 65, 12, 0.8);
  border-radius: 5px 3px 3px 5px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
}

.location-marker-notch {
  position: absolute;
  top: 7px;
  right: -1px;
  width: 11px;
  height: 10px;
  background: #18181b;
  clip-path: polygon(0 50%, 100% 0, 100% 100%);
}

.location-marker-pole {
  position: absolute;
  top: 4px;
  left: 28px;
  width: 4px;
  height: 58px;
  background: linear-gradient(180deg, #fde68a 0%, #f59e0b 100%);
  border-radius: 999px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
}

.location-marker-pole.is-selected {
  background: linear-gradient(180deg, #fef3c7 0%, #fbbf24 100%);
}
</style>
