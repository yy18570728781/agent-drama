<script setup lang="ts">
import { inject } from 'vue'
defineOptions({ name: 'PBRView' })
import PBRGeneratorWindow from '@/components/pbr/PBRGeneratorWindow.vue'

const toolboxBack = inject<() => void>('toolboxBack')
</script>

<template>
  <div class="w-full h-full">
    <PBRGeneratorWindow :back-to="toolboxBack" />
  </div>
</template>
