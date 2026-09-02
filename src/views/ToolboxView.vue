<script setup lang="ts">
import { defineAsyncComponent, ref, provide, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'

const ThreeDModelView = defineAsyncComponent(() => import('@/views/Director3DView.vue'))
const PBRView = defineAsyncComponent(() => import('@/views/PBRView.vue'))

provide('toolboxBack', backToList)

interface ToolItem {
  id: string
  label: string
  desc: string
  icon: string
  disabled?: boolean
}

interface ToolGroup {
  name: string
  tools: ToolItem[]
}

const groups: ToolGroup[] = [
  {
    name: '3D',
    tools: [
      { id: '3d-viewer', label: '3D 查看器', desc: '查看 GLB / glTF 模型', icon: 'lucide:box' },
      { id: '3d-texture', label: '3D 贴图', desc: 'PBR 材质贴图生成', icon: 'lucide:grid-2x2' },
    ],
  },
]

const route = useRoute()
const router = useRouter()
const activeToolId = ref<string | null>(null)

function resolveToolId(value: unknown): string | null {
  if (value === '3d-viewer' || value === '3d-texture') {
    return value
  }
  return null
}

function openTool(tool: ToolItem) {
  if (tool.disabled) return
  activeToolId.value = tool.id
  void router.replace({ path: '/toolbox', query: { tool: tool.id } })
}

function backToList() {
  activeToolId.value = null
  if (route.query.tool) {
    void router.replace({ path: '/toolbox' })
  }
}

watch(
  () => route.query.tool,
  (tool) => {
    activeToolId.value = resolveToolId(tool)
  },
  { immediate: true },
)
</script>

<template>
  <div class="toolbox-view">
    <template v-if="activeToolId === '3d-viewer'">
      <ThreeDModelView />
      <button class="exit-btn" @click="backToList">
        &times;
      </button>
    </template>
    <PBRView v-else-if="activeToolId === '3d-texture'" />
    <template v-else>
      <div class="toolbox-header">
        <h1 class="toolbox-title">工具箱</h1>
      </div>

      <div
        v-for="group in groups"
        :key="group.name"
        class="tool-group"
      >
        <div class="tool-list">
          <button
            v-for="tool in group.tools"
            :key="tool.id"
            class="tool-item"
            :disabled="tool.disabled"
            @click="openTool(tool)"
          >
            <span class="tool-visual" aria-hidden="true">
              <Icon :icon="tool.icon" />
            </span>
            <span class="tool-copy">
              <span class="tool-label">{{ tool.label }}</span>
              <span class="tool-desc">{{ tool.desc }}</span>
            </span>
            <span class="tool-arrow">
              <Icon icon="lucide:arrow-right" />
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@import './ToolboxView.css';
</style>
