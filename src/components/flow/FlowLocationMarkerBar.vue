<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { MapPin } from '@/components/common/icon/lucide'
import type { LocationMarkerItem } from '@/composables/flow/useLocationMarkerNavigator'

const props = defineProps<{
  items: LocationMarkerItem[]
  expanded: boolean
}>()

const emit = defineEmits<{
  'update:expanded': [value: boolean]
  select: [id: string]
}>()

const rootRef = ref<HTMLElement | null>(null)

function toggleExpanded(): void {
  emit('update:expanded', !props.expanded)
}

function handleSelect(id: string): void {
  emit('select', id)
}

function onDocumentClick(e: MouseEvent): void {
  if (!props.expanded) return
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    emit('update:expanded', false)
  }
}

watch(
  () => props.expanded,
  async (open) => {
    if (open) {
      await nextTick()
      document.addEventListener('click', onDocumentClick, true)
    } else {
      document.removeEventListener('click', onDocumentClick, true)
    }
  },
)

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
})
</script>

<template>
  <div ref="rootRef" class="location-marker-bar relative flex items-center">
    <button
      class="marker-toggle-btn"
      :class="{ 'marker-toggle-btn-active': expanded }"
      :title="`位置标记 (${items.length})`"
      @click.stop="toggleExpanded"
    >
      <MapPin class="w-4 h-4" />
      <span v-if="items.length" class="marker-badge">{{ items.length }}</span>
    </button>

    <Transition name="marker-pop">
      <div v-if="expanded && items.length" class="marker-popover">
        <button
          v-for="(item, index) in items"
          :key="item.id"
          class="marker-pill"
          :title="`${item.label} (${Math.round(item.x)}, ${Math.round(item.y)})`"
          @click.stop="handleSelect(item.id)"
        >
          <span class="marker-pill-dot" />
          <span class="marker-pill-label">标记{{ index + 1 }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.marker-toggle-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #a1a1aa;
}

.marker-toggle-btn:hover {
  color: #fff;
  background: #27272a;
}

.marker-toggle-btn-active {
  color: #fb923c;
  background: #3f3f46;
}

.marker-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 9999px;
  background: #fb923c;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  pointer-events: none;
}

.marker-popover {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 9999px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  max-width: calc(100vw - 200px);
  overflow-x: auto;
  z-index: 20;
}

.marker-popover::-webkit-scrollbar {
  height: 4px;
}

.marker-popover::-webkit-scrollbar-track {
  background: transparent;
}

.marker-popover::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 9999px;
}

.marker-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 9999px;
  background: #27272a;
  border: 1px solid transparent;
  color: #d4d4d8;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.marker-pill:hover {
  background: #3f3f46;
  border-color: rgba(251, 146, 60, 0.5);
  color: #fb923c;
}

.marker-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fb923c;
  flex-shrink: 0;
}

.marker-pill-label {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.marker-pop-enter-active {
  transition: opacity 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
              transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.marker-pop-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.6, 1),
              transform 0.2s cubic-bezier(0.4, 0, 0.6, 1);
}

.marker-pop-enter-from,
.marker-pop-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(12px) scale(0.85);
}
</style>
