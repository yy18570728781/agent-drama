<script setup lang="ts">
import { ref } from 'vue'
import SubjectDetailEditor from '@/components/subjects/SubjectDetailEditor.vue'

interface SubjectDetailEditorExpose {
  canClose: () => boolean
}

defineProps<{ visible: boolean; subjectId: string | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const editorRef = ref<SubjectDetailEditorExpose | null>(null)

function close(): void {
  if (editorRef.value && !editorRef.value.canClose()) return
  emit('saved')
  emit('update:visible', false)
}

function handleDeleted(): void {
  emit('saved')
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="subject-edit-dialog-fade">
      <div v-if="visible && subjectId" class="subject-edit-dialog-overlay" @click.self="close">
        <section class="subject-edit-dialog" role="dialog" aria-modal="true" aria-label="编辑主体">
          <SubjectDetailEditor
            :key="subjectId"
            ref="editorRef"
            :subject-id="subjectId"
            dialog
            @back="close"
            @deleted="handleDeleted"
          />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped src="./SubjectEditDialog.scss"></style>
