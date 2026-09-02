<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { activeWorkflowName, isWorkflowSwitching } from '@/composables/flow/useFlowCore'
import { useDocumentTitle } from '@/composables/useDocumentTitle'

defineOptions({ name: 'FlowRouteView' })

const FlowLibraryView = defineAsyncComponent(() => import('@/views/FlowLibraryView.vue'))
const FlowView = defineAsyncComponent(() => import('@/views/FlowView.vue'))

const route = useRoute()
const router = useRouter()
const workflowId = computed(() => {
  const value = route.query.workflowId
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
})
const startNew = computed(() => route.query.new === '1')
const performanceNodeCount = computed(() => {
  if (!import.meta.env.DEV) return 0
  const rawValue = Array.isArray(route.query.performanceNodes)
    ? route.query.performanceNodes[0]
    : route.query.performanceNodes
  const value = Number.parseInt(String(rawValue || ''), 10)
  return Number.isFinite(value) ? Math.max(0, Math.min(10000, value)) : 0
})
const showEditor = computed(() => !!workflowId.value || startNew.value || performanceNodeCount.value > 0)
const currentRouteName = computed(() => route.meta.standalone === true ? 'flow-single' : 'flow')
const documentTitle = computed(() => showEditor.value ? activeWorkflowName.value : '')
const standaloneScopeId = computed(() => {
  const value = route.query.scopeCategoryId
  return Array.isArray(value) ? String(value[0] || '') : String(value || '')
})

useDocumentTitle(documentTitle)

function openCanvas(canvasId: string): void {
  if (!canvasId) return
  const scopeQuery = standaloneScopeId.value
    ? { scopeCategoryId: standaloneScopeId.value }
    : {}
  void router.push({ name: currentRouteName.value, query: { workflowId: canvasId, ...scopeQuery } })
}

function openCanvasNewWindow(canvasId: string, categoryId: string): void {
  if (!canvasId) return
  const routeLocation = router.resolve({
    name: 'flow-single',
    query: { scopeCategoryId: categoryId, workflowId: canvasId },
  })
  const targetUrl = new URL(routeLocation.href, window.location.href).href
  window.open(targetUrl, '_blank')
}

watch(workflowId, (nextWorkflowId, previousWorkflowId) => {
  if (nextWorkflowId && previousWorkflowId && nextWorkflowId !== previousWorkflowId) {
    isWorkflowSwitching.value = true
  }
}, { flush: 'sync' })

watch(showEditor, (editorVisible) => {
  if (!editorVisible || route.meta.standalone === true) return
  if (!('categoryId' in route.query) && !('categoryPath' in route.query)) return
  const query = { ...route.query }
  delete query.categoryId
  delete query.categoryPath
  void router.replace({ name: currentRouteName.value, query })
}, { immediate: true })
</script>

<template>
  <section class="flow-route-page">
    <div class="flow-route-content">
      <FlowLibraryView
        :active-canvas-id="workflowId"
        :editor-active="showEditor"
        @open-canvas="openCanvas"
        @open-canvas-new-window="openCanvasNewWindow"
      >
        <template #editor>
          <FlowView
            v-if="showEditor"
            :key="workflowId || 'new'"
            :initial-workflow-id="workflowId"
            :start-new="startNew"
            :performance-node-count="performanceNodeCount"
          />
        </template>
      </FlowLibraryView>
    </div>
  </section>
</template>

<style scoped>
.flow-route-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base, #0b0c0f);
}

.flow-route-content {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.flow-route-content > :deep(.flow-library-page) {
  width: 100%;
  height: 100%;
}
</style>
