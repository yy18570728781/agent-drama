<template>
  <div :class="['gen-placeholder-card', { 'gen-placeholder--sse-error': showRepair }]">
    <!-- 闪烁主体 -->
    <div class="placeholder-body" :style="bodyStyle">
      <!-- 满卡片微光闪烁层 -->
      <div class="shimmer-layer"></div>
      <div class="placeholder-loading-text">AI-Comic-Director-Canvas 生成中...</div>

      <div v-if="showRepair" class="placeholder-overlay-actions" @click.stop>
        <button
          class="overlay-icon-btn overlay-icon-btn-repair"
          :disabled="repairing"
          :title="repairing ? '修复中...' : '尝试修复'"
          @click.stop="handleRepair"
        >
          <Settings2 :size="14" />
        </button>
      </div>

      <!-- 模型信息 -->
      <div class="placeholder-footer">
        <span class="model-name">{{ task.modelDisplayName || task.modelInfo || '生成中' }}</span>
        <span v-if="task.prompt" class="prompt-hint">{{ truncatePrompt(task.prompt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { Settings2 } from '@/components/common/icon/lucide'
import type { QueueTask } from '@/stores/task-queue'

const props = defineProps<{
  task: QueueTask
  aspectRatio?: number
}>()

const emit = defineEmits<{
  cancel: [id: number]
  repair: [task: QueueTask]
}>()

const repairing = ref(false)
let repairTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (repairTimer) clearTimeout(repairTimer)
})

const showRepair = computed(() => props.task._sseDisconnected === true)

const bodyStyle = computed(() => {
  const ratio = props.aspectRatio || 1
  return { aspectRatio: String(ratio) }
})

function truncatePrompt(prompt: string): string {
  if (prompt.length <= 40) return prompt
  return prompt.slice(0, 40) + '...'
}

async function handleRepair() {
  repairing.value = true
  emit('repair', props.task)
  if (repairTimer) clearTimeout(repairTimer)
  repairTimer = setTimeout(() => { repairing.value = false; repairTimer = null }, 10000)
}
</script>

<style scoped>
.gen-placeholder-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

/* 主体 */
.placeholder-body {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1a1a20;
  overflow: hidden;
  min-height: 120px;
  isolation: isolate;
}

.placeholder-overlay-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 3;
}

.gen-placeholder-card:hover .placeholder-overlay-actions {
  opacity: 1;
  pointer-events: auto;
}

.overlay-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: rgba(22, 22, 28, 0.82);
  color: #c4c4cc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.12s;
  backdrop-filter: blur(8px);
}

.overlay-icon-btn:hover:not(:disabled) {
  background: rgba(50, 50, 62, 0.95);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.24);
  transform: scale(1.08);
}

.overlay-icon-btn-repair:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.18);
  border-color: rgba(251, 191, 36, 0.35);
  color: #fbbf24;
}

.overlay-icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.placeholder-body::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 24%, rgba(139, 92, 246, 0.16), transparent 38%),
    radial-gradient(circle at 78% 72%, rgba(99, 102, 241, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0));
  opacity: 0.72;
  animation: ambient-breathe 4.8s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

/* 满卡片微光闪烁 */
.placeholder-loading-text {
  position: relative;
  z-index: 2;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 15, 22, 0.48);
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  backdrop-filter: blur(8px);
}

.shimmer-layer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    112deg,
    transparent 18%,
    rgba(255, 255, 255, 0.02) 34%,
    rgba(139, 92, 246, 0.08) 44%,
    rgba(255, 255, 255, 0.18) 50%,
    rgba(99, 102, 241, 0.14) 56%,
    rgba(139, 92, 246, 0.06) 64%,
    transparent 82%
  );
  background-size: 220% 100%;
  mix-blend-mode: screen;
  opacity: 0.95;
  animation: shimmer-sweep 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  z-index: 1;
}

@keyframes shimmer-sweep {
  0% {
    background-position: 180% 0;
    opacity: 0.42;
  }
  18% {
    opacity: 0.68;
  }
  48% {
    opacity: 0.98;
  }
  100% {
    background-position: -140% 0;
    opacity: 0.42;
  }
}

@keyframes ambient-breathe {
  0% {
    transform: scale(1);
    opacity: 0.58;
    filter: saturate(1);
  }
  50% {
    transform: scale(1.035);
    opacity: 0.88;
    filter: saturate(1.12);
  }
  100% {
    transform: scale(1);
    opacity: 0.58;
    filter: saturate(1);
  }
}

/* SSE 断连时闪烁变橙 */
.gen-placeholder--sse-error .shimmer-layer {
  background: linear-gradient(
    112deg,
    transparent 18%,
    rgba(255, 255, 255, 0.018) 34%,
    rgba(251, 191, 36, 0.08) 44%,
    rgba(255, 244, 214, 0.16) 50%,
    rgba(245, 158, 11, 0.14) 56%,
    rgba(251, 191, 36, 0.06) 64%,
    transparent 82%
  );
  background-size: 220% 100%;
}

.gen-placeholder--sse-error .placeholder-body::before {
  background:
    radial-gradient(circle at 20% 24%, rgba(251, 191, 36, 0.18), transparent 38%),
    radial-gradient(circle at 78% 72%, rgba(245, 158, 11, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0));
}

/* 底部信息 */
.placeholder-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 12px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6) 60%);
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 2;
}
.model-name {
  font-size: 11px;
  font-weight: 600;
  color: rgba(167, 139, 250, 0.9);
}
.prompt-hint {
  font-size: 10px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
