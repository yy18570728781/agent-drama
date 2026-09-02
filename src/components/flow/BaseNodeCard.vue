<template>
  <div class="base-node-card" :class="[`node-${category}`, statusClass]">
    <div class="node-header">
      <span class="node-icon">{{ icon }}</span>
      <span class="node-title">{{ title }}</span>
      <span v-if="status" class="node-status-dot" :class="status"></span>
    </div>

    <Handle
      v-for="inp in visibleInputPorts"
      :key="'in-' + inp.id"
      type="target"
      :id="inp.id"
      :position="Position.Left"
      :style="portStyle(inp, visibleInputPorts)"
      :class="{ 'port-disabled': inp.disabled || disableInputPorts }"
      :connectable="!(inp.disabled || disableInputPorts)"
    />

    <div
      v-for="inp in visibleInputPorts"
      :key="'in-marker-' + inp.id"
      class="port-detect-marker port-detect-marker-left"
      :class="{ disabled: inp.disabled || disableInputPorts }"
      :style="portMarkerStyle(inp, visibleInputPorts)"
      aria-hidden="true"
    ></div>

    <Handle
      v-for="out in visibleOutputPorts"
      :key="'out-' + out.id"
      type="source"
      :id="out.id"
      :position="Position.Right"
      :style="portStyle(out, visibleOutputPorts)"
      :class="{ 'port-disabled': out.disabled || disableOutputPorts }"
      :connectable="!(out.disabled || disableOutputPorts)"
    />

    <div
      v-for="out in visibleOutputPorts"
      :key="'out-marker-' + out.id"
      class="port-detect-marker port-detect-marker-right"
      :class="{ disabled: out.disabled || disableOutputPorts }"
      :style="portMarkerStyle(out, visibleOutputPorts)"
      aria-hidden="true"
    ></div>

    <div v-if="visibleInputPorts.length || visibleOutputPorts.length" class="port-labels">
      <div class="port-labels-left">
        <div
          v-for="inp in visibleInputPorts"
          :key="inp.id"
          class="port-label"
          :class="{ disabled: inp.disabled || disableInputPorts }"
        >
          {{ inp.label || inp.id }}
        </div>
      </div>
      <div class="port-labels-right">
        <div
          v-for="out in visibleOutputPorts"
          :key="out.id"
          class="port-label"
          :class="{ disabled: out.disabled || disableOutputPorts }"
        >
          {{ out.label || out.id }}
        </div>
      </div>
    </div>

    <slot />

    <div v-if="preview" class="node-preview">
      <img v-if="previewType === 'image'" :src="preview" class="preview-img" />
      <video v-else-if="previewType === 'video'" :src="preview" class="preview-video" controls />
      <div v-else class="preview-text">{{ preview }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: '⚙️' },
  category: { type: String, default: 'process' },
  status: { type: String, default: '' },
  preview: { type: String, default: '' },
  previewType: { type: String, default: '' },
  inputPorts: { type: Array, default: () => [] },
  outputPorts: { type: Array, default: () => [] },
  disableInputPorts: { type: Boolean, default: false },
  disableOutputPorts: { type: Boolean, default: false },
})

const statusClass = computed(() => props.status ? `status-${props.status}` : '')
const visibleInputPorts = computed(() => (props.inputPorts || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => (props.outputPorts || []).filter((port) => port?.visible !== false))

function portStyle(port, all) {
  const idx = all.indexOf(port)
  const total = all.length
  return { top: `${(100 / (total + 1)) * (idx + 1) + 20}%` }
}

function portMarkerStyle(port, all) {
  return {
    ...portStyle(port, all),
    transform: 'translateY(-50%)',
  }
}
</script>

<style scoped>
.base-node-card {
  background: var(--bg-surface, #1e1e2e);
  border: 1.5px solid var(--border, #333);
  border-radius: 0;
  min-width: 210px;
  max-width: 300px;
  font-size: 12px;
  color: var(--text-primary, #e0e0e0);
  position: relative;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.base-node-card:hover { border-color: var(--accent-light, #6C5CE7); }
.node-input { border-top-color: #00b894; }
.node-process { border-top-color: #6c5ce7; }
.node-output { border-top-color: #fdcb6e; }

.node-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; font-weight: 600;
  border-bottom: 1px solid var(--border, #333);
}
.node-input .node-header { background: rgba(0,184,148,.12); border-radius: 0; }
.node-process .node-header { background: rgba(108,92,231,.12); border-radius: 0; }
.node-output .node-header { background: rgba(253,203,110,.12); border-radius: 0; }

.node-icon { font-size: 14px; }
.node-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #999; }
.node-status-dot.running { background: #0984e3; animation: pulse 1s infinite; }
.node-status-dot.completed { background: #00b894; }
.node-status-dot.failed { background: #d63031; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.status-running { border-color: #0984e3; box-shadow: 0 0 12px rgba(9,132,227,.3); }
.status-completed { border-color: #00b894; }
.status-failed { border-color: #d63031; }

.port-labels { display: flex; justify-content: space-between; padding: 6px 10px; min-height: 24px; }
.port-labels-left, .port-labels-right { display: flex; flex-direction: column; gap: 4px; }
.port-labels-right { text-align: right; }
.port-label { font-size: 10px; color: var(--text-secondary, #999); line-height: 16px; }
.port-label.disabled { opacity: 0.45; }
.port-disabled {
  opacity: 0.4 !important;
  pointer-events: none !important;
}

@keyframes port-marker-pulse {
  0%, 100% {
    transform: translateY(-50%) scale(1);
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.32), 0 0 18px rgba(99, 102, 241, 0.18);
  }
  50% {
    transform: translateY(-50%) scale(1.08);
    box-shadow: 0 0 0 7px rgba(99, 102, 241, 0.10), 0 0 24px rgba(99, 102, 241, 0.32);
  }
}

.port-detect-marker {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  border: 1.5px solid rgba(129, 140, 248, 0.72);
  background:
    linear-gradient(#ffffff, #ffffff) center / 3px 12px no-repeat,
    linear-gradient(#ffffff, #ffffff) center / 12px 3px no-repeat,
    radial-gradient(circle at 30% 30%, rgba(191, 219, 254, 0.95), rgba(99, 102, 241, 0.98) 55%, rgba(67, 56, 202, 1));
  box-shadow:
    0 0 0 4px rgba(99, 102, 241, 0.16),
    0 8px 18px rgba(67, 56, 202, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  pointer-events: none;
  opacity: 0.96;
  transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  animation: port-marker-pulse 1.8s ease-in-out infinite;
  filter: saturate(1.08);
}
.base-node-card:hover .port-detect-marker {
  opacity: 1;
  transform: translateY(-50%) scale(1.1);
  box-shadow:
    0 0 0 6px rgba(99, 102, 241, 0.22),
    0 10px 24px rgba(67, 56, 202, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  filter: saturate(1.18) brightness(1.04);
}
.port-detect-marker-left {
  left: -34px;
}
.port-detect-marker-right {
  right: -34px;
}
.port-detect-marker.disabled {
  opacity: 0.32;
  animation: none;
  filter: grayscale(0.25);
}

.node-preview { padding: 6px 10px 8px; border-top: 1px solid var(--border, #333); }
.preview-img { width: 100%; max-height: 120px; object-fit: cover; border-radius: 0; }
.preview-video { width: 100%; max-height: 120px; border-radius: 0; }
.preview-text { font-size: 11px; color: var(--text-secondary, #aaa); max-height: 60px; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; word-break: break-all; }
</style>
