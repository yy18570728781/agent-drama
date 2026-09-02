<template>
  <div class="model-view">
    <MarkingMenu v-model="renderMode" @open-settings="activeSettingsMode = $event" />

    <EnvironmentPanel
      v-if="modelUrl"
      v-model:backgroundColor="bgColor"
      v-model:lightIntensity="lightIntensity"
      v-model:wireframeColor="wireframeColor"
      v-model:singleSided="singleSided"
    />

    <div
      class="main-area"
      :style="{ backgroundColor: bgColor }"
      @drop.prevent="handleDrop"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
    >
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drag-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <p class="drag-title">将 3D 模型拖拽到这里</p>
          <p class="drag-hint">支持 .glb 和 .gltf 格式，.gltf 请同时选择 .bin 与贴图文件</p>
        </div>
      </div>

      <div v-if="!modelUrl && !isDragging" class="empty-state">
        <div class="empty-box">
          <div class="empty-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <h2 class="empty-title">加载 3D 模型</h2>
          <p class="empty-desc">将 .glb 或 .gltf 文件拖拽到这里，或点击下方按钮选择文件。若为 .gltf，请同时选择 .bin 和贴图文件。</p>
          <label class="upload-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>选择文件</span>
            <input type="file" accept=".glb,.gltf,.bin,.png,.jpg,.jpeg" multiple class="file-input" @change="handleFileUpload" />
          </label>
        </div>
      </div>

      <div class="canvas-wrap">
        <ModelViewer
          v-if="modelUrl"
          :url="modelUrl"
          :fileMap="fileMap"
          :renderMode="renderMode"
          :wireframeColor="wireframeColor"
          :singleSided="singleSided"
          :backgroundColor="bgColor"
          :lightIntensity="lightIntensity"
        />
      </div>

      <div v-if="modelUrl" class="footer-hint">
        <span class="hint-dot"></span>
        <span class="hint-bold">按住空格</span>
        <span>呼出模式菜单</span>
        <span>左键旋转</span>
        <span>右键平移</span>
        <span>滚轮缩放</span>
        <span>Alt + 左键移动灯光</span>
      </div>
    </div>

    <div v-if="activeSettingsMode" class="settings-modal-overlay" @click="activeSettingsMode = null">
      <div class="settings-modal" @click.stop>
        <div class="settings-modal-header">
          <h3 class="settings-modal-title">{{ activeSettingsMode }} Settings</h3>
          <button @click="activeSettingsMode = null" class="settings-modal-close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="settings-modal-desc">Configuration for {{ activeSettingsMode }}.</p>
        <div class="settings-modal-footer">
          <button @click="activeSettingsMode = null" class="settings-modal-ok">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, watch } from 'vue';
import ModelViewer from '@/components/director-3d/ModelViewer.vue';
import MarkingMenu from '@/components/director-3d/MarkingMenu.vue';
import EnvironmentPanel from '@/components/director-3d/EnvironmentPanel.vue';

const props = defineProps({
  initialUrl: {
    type: String,
    default: '',
  },
});

const modelUrl = ref('');
const fileMap = ref(new Map());
const isDragging = ref(false);

const renderMode = ref('final');
const wireframeColor = ref(null);
const singleSided = ref(false);
const bgColor = ref('#1c1c1c');
const lightIntensity = ref(1.0);
const activeSettingsMode = ref(null);

const processFiles = (files) => {
  const main = files.find(f => /\.(glb|gltf)$/i.test(f.name));
  if (!main) { alert('请至少选择一个 .glb 或 .gltf 文件'); return; }
  if (modelUrl.value) URL.revokeObjectURL(modelUrl.value);
  const map = new Map();
  files.forEach(f => map.set(f.name, f));
  fileMap.value = map;
  modelUrl.value = URL.createObjectURL(main);
};

const handleFileUpload = (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length) processFiles(files);
};

const handleDrop = (e) => {
  isDragging.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) processFiles(files);
};

watch(
  () => props.initialUrl,
  (nextUrl) => {
    if (!nextUrl) return;
    if (modelUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(modelUrl.value);
    }
    fileMap.value = new Map();
    modelUrl.value = nextUrl;
  },
  { immediate: true },
);

onBeforeUnmount(() => { if (modelUrl.value) URL.revokeObjectURL(modelUrl.value); });
</script>

<style scoped>
.model-view { display: flex; height: 100%; overflow: hidden; background: #1c1c1c; position: relative; }
.main-area { flex: 1; position: relative; overflow: hidden; transition: background-color 0.3s; }

.drag-overlay {
  position: absolute; inset: 0; z-index: 50;
  background: rgba(0,168,255,0.08); backdrop-filter: blur(4px);
  border: 2px dashed #00a8ff; margin: 16px; border-radius: 24px;
  display: flex; align-items: center; justify-content: center;
}
.drag-box { display: flex; flex-direction: column; align-items: center; gap: 12px; background: #18181b; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); }
.drag-icon { color: #00a8ff; animation: bounce 1s infinite; }
@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
.drag-title { font-size: 20px; font-weight: 600; color: #fff; margin: 0; }
.drag-hint  { font-size: 13px; color: #71717a; margin: 0; }

.empty-state { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; }
.empty-box { display: flex; flex-direction: column; align-items: center; gap: 20px; background: rgba(24,24,27,0.85); backdrop-filter: blur(12px); padding: 48px; border-radius: 28px; border: 1px solid rgba(255,255,255,0.05); max-width: 420px; text-align: center; }
.empty-icon-wrap { width: 80px; height: 80px; background: #27272a; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.05); color: #52525b; }
.empty-title { font-size: 22px; font-weight: 600; color: #fff; margin: 0; }
.empty-desc  { font-size: 13px; color: #71717a; line-height: 1.6; margin: 0; }

.upload-btn { display: flex; align-items: center; gap: 10px; padding: 12px 24px; background: #27272a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
.upload-btn:hover { background: #3f3f46; }
.upload-btn svg { color: #00a8ff; }
.file-input { display: none; }

.canvas-wrap { position: absolute; inset: 0; z-index: 0; }

.footer-hint { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10; display: flex; align-items: center; gap: 8px; background: rgba(24,24,27,0.6); backdrop-filter: blur(8px); padding: 6px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #71717a; pointer-events: none; white-space: nowrap; }
.hint-dot { width: 8px; height: 8px; border-radius: 50%; background: #00a8ff; animation: pulse 2s infinite; flex-shrink: 0; }
.hint-bold { font-weight: 700; color: #fff; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.settings-modal-overlay { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); }
.settings-modal { background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; width: 380px; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
.settings-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.settings-modal-title { font-size: 16px; font-weight: 700; color: #fff; text-transform: capitalize; margin: 0; }
.settings-modal-close { background: transparent; border: none; color: #71717a; cursor: pointer; padding: 4px; border-radius: 6px; transition: color 0.15s; }
.settings-modal-close:hover { color: #fff; }
.settings-modal-desc { font-size: 13px; color: #71717a; margin: 0 0 20px; line-height: 1.6; }
.settings-modal-footer { display: flex; justify-content: flex-end; }
.settings-modal-ok { padding: 8px 20px; background: #00a8ff; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.settings-modal-ok:hover { background: #0090e0; }
</style>
