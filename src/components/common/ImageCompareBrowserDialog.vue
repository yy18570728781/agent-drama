<template>
  <el-dialog
    :model-value="visible"
    fullscreen
    destroy-on-close
    class="image-compare-browser-dialog"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <template #header>
      <div class="compare-browser-header">
        <div class="compare-browser-heading">
          <button type="button" class="compare-browser-exit" @click="handleClose">
            ESC 退出
          </button>
          <div>
            <div class="compare-browser-title">{{ title }}</div>
            <div class="compare-browser-subtitle">{{ subtitle }}</div>
          </div>
        </div>
        <div class="compare-browser-toolbar">
          <button
            type="button"
            class="compare-mode-btn"
            :class="{ active: currentMode === 'overlay' }"
            @click="currentMode = 'overlay'"
          >
            层叠
          </button>
          <button
            type="button"
            class="compare-mode-btn"
            :class="{ active: currentMode === 'split' }"
            @click="currentMode = 'split'"
          >
            双栏
          </button>
        </div>
      </div>
    </template>

    <div class="compare-browser-layout">
      <aside class="compare-browser-list">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="compare-browser-item"
          :class="{ active: item.id === selectedId }"
          @click="selectedId = item.id"
        >
          <img :src="item.rightImage || item.leftImage" alt="" class="compare-browser-item-thumb" draggable="false" />
          <div class="compare-browser-item-copy">
            <div class="compare-browser-item-title">{{ item.title }}</div>
            <div v-if="item.subtitle" class="compare-browser-item-subtitle">{{ item.subtitle }}</div>
          </div>
        </button>
      </aside>

      <section class="compare-browser-stage">
        <template v-if="selectedItem">
          <div class="compare-browser-stage-head">
            <div class="compare-browser-stage-heading">
              <div>
                <div class="compare-browser-stage-title">{{ selectedItem.title }}</div>
                <div v-if="selectedItem.subtitle" class="compare-browser-stage-subtitle">{{ selectedItem.subtitle }}</div>
              </div>
              <div class="compare-browser-stage-metrics">
                <div v-if="selectedItem.originalSize" class="stage-metric">
                  <span class="stage-metric-label">原始</span>
                  <span class="stage-metric-value">{{ selectedItem.originalSize }}</span>
                </div>
                <div v-if="selectedItem.compressedSize" class="stage-metric">
                  <span class="stage-metric-label">压后</span>
                  <span class="stage-metric-value">{{ selectedItem.compressedSize }}</span>
                </div>
                <div v-if="selectedItem.originalDimensions" class="stage-metric">
                  <span class="stage-metric-label">原始尺寸</span>
                  <span class="stage-metric-value">{{ selectedItem.originalDimensions }}</span>
                </div>
                <div v-if="selectedItem.compressedDimensions" class="stage-metric">
                  <span class="stage-metric-label">压后尺寸</span>
                  <span class="stage-metric-value">{{ selectedItem.compressedDimensions }}</span>
                </div>
                <div v-if="selectedItem.ratioText" class="stage-metric accent">
                  <span class="stage-metric-label">比例</span>
                  <span class="stage-metric-value">{{ selectedItem.ratioText }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="compare-browser-stage-body">
            <ImageOverlayCompare
              :mode="currentMode"
              :left-image="selectedItem.leftImage"
              :right-image="selectedItem.rightImage"
              :left-label="selectedItem.leftLabel || '原图'"
              :right-label="selectedItem.rightLabel || '新图'"
            />
          </div>
        </template>
      </section>
    </div>

    <template #footer>
      <div class="compare-browser-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ImageOverlayCompare from './ImageOverlayCompare.vue'

export interface CompareBrowserItem {
  id: string
  title: string
  subtitle?: string
  leftImage: string
  rightImage: string
  leftLabel?: string
  rightLabel?: string
  originalSize?: string
  compressedSize?: string
  originalDimensions?: string
  compressedDimensions?: string
  ratioText?: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  items: CompareBrowserItem[]
  initialSelectedId?: string
  initialMode?: 'overlay' | 'split'
  title?: string
  subtitle?: string
}>(), {
  initialSelectedId: '',
  initialMode: 'overlay',
  title: '图片对比',
  subtitle: '左侧切换图片，右侧查看原图与新图的层叠或双栏对比',
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const selectedId = ref('')
const currentMode = ref<'overlay' | 'split'>(props.initialMode)

const selectedItem = computed(() => props.items.find((item) => item.id === selectedId.value) || props.items[0] || null)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    currentMode.value = props.initialMode
    selectedId.value = props.initialSelectedId || props.items[0]?.id || ''
  },
)

watch(
  () => props.items,
  (items) => {
    if (!items.some((item) => item.id === selectedId.value)) {
      selectedId.value = items[0]?.id || ''
    }
  },
)

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.compare-browser-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.compare-browser-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.compare-browser-exit {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #3f3f46;
  background: rgba(20, 20, 23, 0.96);
  color: #e4e4e7;
  font-size: 12px;
  font-weight: 600;
  transition: 0.18s ease;
}
.compare-browser-exit:hover {
  border-color: #818cf8;
  color: #fafafa;
}
.compare-browser-title {
  font-size: 18px;
  font-weight: 700;
  color: #fafafa;
}
.compare-browser-subtitle {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #a1a1aa;
}
.compare-browser-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #27272a;
  background: rgba(20, 20, 23, 0.96);
}
.compare-mode-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #a1a1aa;
  font-size: 12px;
  font-weight: 600;
  transition: 0.18s ease;
}
.compare-mode-btn:hover {
  color: #fafafa;
}
.compare-mode-btn.active {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(79, 70, 229, 0.16);
  color: #c7d2fe;
}
.compare-browser-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 132px);
  min-height: 0;
}
.compare-browser-list,
.compare-browser-stage {
  min-height: 0;
  border: 1px solid #27272a;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16, 18, 24, 0.98), rgba(11, 12, 16, 0.98));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
.compare-browser-list {
  padding: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.compare-browser-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid #23242a;
  border-radius: 14px;
  background: rgba(22, 22, 24, 0.72);
  text-align: left;
  transition: 0.18s ease;
}
.compare-browser-item:hover {
  border-color: #3f3f46;
  background: rgba(28, 28, 32, 0.86);
}
.compare-browser-item.active {
  border-color: #818cf8;
  background: rgba(79, 70, 229, 0.12);
  box-shadow: 0 12px 30px rgba(79, 70, 229, 0.12);
}
.compare-browser-item-thumb {
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.compare-browser-item-copy {
  min-width: 0;
}
.compare-browser-item-title {
  color: #fafafa;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}
.compare-browser-item-subtitle {
  margin-top: 4px;
  color: #71717a;
  font-size: 11px;
  line-height: 1.5;
}
.compare-browser-stage {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.compare-browser-stage-head {
  padding: 16px 18px;
  border-bottom: 1px solid #202127;
}
.compare-browser-stage-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.compare-browser-stage-title {
  font-size: 14px;
  font-weight: 600;
  color: #f4f4f5;
}
.compare-browser-stage-subtitle {
  margin-top: 4px;
  color: #71717a;
  font-size: 12px;
  line-height: 1.5;
}
.compare-browser-stage-metrics {
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.stage-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 112px;
  padding: 10px 12px;
  border: 1px solid #23242a;
  border-radius: 12px;
  background: rgba(14, 14, 16, 0.48);
}
.stage-metric.accent {
  border-color: rgba(99, 102, 241, 0.28);
  background: rgba(79, 70, 229, 0.12);
}
.stage-metric-label {
  color: #71717a;
  font-size: 11px;
}
.stage-metric-value {
  color: #f4f4f5;
  font-size: 13px;
  font-weight: 600;
}
.compare-browser-stage-body {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  padding: 16px;
}
.compare-browser-stage-body :deep(.overlay-compare),
.compare-browser-stage-body :deep(.split-compare) {
  width: 100%;
  height: 100%;
}
.compare-browser-footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1180px) {
  .compare-browser-layout {
    grid-template-columns: 1fr;
    height: calc(100vh - 132px);
  }
  .compare-browser-heading,
  .compare-browser-stage-heading {
    flex-direction: column;
  }
  .compare-browser-list,
  .compare-browser-stage {
    min-height: 320px;
  }
}
</style>
