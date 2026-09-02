<script setup lang="ts">
import ImageCompressDialog from './ImageCompressDialog.vue'
import { dialogState, resolveDialog } from '@/utils/imageCompressDialogService'

function onUpdateVisible(value: boolean) {
  if (value) return // 打开由 service 控制，忽略外部 true
  resolveDialog(null)
}

function onConfirm(files: File[]) {
  resolveDialog(Array.isArray(files) ? files : [])
}

function onCancel() {
  resolveDialog(null)
}
</script>

<template>
  <ImageCompressDialog
    :visible="dialogState.visible"
    :files="dialogState.files"
    @update:visible="onUpdateVisible"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>
