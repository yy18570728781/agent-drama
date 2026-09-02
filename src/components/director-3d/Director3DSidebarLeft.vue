<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { DirectingProject, MannequinObject, ImagePlaneObject, CameraConfig, LightConfig } from '@/components/director-3d/director3D.types';
import OutlineToolbar from '@/components/director-3d/outline/OutlineToolbar.vue';
import SceneTreeNode from '@/components/director-3d/outline/SceneTreeNode.vue';

const props = defineProps<{
  project: DirectingProject;
  selectedElementId: string | null;
  selectedElementType: string | null;
  selectedElementIds: string[];
}>();

const emit = defineEmits<{
  (e: 'updateSelectedElementIds', value: string[]): void;
  (e: 'selectElement', id: string | null, type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null, isShift?: boolean, isCtrl?: boolean, ids?: string[]): void;
  (e: 'updateMannequin', id: string, data: Partial<MannequinObject>): void;
  (e: 'updateCamera', id: string, data: Partial<CameraConfig>): void;
  (e: 'updateImage', id: string, data: Partial<ImagePlaneObject>): void;
  (e: 'updateLight', id: string, data: Partial<LightConfig>): void;
  (e: 'deleteElement', id: string, type: any): void;
  (e: 'updateProject', proj: DirectingProject): void;
}>();

const searchQuery = ref('');
const lastClickedId = ref<string | null>(null);
const collapsedGroupIds = ref<Record<string, boolean>>({});
const renamingId = ref<string | null>(null);
const renamingValue = ref('');

interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  nodeType?: string;
  isGroup?: boolean;
  nodeName?: string;
}
const contextMenu = ref<ContextMenuState | null>(null);

function handleWindowClick() {
  contextMenu.value = null;
}

onMounted(() => {
  window.addEventListener('click', handleWindowClick);
  window.addEventListener('keydown', handleOutlineKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('click', handleWindowClick);
  window.removeEventListener('keydown', handleOutlineKeyDown);
});

const cameras = computed(() => props.project.cameras.map(c => ({
  id: c.id,
  name: c.name,
  type: 'camera' as const,
  visible: c.visible,
  groupId: c.groupId,
  locked: c.locked,
  raw: c
})));

const mannequins = computed(() => props.project.mannequins.map(m => ({
  id: m.id,
  name: m.name,
  type: 'mannequin' as const,
  visible: m.visible,
  groupId: m.groupId,
  locked: false,
  raw: m
})));

const images = computed(() => props.project.imagePlanes.map(img => ({
  id: img.id,
  name: img.name,
  type: 'image' as const,
  visible: img.visible,
  groupId: img.groupId,
  locked: false,
  raw: img
})));

const lights = computed(() => props.project.lights.map(l => ({
  id: l.id,
  name: l.name,
  type: 'light' as const,
  visible: l.visible !== false,
  groupId: l.groupId,
  locked: false,
  raw: l
})));

const groundItem = computed(() => ({
  id: 'ground',
  name: '3D舞台基底地面',
  type: 'ground' as const,
  visible: props.project.showGrid !== false,
  groupId: undefined as string | undefined,
  locked: false,
  raw: props.project.ground || {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
}));

const allItems = computed(() => [
  ...cameras.value,
  ...mannequins.value,
  ...images.value,
  ...lights.value,
  groundItem.value
]);

const groupsList = computed(() => props.project.groups || []);

const nodesToRender = computed(() => {
  const nodes: Array<{
    isGroup: boolean;
    id: string;
    name: string;
    type: 'group' | 'camera' | 'mannequin' | 'image' | 'light' | 'ground';
    visible?: boolean;
    childrenCount?: number;
    depth: number;
    locked?: boolean;
  }> = [];

  groupsList.value.forEach(group => {
    const groupItems = allItems.value.filter(item => item.groupId === group.id);
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          groupItems.some(item => item.name.toLowerCase().includes(searchQuery.value.toLowerCase()));

    if (!searchQuery.value || matchesSearch) {
      nodes.push({
        isGroup: true,
        id: group.id,
        name: group.name,
        type: 'group',
        childrenCount: groupItems.length,
        depth: 0
      });

      const isCollapsed = collapsedGroupIds.value[group.id];
      if (!isCollapsed) {
        groupItems.forEach(item => {
          if (!searchQuery.value || item.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
            nodes.push({
              isGroup: false,
              id: item.id,
              name: item.name,
              type: item.type,
              visible: item.visible,
              depth: 1,
              locked: item.locked
            });
          }
        });
      }
    }
  });

  const rootItems = allItems.value.filter(item => !item.groupId || !groupsList.value.some(g => g.id === item.groupId));
  rootItems.forEach(item => {
    if (!searchQuery.value || item.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      nodes.push({
        isGroup: false,
        id: item.id,
        name: item.name,
        type: item.type,
        visible: item.visible,
        depth: 0,
        locked: item.locked
      });
    }
  });

  return nodes;
});

function handleCreateEmptyFolder() {
  const newGroupId = `group_${Date.now()}`;
  const newGroups = [...(props.project.groups || []), { id: newGroupId, name: '新建文件夹' }];
  emit('updateProject', {
    ...props.project,
    groups: newGroups
  });
  renamingId.value = newGroupId;
  renamingValue.value = '新建文件夹';
}

function handleGroupSelected() {
  if (props.selectedElementIds.length === 0) return;
  const newGroupId = `group_${Date.now()}`;
  const groupName = '新建分组';
  const newGroups = [...(props.project.groups || []), { id: newGroupId, name: groupName }];

  const updatedMannequins = props.project.mannequins.map(m => props.selectedElementIds.includes(m.id) ? { ...m, groupId: newGroupId } : m);
  const updatedImages = props.project.imagePlanes.map(img => props.selectedElementIds.includes(img.id) ? { ...img, groupId: newGroupId } : img);
  const updatedCameras = props.project.cameras.map(c => props.selectedElementIds.includes(c.id) ? { ...c, groupId: newGroupId } : c);
  const updatedLights = props.project.lights.map(l => props.selectedElementIds.includes(l.id) ? { ...l, groupId: newGroupId } : l);

  emit('updateProject', {
    ...props.project,
    groups: newGroups,
    mannequins: updatedMannequins,
    imagePlanes: updatedImages,
    cameras: updatedCameras,
    lights: updatedLights,
  });

  renamingId.value = newGroupId;
  renamingValue.value = groupName;
  emit('updateSelectedElementIds', [newGroupId]);
  emit('selectElement', newGroupId, 'group');
}

function handleUngroupSelected() {
  if (props.selectedElementIds.length === 0) return;
  const updatedMannequins = props.project.mannequins.map(m => props.selectedElementIds.includes(m.id) ? { ...m, groupId: undefined } : m);
  const updatedImages = props.project.imagePlanes.map(img => props.selectedElementIds.includes(img.id) ? { ...img, groupId: undefined } : img);
  const updatedCameras = props.project.cameras.map(c => props.selectedElementIds.includes(c.id) ? { ...c, groupId: undefined } : c);
  const updatedLights = props.project.lights.map(l => props.selectedElementIds.includes(l.id) ? { ...l, groupId: undefined } : l);

  emit('updateProject', {
    ...props.project,
    mannequins: updatedMannequins,
    imagePlanes: updatedImages,
    cameras: updatedCameras,
    lights: updatedLights,
  });
}

function handleDisbandGroup(groupId: string) {
  const updatedGroups = (props.project.groups || []).filter(g => g.id !== groupId);
  const updatedMannequins = props.project.mannequins.map(m => m.groupId === groupId ? { ...m, groupId: undefined } : m);
  const updatedImages = props.project.imagePlanes.map(img => img.groupId === groupId ? { ...img, groupId: undefined } : img);
  const updatedCameras = props.project.cameras.map(c => c.groupId === groupId ? { ...c, groupId: undefined } : c);
  const updatedLights = props.project.lights.map(l => l.groupId === groupId ? { ...l, groupId: undefined } : l);

  emit('updateProject', {
    ...props.project,
    groups: updatedGroups,
    mannequins: updatedMannequins,
    imagePlanes: updatedImages,
    cameras: updatedCameras,
    lights: updatedLights,
  });

  if (props.selectedElementId === groupId) {
    emit('selectElement', null, null);
  }
}

function handleToggleVisibility(node: any) {
  if (node.type === 'camera') {
    emit('updateCamera', node.id, { visible: !node.visible });
  } else if (node.type === 'mannequin') {
    emit('updateMannequin', node.id, { visible: !node.visible });
  } else if (node.type === 'image') {
    emit('updateImage', node.id, { visible: !node.visible });
  } else if (node.type === 'light') {
    emit('updateLight', node.id, { visible: !node.visible });
  } else if (node.type === 'ground') {
    emit('updateProject', { ...props.project, showGrid: !props.project.showGrid });
  }
}

function handleDeleteItem(node: any) {
  if (node.isGroup) {
    handleDisbandGroup(node.id);
  } else {
    if (node.type === 'ground') return;
    emit('deleteElement', node.id, node.type as any);
    emit('updateSelectedElementIds', props.selectedElementIds.filter(id => id !== node.id));
    if (props.selectedElementId === node.id) {
      emit('selectElement', null, null);
    }
  }
}

function handleNodeClick(e: MouseEvent, node: any) {
  const isShift = e.shiftKey;
  const isCtrl = e.ctrlKey || e.metaKey;

  let nextSelection: string[] = [];

  if (isShift && lastClickedId.value) {
    const lastIdx = nodesToRender.value.findIndex(n => n.id === lastClickedId.value);
    const curIdx = nodesToRender.value.findIndex(n => n.id === node.id);
    if (lastIdx !== -1 && curIdx !== -1) {
      const start = Math.min(lastIdx, curIdx);
      const end = Math.max(lastIdx, curIdx);
      nextSelection = nodesToRender.value.slice(start, end + 1).map(n => n.id);
    } else {
      nextSelection = [node.id];
    }
  } else if (isCtrl) {
    if (props.selectedElementIds.includes(node.id)) {
      nextSelection = props.selectedElementIds.filter(id => id !== node.id);
    } else {
      nextSelection = [...props.selectedElementIds, node.id];
    }
  } else {
    nextSelection = [node.id];
  }

  emit('updateSelectedElementIds', nextSelection);
  lastClickedId.value = node.id;

  if (nextSelection.length > 0) {
    const primaryNode = nodesToRender.value.find(n => n.id === node.id);
    if (primaryNode) {
      emit('selectElement', primaryNode.id, primaryNode.type as any, isShift, isCtrl, nextSelection);
    }
  } else {
    emit('selectElement', null, null, isShift, isCtrl, []);
  }
}

function startRename(e: MouseEvent | null, node: any) {
  if (e) e.stopPropagation();
  renamingId.value = node.id;
  renamingValue.value = node.name;
}

function handleSaveRename(node: any) {
  if (!renamingValue.value.trim()) {
    renamingId.value = null;
    return;
  }

  if (node.isGroup) {
    const updatedGroups = (props.project.groups || []).map(g => g.id === node.id ? { ...g, name: renamingValue.value } : g);
    emit('updateProject', {
      ...props.project,
      groups: updatedGroups
    });
  } else if (node.type === 'mannequin') {
    emit('updateMannequin', node.id, { name: renamingValue.value });
  } else if (node.type === 'camera') {
    emit('updateCamera', node.id, { name: renamingValue.value });
  } else if (node.type === 'image') {
    emit('updateImage', node.id, { name: renamingValue.value });
  } else if (node.type === 'light') {
    emit('updateLight', node.id, { name: renamingValue.value });
  }

  renamingId.value = null;
}

function toggleGroupCollapse(id: string) {
  collapsedGroupIds.value[id] = !collapsedGroupIds.value[id];
}

function handleDragStart(e: DragEvent, nodeId: string, nodeType: string) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: nodeId, type: nodeType }));
    e.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDropOnFolder(e: DragEvent, folderId: string) {
  e.preventDefault();
  e.stopPropagation();
  try {
    const dataStr = e.dataTransfer?.getData('text/plain');
    if (!dataStr) return;
    const { id } = JSON.parse(dataStr);
    if (id === folderId) return;

    const updatedMannequins = props.project.mannequins.map(m => m.id === id ? { ...m, groupId: folderId } : m);
    const updatedImages = props.project.imagePlanes.map(img => img.id === id ? { ...img, groupId: folderId } : img);
    const updatedCameras = props.project.cameras.map(c => c.id === id ? { ...c, groupId: folderId } : c);
    const updatedLights = props.project.lights.map(l => l.id === id ? { ...l, groupId: folderId } : l);

    emit('updateProject', {
      ...props.project,
      mannequins: updatedMannequins,
      imagePlanes: updatedImages,
      cameras: updatedCameras,
      lights: updatedLights,
    });
  } catch (err) {
    console.error('Folder drop failed:', err);
  }
}

function handleDropOnItem(e: DragEvent, targetId: string, targetType: string) {
  e.preventDefault();
  e.stopPropagation();
  try {
    const dataStr = e.dataTransfer?.getData('text/plain');
    if (!dataStr) return;
    const { id, type } = JSON.parse(dataStr);
    if (id === targetId) return;

    const targetItem = allItems.value.find(item => item.id === targetId);
    const targetGroupId = targetItem ? targetItem.groupId : undefined;

    let nextMannequins = [...props.project.mannequins];
    let nextImages = [...props.project.imagePlanes];
    let nextCameras = [...props.project.cameras];
    let nextLights = [...props.project.lights];

    nextMannequins = nextMannequins.map(m => m.id === id ? { ...m, groupId: targetGroupId } : m);
    nextImages = nextImages.map(img => img.id === id ? { ...img, groupId: targetGroupId } : img);
    nextCameras = nextCameras.map(c => c.id === id ? { ...c, groupId: targetGroupId } : c);
    nextLights = nextLights.map(l => l.id === id ? { ...l, groupId: targetGroupId } : l);

    if (type === 'mannequin') {
      const draggedIdx = nextMannequins.findIndex(m => m.id === id);
      if (draggedIdx !== -1) {
        const [dragged] = nextMannequins.splice(draggedIdx, 1);
        const targetIdx = nextMannequins.findIndex(m => m.id === targetId);
        if (targetIdx !== -1) {
          nextMannequins.splice(targetIdx, 0, dragged);
        } else {
          nextMannequins.push(dragged);
        }
      }
    } else if (type === 'camera') {
      const draggedIdx = nextCameras.findIndex(c => c.id === id);
      if (draggedIdx !== -1) {
        const [dragged] = nextCameras.splice(draggedIdx, 1);
        const targetIdx = nextCameras.findIndex(c => c.id === targetId);
        if (targetIdx !== -1) {
          nextCameras.splice(targetIdx, 0, dragged);
        } else {
          nextCameras.push(dragged);
        }
      }
    } else if (type === 'image') {
      const draggedIdx = nextImages.findIndex(img => img.id === id);
      if (draggedIdx !== -1) {
        const [dragged] = nextImages.splice(draggedIdx, 1);
        const targetIdx = nextImages.findIndex(img => img.id === targetId);
        if (targetIdx !== -1) {
          nextImages.splice(targetIdx, 0, dragged);
        } else {
          nextImages.push(dragged);
        }
      }
    } else if (type === 'light') {
      const draggedIdx = nextLights.findIndex(l => l.id === id);
      if (draggedIdx !== -1) {
        const [dragged] = nextLights.splice(draggedIdx, 1);
        const targetIdx = nextLights.findIndex(l => l.id === targetId);
        if (targetIdx !== -1) {
          nextLights.splice(targetIdx, 0, dragged);
        } else {
          nextLights.push(dragged);
        }
      }
    }

    emit('updateProject', {
      ...props.project,
      mannequins: nextMannequins,
      imagePlanes: nextImages,
      cameras: nextCameras,
      lights: nextLights,
    });
  } catch (err) {
    console.error('Reorder drop failed:', err);
  }
}

function handleDropOnRoot(e: DragEvent) {
  e.preventDefault();
  try {
    const dataStr = e.dataTransfer?.getData('text/plain');
    if (!dataStr) return;
    const { id } = JSON.parse(dataStr);

    const updatedMannequins = props.project.mannequins.map(m => m.id === id ? { ...m, groupId: undefined } : m);
    const updatedImages = props.project.imagePlanes.map(img => img.id === id ? { ...img, groupId: undefined } : img);
    const updatedCameras = props.project.cameras.map(c => c.id === id ? { ...c, groupId: undefined } : c);
    const updatedLights = props.project.lights.map(l => l.id === id ? { ...l, groupId: undefined } : l);

    emit('updateProject', {
      ...props.project,
      mannequins: updatedMannequins,
      imagePlanes: updatedImages,
      cameras: updatedCameras,
      lights: updatedLights,
    });
  } catch (err) {
    console.error('Root drop failed:', err);
  }
}

function handleContextMenu(e: MouseEvent, node?: any) {
  e.preventDefault();
  e.stopPropagation();
  
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    nodeId: node?.id,
    nodeType: node?.type,
    isGroup: node?.isGroup,
    nodeName: node?.name
  };
}

function handleOutlineKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.getAttribute('contenteditable') === 'true')
  ) {
    return;
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (props.selectedElementIds.length > 0) {
      e.preventDefault();
      props.selectedElementIds.forEach(id => {
        const node = nodesToRender.value.find(n => n.id === id);
        if (node) {
          handleDeleteItem(node);
        }
      });
      emit('updateSelectedElementIds', []);
    }
  }
}
</script>

<template>
  <aside 
    class="w-64 bg-[#111318] border-r border-[#ffffff]/5 flex flex-col shrink-0 h-full select-none relative animate-fade-in" 
    id="sidebar-left-root"
    @contextmenu.prevent="handleContextMenu($event)"
  >
    <!-- Header with Unified Search Action toolbar -->
    <OutlineToolbar
      :searchQuery="searchQuery"
      :hasSelection="selectedElementIds.length > 0"
      @updateSearchQuery="searchQuery = $event"
      @createEmptyFolder="handleCreateEmptyFolder"
      @groupSelected="handleGroupSelected"
      @ungroupSelected="handleUngroupSelected"
    />

    <!-- Hierarchy Tree container body -->
    <div 
      class="flex-grow overflow-y-auto py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent h-full animate-fade-in"
      @contextmenu.self.prevent="handleContextMenu($event)"
      @dragover="handleDragOver"
      @drop="handleDropOnRoot"
      id="outline-tree-nodes-list"
    >
      <template v-if="nodesToRender.length > 0">
        <SceneTreeNode
          v-for="node in nodesToRender"
          :key="node.id"
          :node="node"
          :selectedElementIds="selectedElementIds"
          :selectedElementId="selectedElementId"
          :renamingId="renamingId"
          :renamingValue="renamingValue"
          :isCollapsed="!!collapsedGroupIds[node.id]"
          @toggleCollapse="toggleGroupCollapse"
          @selectNode="handleNodeClick"
          @contextNode="handleContextMenu"
          @startRename="startRename"
          @saveRename="handleSaveRename"
          @toggleVisibility="handleToggleVisibility"
          @deleteItem="handleDeleteItem"
          @updateCameraLock="(id, val) => emit('updateCamera', id, { locked: val })"
          @dragStart="handleDragStart"
          @dragOver="handleDragOver"
          @dropOnFolder="handleDropOnFolder"
          @dropOnItem="handleDropOnItem"
          @updateRenamingValue="renamingValue = $event"
        />
      </template>

      <!-- Empty State indicator -->
      <div v-else class="text-center py-8 text-gray-600 text-[10.5px] font-sans" id="outline-empty-state">
        无匹配场景节点。可添加要素新建
      </div>
    </div>

    <!-- Floating Context Menu portal -->
    <div 
      v-if="contextMenu"
      class="fixed bg-[#161a22] border border-white/10 rounded-lg shadow-2xl py-1 md:min-w-[150px] z-50 text-[11px] text-gray-300 font-sans backdrop-blur-md pointer-events-auto animate-fade-in"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      @click.stop=""
    >
      <template v-if="contextMenu.nodeId">
        <div class="px-3 py-1.5 border-b border-white/5 font-semibold text-gray-400 font-mono text-[9px] uppercase truncate max-w-[170px]">
          节点: {{ contextMenu.nodeName || '未命名' }}
        </div>
        
        <div 
          role="button" 
          tabindex="0"
          @click="() => { if (contextMenu) { startRename(null, { id: contextMenu.nodeId!, name: contextMenu.nodeName || '' }); contextMenu = null; } }"
          @keydown.enter.prevent="() => { if (contextMenu) { startRename(null, { id: contextMenu.nodeId!, name: contextMenu.nodeName || '' }); contextMenu = null; } }"
          @keydown.space.prevent="() => { if (contextMenu) { startRename(null, { id: contextMenu.nodeId!, name: contextMenu.nodeName || '' }); contextMenu = null; } }"
          class="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Icon icon="lucide:edit-3" :width="11" :height="11" class="text-gray-400" />
          <span>重命名节点</span>
        </div>

        <template v-if="contextMenu.isGroup">
          <div 
            role="button"
            tabindex="0"
            @click="() => { if (contextMenu) { handleDisbandGroup(contextMenu.nodeId!); contextMenu = null; } }"
            @keydown.enter.prevent="() => { if (contextMenu) { handleDisbandGroup(contextMenu.nodeId!); contextMenu = null; } }"
            @keydown.space.prevent="() => { if (contextMenu) { handleDisbandGroup(contextMenu.nodeId!); contextMenu = null; } }"
            class="w-full text-left px-3 py-1.5 hover:bg-red-500/10 hover:text-red-400 text-red-500 flex items-center gap-2 cursor-pointer transition-colors border-t border-white/5"
          >
            <Icon icon="lucide:trash-2" :width="11" />
            <span>解散分组工程</span>
          </div>
        </template>
        
        <template v-else>
          <div 
            role="button"
            tabindex="0"
            @click="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleToggleVisibility(n); contextMenu = null; } }"
            @keydown.enter.prevent="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleToggleVisibility(n); contextMenu = null; } }"
            @keydown.space.prevent="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleToggleVisibility(n); contextMenu = null; } }"
            class="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Icon icon="lucide:eye" :width="11" class="text-gray-400" />
            <span>切换显示隐藏</span>
          </div>

          <div 
            role="button"
            tabindex="0"
            @click="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleDeleteItem(n); contextMenu = null; } }"
            @keydown.enter.prevent="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleDeleteItem(n); contextMenu = null; } }"
            @keydown.space.prevent="() => { if (contextMenu) { const n = nodesToRender.find(item => item.id === contextMenu!.nodeId); if (n) handleDeleteItem(n); contextMenu = null; } }"
            class="w-full text-left px-3 py-1.5 hover:bg-red-500/10 hover:text-red-400 text-red-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-white/5"
          >
            <Icon icon="lucide:trash-2" :width="11" />
            <span>删除该对象</span>
          </div>
        </template>
      </template>
      
      <template v-else>
        <div 
          role="button"
          tabindex="0"
          @click="() => { handleCreateEmptyFolder(); contextMenu = null; }"
          @keydown.enter.prevent="() => { handleCreateEmptyFolder(); contextMenu = null; }"
          @keydown.space.prevent="() => { handleCreateEmptyFolder(); contextMenu = null; }"
          class="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Icon icon="lucide:folder-plus" :width="11" class="text-amber-400" />
          <span>新建分组文件夹</span>
        </div>
      </template>

      <!-- Multi-select secondary options -->
      <div v-if="selectedElementIds.length > 0" class="border-t border-white/5 mt-1 pt-1">
        <div 
          role="button"
          tabindex="0"
          @click="() => { handleGroupSelected(); contextMenu = null; }"
          @keydown.enter.prevent="() => { handleGroupSelected(); contextMenu = null; }"
          @keydown.space.prevent="() => { handleGroupSelected(); contextMenu = null; }"
          class="w-full text-left px-3 py-1.5 hover:bg-teal-500/10 hover:text-teal-400 text-teal-400 flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Icon icon="lucide:component" :width="11" />
          <span>组合选中对象</span>
        </div>

        <div 
          role="button"
          tabindex="0"
          @click="() => { handleUngroupSelected(); contextMenu = null; }"
          @keydown.enter.prevent="() => { handleUngroupSelected(); contextMenu = null; }"
          @keydown.space.prevent="() => { handleUngroupSelected(); contextMenu = null; }"
          class="w-full text-left px-3 py-1.5 hover:bg-yellow-500/10 hover:text-yellow-400 text-yellow-400 flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Icon icon="lucide:folder-minus" :width="11" />
          <span>解除所选组合</span>
        </div>
      </div>
    </div>
  </aside>
</template>
