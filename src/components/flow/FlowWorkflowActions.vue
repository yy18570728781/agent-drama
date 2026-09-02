<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { FLOW_CANVAS_NAME_MAX_LENGTH } from '@/composables/flow/flowNameValidation'
import './FlowWorkflowActions.scss'

const props = defineProps<{
  showNewWfModal: boolean
  newWfName: string
  newWfModalTitle: string
  pendingJsonImportData: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  (event: 'update:newWfName', value: string): void
  (event: 'confirm-new-wf'): void
  (event: 'cancel-new-wf'): void
}>()

const newWfInputRef = ref<HTMLInputElement | null>(null)

watch(() => props.showNewWfModal, async (visible: boolean) => {
  if (!visible) return
  await nextTick()
  newWfInputRef.value?.focus()
})

defineExpose({ newWfInputRef })
</script>

<template>
  <div class="workflow-actions">
    <div v-if="showNewWfModal" class="workflow-action-wrap">
      <Transition name="workflow-popover">
        <section v-if="showNewWfModal" class="workflow-action-popover workflow-new-popover">
          <header class="workflow-popover-header"><span>{{ newWfModalTitle }}</span></header>
          <div class="workflow-popover-content">
            <input
              ref="newWfInputRef"
              :value="newWfName"
              :maxlength="FLOW_CANVAS_NAME_MAX_LENGTH"
              class="workflow-name-input"
              placeholder="输入工作流名称"
              @input="emit('update:newWfName', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('confirm-new-wf')"
              @keydown.stop
            />
            <div class="workflow-popover-actions">
              <button class="workflow-secondary-btn" type="button" @click="emit('cancel-new-wf')">取消</button>
              <button class="workflow-primary-btn" type="button" @click="emit('confirm-new-wf')">
                {{ pendingJsonImportData ? '导入' : '创建' }}
              </button>
            </div>
          </div>
        </section>
      </Transition>
    </div>
  </div>
</template>
