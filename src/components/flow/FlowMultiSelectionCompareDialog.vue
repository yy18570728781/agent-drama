<template>
  <el-dialog
    :model-value="visible"
    fullscreen
    destroy-on-close
    class="flow-multi-compare-dialog"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <template #header>
      <div class="flow-multi-compare-dialog__header">
        <div>
          <div class="flow-multi-compare-dialog__title">{{ title }}</div>
          <div class="flow-multi-compare-dialog__subtitle">{{ subtitle }}</div>
        </div>
        <div class="flow-multi-compare-dialog__toolbar">
          <button type="button" class="toolbar-btn" :class="{ active: compareType === 'split' }" @click="compareType = 'split'">双栏</button>
          <button type="button" class="toolbar-btn" :class="{ active: compareType === 'overlay' }" @click="compareType = 'overlay'">层叠</button>
        </div>
      </div>
    </template>

    <div class="flow-multi-compare-dialog__body">
      <aside class="flow-multi-compare-dialog__rail">
        <div class="rail-row">
          <div class="rail-row__list">
            <button
              v-for="item in items"
              :key="`left-${item.id}`"
              type="button"
              class="rail-item"
              :class="{ active: item.id === leftId }"
              @click="selectLeft(item.id)"
            >
              <img :src="item.image" alt="" draggable="false" />
              <span class="rail-item__label">{{ item.title }}</span>
            </button>
          </div>
        </div>
        <div class="rail-row">
          <div class="rail-row__list">
            <button
              v-for="item in items"
              :key="`right-${item.id}`"
              type="button"
              class="rail-item"
              :class="{ active: item.id === rightId }"
              @click="selectRight(item.id)"
            >
              <img :src="item.image" alt="" draggable="false" />
              <span class="rail-item__label">{{ item.title }}</span>
            </button>
          </div>
        </div>
      </aside>

      <section class="flow-multi-compare-dialog__stage">
        <div class="flow-multi-compare-dialog__surface">
          <MediaCompareStage
            v-if="leftItem && rightItem && leftItem.id !== rightItem.id"
            :images="stageImages"
            :current-index="1"
            :display-image="rightItem.image"
            :compare-mode="true"
            :compare-type="compareType"
            :has-compare="true"
            :compare-left-image="leftItem.image"
            :compare-right-image="rightItem.image"
            :compare-left-label="leftItem.label || leftItem.title"
            :compare-right-label="rightItem.label || rightItem.title"
            :show-thumbnails="false"
            @enable-compare="compareType = $event"
            @disable-compare="compareType = 'overlay'"
          />

          <div v-else class="flow-multi-compare-dialog__empty">
            请选择左右两张图片开始对比
          </div>
        </div>
      </section>

    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MediaCompareStage from '@/components/common/MediaCompareStage.vue'

export interface CompareSelectionItem {
  id: string
  title: string
  subtitle?: string
  image: string
  label?: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  items: CompareSelectionItem[]
  title?: string
  subtitle?: string
}>(), {
  title: '图片对比',
  subtitle: '左侧选基准，右侧选对比',
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const compareType = ref<'split' | 'overlay'>('overlay')
const leftId = ref('')
const rightId = ref('')

const leftItem = computed(() => props.items.find((item) => item.id === leftId.value) || null)
const rightItem = computed(() => props.items.find((item) => item.id === rightId.value) || null)
const stageImages = computed(() => [leftItem.value?.image || '', rightItem.value?.image || ''].filter(Boolean))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    syncSelection()
  },
  { immediate: true },
)

watch(
  () => props.items,
  () => {
    if (!props.visible) return
    syncSelection()
  },
  { deep: true },
)

function syncSelection(): void {
  compareType.value = 'overlay'
  leftId.value = props.items[0]?.id || ''
  rightId.value = props.items[1]?.id || props.items[0]?.id || ''
}

function selectLeft(id: string): void {
  if (id === rightId.value) return
  leftId.value = id
}

function selectRight(id: string): void {
  if (id === leftId.value) return
  rightId.value = id
}

function handleClose(): void {
  emit('update:visible', false)
}
</script>

<style scoped>
.flow-multi-compare-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.flow-multi-compare-dialog__title {
  font-size: 18px;
  font-weight: 700;
  color: #fafafa;
}
.flow-multi-compare-dialog__subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: #a1a1aa;
}
.flow-multi-compare-dialog__toolbar {
  display: inline-flex;
  gap: 8px;
  padding: 4px;
  border: 1px solid #27272a;
  border-radius: 12px;
  background: rgba(20, 20, 23, 0.96);
}
.toolbar-btn {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  color: #a1a1aa;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
}
.toolbar-btn.active {
  background: rgba(79, 70, 229, 0.16);
  color: #c7d2fe;
}
.flow-multi-compare-dialog__body {
  display: grid;
  grid-template-columns: fit-content(320px) minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 132px);
  min-height: 0;
}
.flow-multi-compare-dialog__rail,
.flow-multi-compare-dialog__stage {
  min-height: 0;
  border: 1px solid #27272a;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16, 18, 24, 0.98), rgba(11, 12, 16, 0.98));
}
.flow-multi-compare-dialog__rail {
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  overflow-y: auto;
  align-content: start;
  justify-items: start;
  width: fit-content;
  max-width: 280px;
}
.rail-row {
  min-width: 0;
  display: grid;
  gap: 4px;
  justify-items: start;
}
.rail-row__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding-bottom: 0;
}
.rail-item {
  width: 100%;
  height: 84px;
  padding: 0;
  overflow: hidden;
  border: 2px solid #3f3f46;
  border-radius: 10px;
  background: #09090b;
  opacity: 0.66;
  position: relative;
}
.rail-item.active {
  opacity: 1;
  border-color: #22d3ee;
}
.rail-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.rail-item__label {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  padding: 4px 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #f4f4f5;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flow-multi-compare-dialog__stage {
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.flow-multi-compare-dialog__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #71717a;
  font-size: 12px;
}
.flow-multi-compare-dialog__surface {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
