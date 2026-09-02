<template>
  <div class="subgraph-node-shell">
    <div v-if="showNodeTitle" class="subgraph-node__title-wrap">
      <span v-if="!isEditing" class="subgraph-node__title" @dblclick.stop.prevent="startEditing">
        {{ title }}
      </span>
      <input
        v-else
        ref="titleInputRef"
        v-model="editableTitle"
        class="subgraph-node__title-input"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        @keydown.stop
        @mousedown.stop
        @pointerdown.stop
      />
    </div>
    <div class="subgraph-node">
      <div class="subgraph-node__summary">
        <span class="subgraph-node__count-value">{{ nodeCountText }}</span>
        <button
          class="subgraph-node__action-btn"
          type="button"
          @click.stop="handleDissolve"
          @mousedown.stop
          @pointerdown.stop
        >
          解散
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import { useTheme } from '@/styles/theme/composables/useTheme'

const props = defineProps({
  id: { type: String, default: '' },
  data: { type: Object, default: () => ({}) },
})

const requestDissolveSubgraph = inject('flowDissolveSubgraph', null)
const requestRenameSubgraph = inject('flowRenameSubgraph', null)
const { showNodeTitle } = useTheme()

const title = computed(() => props.data?.label || '子图')
const isEditing = ref(false)
const editableTitle = ref(props.data?.label || '子图')
const titleInputRef = ref(null)

const nodeCountText = computed(() => {
  const count = Number(props.data?.nodeCount || 0) || 0
  return `${count} 个节点`
})

watch(() => props.data?.label, (nextValue) => {
  editableTitle.value = nextValue || '子图'
})

function startEditing() {
  isEditing.value = true
  nextTick(() => {
    const input = titleInputRef.value
    if (!input) return
    input.focus()
    input.select()
  })
}

function saveTitle() {
  const nextTitle = String(editableTitle.value || '').trim() || '子图'
  const previousTitle = String(props.data?.label || '').trim() || '子图'
  editableTitle.value = nextTitle
  if (props.data) props.data.label = nextTitle
  requestRenameSubgraph?.({
    nodeId: props.id,
    subgraphId: props.data?.subgraphId || '',
    label: nextTitle,
    previousLabel: previousTitle,
  })
  isEditing.value = false
}

function handleDissolve() {
  requestDissolveSubgraph?.({
    nodeId: props.id,
    subgraphId: props.data?.subgraphId || '',
    label: props.data?.label || '子图',
  })
}
</script>

<style scoped src="./SubgraphNode.css"></style>
