<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  searchQuery: string;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  (e: 'updateSearchQuery', value: string): void;
  (e: 'createEmptyFolder'): void;
  (e: 'groupSelected'): void;
  (e: 'ungroupSelected'): void;
}>();

function onInput(e: Event) {
  emit('updateSearchQuery', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="p-3 pb-2 border-b border-[#ffffff]/5 space-y-2 flex-shrink-0" id="outline-toolbar-root">
    <!-- Search Row -->
    <div class="relative w-full" id="outline-search-container">
      <span class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-500">
        <Icon icon="lucide:search" :width="11" />
      </span>
      <input
        type="text"
        :value="searchQuery"
        @input="onInput"
        placeholder="搜索场景节点或阵列..."
        class="w-full pl-7 pr-3 py-1 bg-black/40 border border-[#ffffff]/5 rounded text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors font-sans"
        id="outline-search-input"
      />
    </div>

    <!-- Multi-select Action Panel -->
    <div class="flex items-center justify-between pt-1" id="outline-action-panel">
      <span class="text-[9px] text-gray-500 font-mono tracking-wider uppercase">排队大纲树</span>
      <div class="flex items-center gap-1.5" id="outline-action-buttons">
        <!-- New Folder -->
        <button
          @click="emit('createEmptyFolder')"
          class="p-1 rounded bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer"
          title="新建空白分组文件夹"
          id="btn-outline-create-folder"
        >
          <Icon icon="lucide:folder-plus" :width="10.5" />
        </button>

        <!-- Group Members -->
        <button
          @click="emit('groupSelected')"
          :disabled="!hasSelection"
          class="p-1 rounded bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          title="将已选项打包至新建组合"
          id="btn-outline-group"
        >
          <Icon icon="lucide:component" :width="10.5" />
        </button>

        <!-- Ungroup Members -->
        <button
          @click="emit('ungroupSelected')"
          :disabled="!hasSelection"
          class="p-1 rounded bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          title="将已选项移出所在组合"
          id="btn-outline-ungroup"
        >
          <Icon icon="lucide:folder-minus" :width="10.5" />
        </button>
      </div>
    </div>
  </div>
</template>
