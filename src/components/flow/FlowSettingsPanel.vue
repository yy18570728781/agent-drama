<template>
  <Transition name="slide">
    <div v-if="visible" class="slide-panel">
      <div class="slide-panel-header">
        <span class="slide-panel-title">个性化设置</span>
        <button class="slide-panel-close" @click="$emit('update:visible', false)">×</button>
      </div>
      <div class="slide-panel-body">
        <FlowPersonalization />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import FlowPersonalization from './FlowPersonalization.vue'

defineProps({
  visible: { type: Boolean, default: false },
})

defineEmits(['update:visible'])
</script>

<style scoped>
/* ---- 滑出面板 ---- */
.slide-panel {
  position: absolute;
  left: 24px;
  top: 80px;
  bottom: 24px;
  width: 280px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
  z-index: 150;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
}

.slide-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #27272a;
}

.slide-panel-title {
  font-size: 11px;
  font-weight: 500;
  color: #a1a1aa;
  letter-spacing: 0.2px;
}

.slide-panel-close {
  background: none;
  border: none;
  color: #71717a;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
}
.slide-panel-close:hover {
  color: white;
  background: #27272a;
}

.slide-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

/* 滑出动画 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}
</style>
