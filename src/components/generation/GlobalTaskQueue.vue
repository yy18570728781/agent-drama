<script setup lang="ts">
import type { QueueTask } from '@/stores/task-queue'
import type {
  GlobalTaskQueueTab,
  GlobalTaskQueueTriggerHandle,
} from './globalTaskQueue.types'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Minus, Trash2 } from '@/components/common/icon/lucide'
import { useGlobalTaskQueueIndicator } from '@/composables/generation/useGlobalTaskQueueIndicator'
import { useGenerationStore } from '@/stores/generation.store'
import { useTaskQueueStore } from '@/stores/task-queue'
import GlobalTaskQueueTrigger from './GlobalTaskQueueTrigger.vue'
import TaskQueueCard from './TaskQueueCard.vue'

const store = useTaskQueueStore()
const generationStore = useGenerationStore()
const { indicatorCount, indicatorLabel, indicatorState } = useGlobalTaskQueueIndicator()

const expanded = ref(false)
const activeTab = ref<GlobalTaskQueueTab>('waiting_submit')
const triggerRef = ref<GlobalTaskQueueTriggerHandle | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const pendingSubmitTasks = computed<QueueTask[]>(() => store.tasks.filter(
  (task: QueueTask): boolean => task.status === 'waiting_submit',
))
const queuedTasks = computed<QueueTask[]>(() => store.tasks.filter(
  (task: QueueTask): boolean => task.status === 'queued',
))
const generatingTasks = computed<QueueTask[]>(() => store.tasks.filter(
  (task: QueueTask): boolean => task.status === 'running',
))
const errorTasks = computed<QueueTask[]>(() => store.tasks.filter(
  (task: QueueTask): boolean => task.status === 'failed' || task.status === 'cancelled',
))

function selectRelevantTab(): void {
  if (errorTasks.value.length > 0) activeTab.value = 'failed'
  else if (generatingTasks.value.length > 0) activeTab.value = 'running'
  else if (pendingSubmitTasks.value.length > 0) activeTab.value = 'waiting_submit'
  else if (queuedTasks.value.length > 0) activeTab.value = 'queued'
}

async function togglePanel(): Promise<void> {
  if (expanded.value) {
    expanded.value = false
    return
  }
  selectRelevantTab()
  expanded.value = true
  await nextTick()
  panelRef.value?.focus()
}

async function closePanel(restoreFocus: boolean): Promise<void> {
  if (!expanded.value) return
  expanded.value = false
  if (!restoreFocus) return
  await nextTick()
  triggerRef.value?.focus()
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!expanded.value || !(event.target instanceof Node)) return
  if (panelRef.value?.contains(event.target) || triggerRef.value?.contains(event.target)) return
  void closePanel(false)
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.key !== 'Escape' || !expanded.value) return
  event.preventDefault()
  void closePanel(true)
}

function onRetry(task: QueueTask): void {
  store.removeTask(task.id)
  if (!task.prompt) return
  generationStore.setPendingEdit({
    prompt: task.prompt,
    modelId: task.modelInfo,
    capability: task.genType,
    autoSend: true,
  })
}

watch(
  (): number => store.tasks.length,
  async (): Promise<void> => {
    await nextTick()
    listRef.value?.scrollTo({ top: 0, behavior: 'auto' })
  },
)

onMounted((): void => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  store.restoreRunningTasks()
})

onUnmounted((): void => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <GlobalTaskQueueTrigger
    ref="triggerRef"
    :count="indicatorCount"
    :expanded="expanded"
    :label="indicatorLabel"
    :state="indicatorState"
    @toggle="togglePanel"
  />

  <Teleport to="#app">
    <div class="gtq-drawer-viewport">
      <Transition name="gtq-drawer">
        <section
          v-if="expanded"
          id="global-task-queue-panel"
          ref="panelRef"
          class="gtq-panel"
          role="region"
          aria-label="生成队列"
          tabindex="-1"
        >
          <header class="gtq-panel-header">
            <strong class="gtq-panel-title">生成队列</strong>
            <div class="gtq-panel-actions">
              <button
                v-if="activeTab === 'failed' && errorTasks.length > 0"
                class="gtq-clear-btn"
                type="button"
                title="清除所有失败"
                aria-label="清除所有失败任务"
                @click="store.clearErrors()"
              >
                <Trash2 :size="14" />
              </button>
              <button
                class="gtq-close-btn"
                type="button"
                title="收起"
                aria-label="收起生成队列"
                @click="closePanel(true)"
              >
                <Minus :size="14" />
              </button>
            </div>
          </header>

          <div class="gtq-tabs" role="group" aria-label="任务状态">
            <button class="gtq-tab" :class="{ active: activeTab === 'waiting_submit' }" type="button" :aria-pressed="activeTab === 'waiting_submit'" @click="activeTab = 'waiting_submit'">
              等待提交<span v-if="pendingSubmitTasks.length > 0" class="gtq-tab-count pending">{{ pendingSubmitTasks.length }}</span>
            </button>
            <button class="gtq-tab" :class="{ active: activeTab === 'queued' }" type="button" :aria-pressed="activeTab === 'queued'" @click="activeTab = 'queued'">
              排队中<span v-if="queuedTasks.length > 0" class="gtq-tab-count queued">{{ queuedTasks.length }}</span>
            </button>
            <button class="gtq-tab" :class="{ active: activeTab === 'running' }" type="button" :aria-pressed="activeTab === 'running'" @click="activeTab = 'running'">
              生成中<span v-if="generatingTasks.length > 0" class="gtq-tab-count generating">{{ generatingTasks.length }}</span>
            </button>
            <button class="gtq-tab" :class="{ active: activeTab === 'failed' }" type="button" :aria-pressed="activeTab === 'failed'" @click="activeTab = 'failed'">
              失败<span v-if="errorTasks.length > 0" class="gtq-tab-count error">{{ errorTasks.length }}</span>
            </button>
          </div>

          <div ref="listRef" class="gtq-panel-list custom-scrollbar">
            <template v-if="activeTab === 'waiting_submit'">
              <div v-if="pendingSubmitTasks.length === 0" class="gtq-empty">暂无等待提交的任务</div>
              <TransitionGroup name="gtq-task-list" tag="div" class="gtq-task-group">
                <TaskQueueCard v-for="task in pendingSubmitTasks" :key="task.id" :task="task" compact @cancel="store.cancelTask($event)" @dismiss="store.removeTask($event)" />
              </TransitionGroup>
            </template>
            <template v-if="activeTab === 'queued'">
              <div v-if="queuedTasks.length === 0" class="gtq-empty">暂无排队中的任务</div>
              <TransitionGroup name="gtq-task-list" tag="div" class="gtq-task-group">
                <TaskQueueCard v-for="task in queuedTasks" :key="task.id" :task="task" compact @cancel="store.cancelTask($event)" @dismiss="store.removeTask($event)" />
              </TransitionGroup>
            </template>
            <template v-if="activeTab === 'running'">
              <div v-if="generatingTasks.length === 0" class="gtq-empty">暂无生成中的任务</div>
              <TransitionGroup name="gtq-task-list" tag="div" class="gtq-task-group">
                <TaskQueueCard v-for="task in generatingTasks" :key="task.id" :task="task" @cancel="store.cancelTask($event)" @dismiss="store.removeTask($event)" />
              </TransitionGroup>
            </template>
            <template v-if="activeTab === 'failed'">
              <div v-if="errorTasks.length === 0" class="gtq-empty">暂无失败任务</div>
              <TransitionGroup name="gtq-task-list" tag="div" class="gtq-task-group">
                <TaskQueueCard v-for="task in errorTasks" :key="task.id" :task="task" @retry="onRetry($event)" @dismiss="store.removeTask($event)" />
              </TransitionGroup>
            </template>
          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped src="./GlobalTaskQueue.scss"></style>
