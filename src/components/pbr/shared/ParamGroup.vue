<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  title: string
  defaultOpen?: boolean
}>()

const emit = defineEmits<{
  reset: []
}>()

const isOpen = ref(props.defaultOpen !== false)
</script>

<template>
  <div class="border border-zinc-800/60 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2 bg-zinc-900/60 cursor-pointer select-none hover:bg-zinc-800/60 transition-colors"
      @click="isOpen = !isOpen">
      <div class="flex items-center gap-2">
        <Icon :icon="isOpen ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="w-3.5 h-3.5 text-zinc-500" />
        <span class="text-[11px] font-bold text-zinc-300 tracking-wide">{{ title }}</span>
      </div>
      <button @click.stop="emit('reset')" title="重置本组参数"
        class="text-zinc-600 hover:text-indigo-400 transition-colors p-0.5">
        <Icon icon="lucide:refresh-ccw" class="w-3 h-3" />
      </button>
    </div>
    <div v-show="isOpen" class="px-3 py-3 space-y-3">
      <slot />
    </div>
  </div>
</template>
