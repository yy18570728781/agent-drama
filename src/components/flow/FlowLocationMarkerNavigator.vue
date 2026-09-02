<script setup lang="ts">
type LocationMarkerItem = {
  id: string
  label: string
  x: number
  y: number
}

defineProps<{
  visible: boolean
  items: LocationMarkerItem[]
  activeIndex: number
}>()

const emit = defineEmits<{
  close: []
  select: [index: number]
  hover: [index: number]
}>()
</script>

<template>
  <Transition name="fade-slide">
    <div
      v-if="visible"
      class="location-marker-nav"
      @click.self="emit('close')"
    >
      <div class="location-marker-nav__panel">
        <div class="location-marker-nav__title">位置标记</div>
        <button class="location-marker-nav__close" @click="emit('close')">×</button>
        <div class="location-marker-nav__list">
          <button
            v-for="(item, index) in items"
            :key="item.id"
            type="button"
            class="location-marker-nav__item"
            :class="{ 'is-active': index === activeIndex }"
            @mouseenter="emit('hover', index)"
            @click="emit('select', index)"
          >
            <span class="location-marker-nav__label">{{ item.label }}</span>
            <span class="location-marker-nav__meta">{{ Math.round(item.x) }}, {{ Math.round(item.y) }}</span>
          </button>
        </div>
        <div class="location-marker-nav__hint">↑ ↓ 切换，Enter 聚焦，Esc 关闭</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.location-marker-nav {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 9, 11, 0.28);
  backdrop-filter: blur(8px);
}

.location-marker-nav__panel {
  position: relative;
  width: 320px;
  max-height: min(420px, 70vh);
  padding: 14px;
  border: 1px solid rgba(63, 63, 70, 0.95);
  border-radius: 16px;
  background: rgba(24, 24, 27, 0.96);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}

.location-marker-nav__title {
  color: #fafafa;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.location-marker-nav__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: rgba(39, 39, 42, 0.95);
  color: #d4d4d8;
  cursor: pointer;
}

.location-marker-nav__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(min(420px, 70vh) - 88px);
  overflow: auto;
}

.location-marker-nav__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(63, 63, 70, 0.8);
  border-radius: 12px;
  background: rgba(39, 39, 42, 0.72);
  color: #f4f4f5;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.location-marker-nav__item:hover,
.location-marker-nav__item.is-active {
  border-color: rgba(251, 146, 60, 0.85);
  background: rgba(66, 32, 6, 0.8);
  transform: translateY(-1px);
}

.location-marker-nav__label {
  font-size: 13px;
  font-weight: 500;
}

.location-marker-nav__meta,
.location-marker-nav__hint {
  color: #a1a1aa;
  font-size: 11px;
}

.location-marker-nav__hint {
  margin-top: 10px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
