<script setup lang="ts">
import './FlowTabCloseDialog.scss'

defineOptions({ name: 'FlowTabCloseDialog' })

withDefaults(defineProps<{
  confirmLabel?: string
  message: string
  secondaryLabel?: string
  title: string
  visible: boolean
}>(), {
  confirmLabel: '确定',
  secondaryLabel: '',
})

const emit = defineEmits<{
  cancel: []
  confirm: []
  secondary: []
}>()
</script>

<template>
  <Transition name="flow-tab-close-fade">
    <div v-if="visible" class="flow-tab-close-overlay" @click.self="emit('cancel')">
      <section class="flow-tab-close-dialog" role="dialog" aria-modal="true" :aria-label="title">
        <header>{{ title }}</header>
        <p>{{ message }}</p>
        <footer>
          <button class="cancel" type="button" @click="emit('cancel')">取消</button>
          <button
            v-if="secondaryLabel"
            class="secondary"
            type="button"
            @click="emit('secondary')"
          >
            {{ secondaryLabel }}
          </button>
          <button class="confirm" type="button" @click="emit('confirm')">{{ confirmLabel }}</button>
        </footer>
      </section>
    </div>
  </Transition>
</template>
