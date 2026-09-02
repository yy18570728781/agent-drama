<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';

interface OutlineNode {
  isGroup: boolean;
  id: string;
  name: string;
  type: 'group' | 'camera' | 'mannequin' | 'image' | 'light' | 'ground';
  visible?: boolean;
  childrenCount?: number;
  depth: number;
  locked?: boolean;
}

const props = defineProps<{
  node: OutlineNode;
  selectedElementIds: string[];
  selectedElementId: string | null;
  renamingId: string | null;
  renamingValue: string;
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleCollapse', id: string): void;
  (e: 'selectNode', event: MouseEvent, node: OutlineNode): void;
  (e: 'contextNode', event: MouseEvent, node: OutlineNode): void;
  (e: 'startRename', event: MouseEvent | null, node: OutlineNode): void;
  (e: 'saveRename', node: OutlineNode): void;
  (e: 'toggleVisibility', node: OutlineNode): void;
  (e: 'deleteItem', node: OutlineNode): void;
  (e: 'updateCameraLock', id: string, locked: boolean): void;
  (e: 'dragStart', event: DragEvent, nodeId: string, nodeType: string): void;
  (e: 'dragOver', event: DragEvent): void;
  (e: 'dropOnFolder', event: DragEvent, folderId: string): void;
  (e: 'dropOnItem', event: DragEvent, targetId: string, nodeType: string): void;
  (e: 'updateRenamingValue', val: string): void;
}>();

const renameInputRef = ref<HTMLInputElement | null>(null);

watch(() => props.renamingId, (newId) => {
  if (newId === props.node.id) {
    nextTick(() => {
      if (renameInputRef.value) {
        renameInputRef.value.focus();
        renameInputRef.value.select();
      }
    });
  }
});

function onRenameInput(e: Event) {
  emit('updateRenamingValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div
    :draggable="node.type !== 'ground'"
    @dragstart="emit('dragStart', $event, node.id, node.type)"
    @dragover="emit('dragOver', $event)"
    @drop="node.isGroup ? emit('dropOnFolder', $event, node.id) : emit('dropOnItem', $event, node.id, node.type)"
    @contextmenu.prevent="emit('contextNode', $event, node)"
    @click="emit('selectNode', $event, node)"
    :class="[
      'group relative flex items-center h-7 px-3 border border-transparent select-none cursor-pointer transition-colors outline-none',
      selectedElementIds.includes(node.id)
        ? 'bg-[#1e2330] text-white border-[#ffffff]/5 font-medium'
        : 'text-gray-400 hover:bg-[#14171d] hover:text-white',
      node.depth > 0 ? 'pl-8' : '',
      !node.isGroup && node.visible === false ? 'opacity-40' : ''
    ]"
    :id="`outline-node-${node.id}`"
  >
    <!-- Left indentation spacer line -->
    <div v-if="node.depth > 0" class="absolute left-4 top-0 bottom-0 w-px bg-white/5" />

    <!-- Group Drawer Fold State Chevron -->
    <div
      v-if="node.isGroup"
      role="button"
      tabindex="0"
      @click.stop="emit('toggleCollapse', node.id)"
      @keydown.enter.prevent.stop="emit('toggleCollapse', node.id)"
      @keydown.space.prevent.stop="emit('toggleCollapse', node.id)"
      class="p-0.5 -ml-1 text-gray-500 hover:text-white shrink-0 cursor-pointer"
      :id="`btn-collapse-${node.id}`"
    >
      <Icon icon="lucide:chevron-down" v-if="!isCollapsed" :width="11" :height="11" />
      <Icon icon="lucide:chevron-right" v-else :width="11" :height="11" />
    </div>
    <div v-else class="w-3.5 shrink-0" />

    <!-- Node Icon Type representations -->
    <span class="mr-1.5 shrink-0 text-gray-500">
      <Icon icon="lucide:folder-open" v-if="node.isGroup && !isCollapsed" :width="11.5" :height="11.5" class="text-amber-400/80" />
      <Icon icon="lucide:folder" v-else-if="node.isGroup" :width="11.5" :height="11.5" class="text-amber-500/80" />
      <Icon icon="lucide:camera" v-else-if="node.type === 'camera'" :width="11.5" :height="11.5" class="text-sky-400/80" />
      <Icon icon="lucide:user" v-else-if="node.type === 'mannequin'" :width="11.5" :height="11.5" class="text-teal-400/80" />
      <Icon icon="lucide:image" v-else-if="node.type === 'image'" :width="11.5" :height="11.5" class="text-rose-400/80" />
      <Icon icon="lucide:sun" v-else-if="node.type === 'light'" :width="11.5" :height="11.5" class="text-yellow-400/80" />
      <Icon icon="lucide:grid" v-else-if="node.type === 'ground'" :width="11.5" :height="11.5" class="text-indigo-400/80" />
    </span>

    <!-- Node Identity Label or Inline Renaming Field -->
    <div class="flex-grow min-w-0 pr-1 text-[11px] font-sans">
      <input
        v-if="renamingId === node.id"
        ref="renameInputRef"
        type="text"
        :value="renamingValue"
        @input="onRenameInput"
        @blur="emit('saveRename', node)"
        @keydown.enter.stop="emit('saveRename', node)"
        @keydown.escape.stop="emit('startRename', null, node)"
        class="w-full bg-black/60 border border-blue-500 rounded px-1 text-[10.5px] text-white focus:outline-none focus:ring-0 font-sans h-[18px]"
      />
      <div v-else class="flex items-center gap-1.5 min-w-0">
        <span class="truncate" :title="node.name">{{ node.name }}</span>
        <span v-if="node.isGroup" class="text-[7.5px] font-mono text-gray-600 font-normal">
          ({{ node.childrenCount ?? 0 }} 项)
        </span>
      </div>
    </div>

    <!-- Quick Lock indicator on Camera objects -->
    <div
      v-if="node.type === 'camera'"
      role="button"
      tabindex="0"
      @click.stop="emit('updateCameraLock', node.id, !node.locked)"
      @keydown.enter.prevent.stop="emit('updateCameraLock', node.id, !node.locked)"
      @keydown.space.prevent.stop="emit('updateCameraLock', node.id, !node.locked)"
      :class="[
        'p-1 shrink-0 transition-opacity ml-1.5 cursor-pointer rounded',
        node.locked
          ? 'text-amber-500 opacity-100 bg-amber-500/10 border border-amber-500/20'
          : 'text-gray-500 opacity-0 group-hover:opacity-100 hover:text-white'
      ]"
      :title="node.locked ? '已被锁定 - 点击解除视角锁定' : '点击锁定镜头视角'"
    >
      <Icon icon="lucide:lock" v-if="node.locked" :width="11" :height="11" class="animate-pulse" />
      <Icon icon="lucide:unlock" v-else :width="11" :height="11" />
    </div>

    <!-- Hover Quick Row Actions -->
    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
      <div
        v-if="node.type !== 'ground'"
        role="button"
        tabindex="0"
        @click="emit('startRename', $event, node)"
        @keydown.enter.prevent="emit('startRename', null, node)"
        @keydown.space.prevent="emit('startRename', null, node)"
        class="p-1 text-gray-500 hover:text-white transition-colors cursor-pointer"
        title="重命名"
      >
        <Icon icon="lucide:edit-3" :width="11" :height="11" />
      </div>
      
      <div
        v-if="!node.isGroup"
        role="button"
        tabindex="0"
        @click.stop="emit('toggleVisibility', node)"
        @keydown.enter.prevent.stop="emit('toggleVisibility', node)"
        @keydown.space.prevent.stop="emit('toggleVisibility', node)"
        class="p-1 text-gray-500 hover:text-white transition-colors cursor-pointer"
        :title="node.visible ? '隐藏' : '显示'"
      >
        <Icon icon="lucide:eye" v-if="node.visible" :width="11" :height="11" />
        <Icon icon="lucide:eye-off" v-else :width="11" :height="11" />
      </div>

      <div
        v-if="node.type !== 'ground'"
        role="button"
        tabindex="0"
        @click.stop="emit('deleteItem', node)"
        @keydown.enter.prevent.stop="emit('deleteItem', node)"
        @keydown.space.prevent.stop="emit('deleteItem', node)"
        class="p-1 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
        :title="node.isGroup ? '解散此分组' : '删除该对象'"
      >
        <Icon icon="lucide:trash-2" :width="11" />
      </div>
    </div>
  </div>
</template>
