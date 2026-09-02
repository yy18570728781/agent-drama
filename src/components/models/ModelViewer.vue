<template>
  <div class="model-viewer">
    <!-- 空状态 -->
    <div v-if="!props.model" class="viewer-empty">
      <div class="viewer-empty-icon">⬡</div>
      <span>选择一个模型以预览</span>
    </div>

    <!-- 有模型时 -->
    <template v-else>
      <!-- 顶部信息栏 -->
      <div class="viewer-header">
        <div class="viewer-filename">{{ props.model.name }}</div>
        <span class="viewer-badge" :class="`badge-${props.model.format}`">
          {{ props.model.format.toUpperCase() }}
        </span>
        <div class="viewer-meta">{{ props.model.size }} · {{ props.model.time }}</div>
      </div>

      <!-- 3D预览区域 -->
      <div class="viewer-preview-area">
        <div class="cube-scene">
          <div class="cube-wrapper">
            <div class="cube">
              <div class="cube-face face-front"></div>
              <div class="cube-face face-back"></div>
              <div class="cube-face face-left"></div>
              <div class="cube-face face-right"></div>
              <div class="cube-face face-top"></div>
              <div class="cube-face face-bottom"></div>
            </div>
          </div>
        </div>
        <div class="viewer-hint">3D 预览（占位）</div>
      </div>

      <!-- 底部操作栏 -->
      <div class="viewer-actions">
        <button class="viewer-download-btn" @click="handleDownload">↓ 下载</button>
        <button class="viewer-copy-btn" @click="handleCopy">链接</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Model3D {
  id: string
  name: string
  format: 'glb' | 'gltf' | 'obj' | 'fbx'
  size: string
  time: string
  thumbClass: string
}

const props = defineProps<{ model: Model3D | null }>()

function handleDownload() {
  // TODO: Implement download
}
function handleCopy() {
  // TODO: Implement copy link
}
</script>

<style scoped>
.model-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  min-width: 320px;
  width: 320px;
  flex-shrink: 0;
}

/* ── Empty state ── */
.viewer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.viewer-empty-icon {
  font-size: 40px;
  opacity: 0.4;
}

/* ── Header ── */
.viewer-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.viewer-filename {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.viewer-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  width: fit-content;
}

.badge-glb  { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.badge-gltf { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.badge-obj  { background: rgba(52, 211, 153, 0.15);  color: #34d399; }
.badge-fbx  { background: rgba(251, 191, 36, 0.15);  color: #fbbf24; }

.viewer-meta {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Preview area ── */
.viewer-preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--bg-base);
  overflow: hidden;
}

.cube-scene {
  perspective: 400px;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cube-wrapper {
  width: 100px;
  height: 100px;
  transform-style: preserve-3d;
  animation: rotateCube 6s linear infinite;
}

.cube {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  position: relative;
}

.cube-face {
  position: absolute;
  width: 100px;
  height: 100px;
  border: 1px solid rgba(124, 110, 246, 0.4);
}

.face-front  { background: rgba(124, 110, 246, 0.15); transform: translateZ(50px); }
.face-back   { background: rgba(124, 110, 246, 0.10); transform: rotateY(180deg) translateZ(50px); }
.face-left   { background: rgba(124, 110, 246, 0.10); transform: rotateY(-90deg) translateZ(50px); }
.face-right  { background: rgba(124, 110, 246, 0.10); transform: rotateY(90deg) translateZ(50px); }
.face-top    { background: rgba(124, 110, 246, 0.20); transform: rotateX(90deg) translateZ(50px); }
.face-bottom { background: rgba(124, 110, 246, 0.05); transform: rotateX(-90deg) translateZ(50px); }

@keyframes rotateCube {
  from { transform: rotateX(-20deg) rotateY(0deg); }
  to   { transform: rotateX(-20deg) rotateY(360deg); }
}

.viewer-hint {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

/* ── Actions ── */
.viewer-actions {
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.viewer-download-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.viewer-download-btn:hover { opacity: 0.85; }

.viewer-copy-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.viewer-copy-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
