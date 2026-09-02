<template>
  <!-- 工作流加载进度遮罩 -->
  <Transition name="fade">
    <div v-if="isLoading" class="wf-loading-overlay">
      <div class="wf-loading-card">
        <div class="wf-loading-spinner"></div>
        <div class="wf-loading-title">正在加载工作流</div>
        <div class="wf-loading-progress-bar">
          <div class="wf-loading-progress-fill" :style="{ width: `${loadProgress}%` }"></div>
        </div>
        <div class="wf-loading-text">{{ loadProgressText }}</div>
        <button class="wf-loading-cancel" @click="$emit('cancel-load')">取消</button>
      </div>
    </div>
  </Transition>

  <!-- 工作流卡片选择器（取消加载后或无标签页时显示） -->
</template>

<script setup>
defineProps({
  isLoading: { type: Boolean, default: false },
  loadProgress: { type: Number, default: 0 },
  loadProgressText: { type: String, default: '' },
})

defineEmits(['cancel-load'])
</script>

<style scoped>
/* 工作流加载进度遮罩 */
.wf-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
}
.wf-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 36px 48px;
  border-radius: 16px;
  background: rgba(24, 24, 27, 0.95);
  border: 1px solid rgba(63, 63, 70, 0.6);
  min-width: 280px;
}
.wf-loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: wf-spin 0.8s linear infinite;
}
@keyframes wf-spin {
  to { transform: rotate(360deg); }
}
.wf-loading-title {
  font-size: 16px;
  font-weight: 600;
  color: #e4e4e7;
}
.wf-loading-progress-bar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(63, 63, 70, 0.8);
  overflow: hidden;
}
.wf-loading-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.2s ease;
}
.wf-loading-text {
  font-size: 13px;
  color: #a1a1aa;
}
.wf-loading-cancel {
  padding: 6px 20px;
  border-radius: 8px;
  border: 1px solid rgba(63, 63, 70, 0.8);
  background: rgba(39, 39, 42, 0.9);
  color: #d4d4d8;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.wf-loading-cancel:hover {
  background: rgba(63, 63, 70, 0.9);
  border-color: rgba(99, 102, 241, 0.5);
}

/* fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
