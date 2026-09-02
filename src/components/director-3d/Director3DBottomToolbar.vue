<script setup lang="ts">
import { ref, watch, useTemplateRef } from 'vue';
import { Icon } from '@iconify/vue';
import { DirectingProject, MannequinObject } from '@/components/director-3d/director3D.types';
import { PRESET_GLB_MODELS } from '@/components/director-3d/director3D.constants';
import DistributionPanel from '@/components/director-3d/panels/DistributionPanel.vue';

type PanelType = 'add' | 'camera' | 'aspect' | null;

const props = defineProps<{
  project: DirectingProject;
  customEditorCamera: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isUploadingGlb: boolean;
  activePanel?: PanelType;
}>();

const emit = defineEmits<{
  (e: 'changeCustomEditorCamera', val: boolean): void;
  (e: 'addMannequin', style: 'detailed' | 'simple' | 'glb', glbId?: string, glbUrl?: string, glbName?: string): void;
  (e: 'addCamera'): void;
  (e: 'addImagePlane', url?: string, name?: string): void;
  (e: 'distributionGenerate', config: any): void;
  (e: 'commitHistory'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'updateProject', proj: DirectingProject): void;
  (e: 'triggerExport'): void;
  (e: 'uploadGlb', file: File): void;
  (e: 'changeActivePanel', panel: PanelType): void;
}>();

const localActivePanel = ref<PanelType>(null);
const activePanelComputed = ref<PanelType>(null);

watch(() => props.activePanel, (newVal) => {
  if (newVal !== undefined) activePanelComputed.value = newVal;
}, { immediate: true });

watch(localActivePanel, (newVal) => {
  if (props.activePanel === undefined) activePanelComputed.value = newVal;
});

function setActivePanel(panel: PanelType) {
  if (props.activePanel !== undefined) {
    emit('changeActivePanel', panel);
  } else {
    localActivePanel.value = panel;
  }
}

const addMenuTab = ref<'single' | 'distribution'>('single');
const glbFileInput = useTemplateRef<HTMLInputElement>('glbFileInput');

const ASPECT_RATIOS = ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;

function onAddMannequins(newMannequins: MannequinObject[]) {
  emit('commitHistory');
  const existingGroupIds = new Set((props.project.groups || []).map(g => g.id));
  const newGroups = new Map<string, string>();
  newMannequins.forEach(m => {
    if (m.groupId && m.groupName && !existingGroupIds.has(m.groupId) && !newGroups.has(m.groupId)) {
      newGroups.set(m.groupId, m.groupName);
    }
  });
  const groupsToAdd = [...newGroups.entries()].map(([id, name]) => ({ id, name }));
  const updatedGroups = [...(props.project.groups || []), ...groupsToAdd];
  emit('updateProject', { ...props.project, mannequins: [...props.project.mannequins, ...newMannequins], groups: updatedGroups });
}

function handleGlbUploadChange(e: Event) {
  const el = e.target as HTMLInputElement;
  const file = el.files?.[0];
  if (file) emit('uploadGlb', file);
}
</script>

<template>
  <div class="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center z-40 select-none pointer-events-auto" id="bottom-dock-container">

    <div v-if="activePanelComputed === 'add'" class="mb-3 w-[420px] max-w-[90vw] bg-[#111318]/95 border border-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 z-50 text-left backdrop-blur-md">
      <div class="flex bg-[#181a20] p-0.5 rounded-lg border border-white/5 mb-4">
        <div
          role="button" tabindex="0"
          @click="addMenuTab = 'single'" @keydown.enter.prevent="addMenuTab = 'single'" @keydown.space.prevent="addMenuTab = 'single'"
          :class="['flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-center', addMenuTab === 'single' ? 'bg-white/[0.08] text-white shadow' : 'text-gray-400 hover:text-white']"
        >
          角色添加
        </div>
        <div
          role="button" tabindex="0"
          @click="addMenuTab = 'distribution'" @keydown.enter.prevent="addMenuTab = 'distribution'" @keydown.space.prevent="addMenuTab = 'distribution'"
          :class="['flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-center', addMenuTab === 'distribution' ? 'bg-white/[0.08] text-white shadow' : 'text-gray-400 hover:text-white']"
        >
          群集生成
        </div>
      </div>

      <div v-if="addMenuTab === 'single'" class="space-y-4">
        <div class="space-y-2">
          <span class="text-[10px] font-medium text-gray-500 uppercase tracking-widest pl-1 block">添加人偶角色</span>
          <div class="grid grid-cols-2 gap-2">
            <div
              role="button" tabindex="0"
              @click="() => { emit('addMannequin', 'detailed'); setActivePanel(null); }"
              @keydown.enter.prevent="() => { emit('addMannequin', 'detailed'); setActivePanel(null); }"
              @keydown.space.prevent="() => { emit('addMannequin', 'detailed'); setActivePanel(null); }"
              class="text-left bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.05] p-3 rounded-xl transition-all cursor-pointer"
            >
              <div class="text-[12px] font-medium text-white">高精骨骼</div>
            </div>
            <div
              role="button" tabindex="0"
              @click="() => { emit('addMannequin', 'simple'); setActivePanel(null); }"
              @keydown.enter.prevent="() => { emit('addMannequin', 'simple'); setActivePanel(null); }"
              @keydown.space.prevent="() => { emit('addMannequin', 'simple'); setActivePanel(null); }"
              class="text-left bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-white/[0.05] p-3 rounded-xl transition-all cursor-pointer"
            >
              <div class="text-[12px] font-medium text-white">极简木偶</div>
            </div>
          </div>
        </div>

        <div v-if="PRESET_GLB_MODELS.length > 0" class="space-y-2 pt-2 border-t border-white/5">
          <span class="text-[10px] font-medium text-gray-500 uppercase tracking-widest pl-1 block">预设高级模型</span>
          <div class="grid grid-cols-1 gap-1.5">
            <div
              v-for="model in PRESET_GLB_MODELS" :key="model.id"
              role="button" tabindex="0"
              @click="() => { emit('addMannequin', 'glb', model.id, model.url, model.name); setActivePanel(null); }"
              @keydown.enter.prevent="() => { emit('addMannequin', 'glb', model.id, model.url, model.name); setActivePanel(null); }"
              @keydown.space.prevent="() => { emit('addMannequin', 'glb', model.id, model.url, model.name); setActivePanel(null); }"
              class="text-left bg-white/[0.02] border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.05] p-3 rounded-xl transition-all cursor-pointer"
            >
              <div class="text-[12px] font-medium text-white">{{ model.name }}</div>
              <div class="text-[9px] text-gray-500 mt-0.5">点击添加预设模型</div>
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-white/5">
          <div
            role="button" tabindex="0"
            :disabled="isUploadingGlb"
            @click="() => { if (!isUploadingGlb) glbFileInput?.click(); }"
            @keydown.enter.prevent="() => { if (!isUploadingGlb) glbFileInput?.click(); }"
            @keydown.space.prevent="() => { if (!isUploadingGlb) glbFileInput?.click(); }"
            :class="['flex items-center justify-center gap-2.5 bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.05] px-3.5 py-2.5 rounded-xl text-center cursor-pointer transition-all', isUploadingGlb ? 'opacity-50 cursor-not-allowed' : '']"
          >
            <Icon icon="lucide:upload" :width="13" class="text-emerald-400" />
            <span class="text-[12px] font-medium text-white">{{ isUploadingGlb ? '正在导入...' : '导入 GLB 模型' }}</span>
          </div>
          <input ref="glbFileInput" type="file" accept=".glb,.gltf" @change="handleGlbUploadChange" class="hidden" />
        </div>
      </div>

      <div v-else class="max-h-[350px] overflow-y-auto scrollbar-thin pr-1">
        <DistributionPanel
          :project="project"
          @addMannequins="onAddMannequins"
          @commitHistory="emit('commitHistory')"
        />
      </div>
    </div>

    <div v-if="activePanelComputed === 'camera'" class="mb-3 w-[240px] bg-[#111318]/95 border border-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-50 text-left backdrop-blur-md flex flex-col space-y-0.5">
      <div
        role="button" tabindex="0"
        @click="() => { emit('changeCustomEditorCamera', true); setActivePanel(null); }"
        @keydown.enter.prevent="() => { emit('changeCustomEditorCamera', true); setActivePanel(null); }"
        @keydown.space.prevent="() => { emit('changeCustomEditorCamera', true); setActivePanel(null); }"
        :class="['w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors', customEditorCamera ? 'bg-white/[0.08] text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
      >
        自由视角摄影机
      </div>
      <div
        v-for="(c, idx) in project.cameras" :key="c.id"
        role="button" tabindex="0"
        @click="() => { emit('updateProject', { ...project, activeCameraId: c.id }); emit('changeCustomEditorCamera', false); setActivePanel(null); }"
        @keydown.enter.prevent="() => { emit('updateProject', { ...project, activeCameraId: c.id }); emit('changeCustomEditorCamera', false); setActivePanel(null); }"
        @keydown.space.prevent="() => { emit('updateProject', { ...project, activeCameraId: c.id }); emit('changeCustomEditorCamera', false); setActivePanel(null); }"
        :class="['w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors truncate', (!customEditorCamera && project.activeCameraId === c.id) ? 'bg-white/[0.08] text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
      >
        机位 {{ idx + 1 }} ({{ c.name }})
      </div>
      <div class="border-t border-white/5 mt-1 pt-1">
        <div
          role="button" tabindex="0"
          @click="() => { emit('addCamera'); setActivePanel(null); }"
          @keydown.enter.prevent="() => { emit('addCamera'); setActivePanel(null); }"
          @keydown.space.prevent="() => { emit('addCamera'); setActivePanel(null); }"
          class="w-full text-left px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors text-emerald-400 hover:text-emerald-300 hover:bg-white/[0.03] flex items-center gap-2"
        >
          <Icon icon="lucide:plus" :width="12" />
          <span>新增拍摄机位</span>
        </div>
      </div>
    </div>

    <div v-if="activePanelComputed === 'aspect'" class="mb-3 bg-[#111318]/95 border border-white/5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 z-50 text-left backdrop-blur-md flex flex-col space-y-0.5">
      <div
        v-for="r in ASPECT_RATIOS" :key="r"
        role="button" tabindex="0"
        @click="() => { emit('commitHistory'); emit('updateProject', { ...project, aspectRatio: r }); setActivePanel(null); }"
        @keydown.enter.prevent="() => { emit('commitHistory'); emit('updateProject', { ...project, aspectRatio: r }); setActivePanel(null); }"
        @keydown.space.prevent="() => { emit('commitHistory'); emit('updateProject', { ...project, aspectRatio: r }); setActivePanel(null); }"
        :class="['w-full text-left px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors', (project.aspectRatio || 'auto') === r ? 'bg-blue-600/25 text-blue-300 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
      >
        {{ r === 'auto' ? '自动 (画布)' : r }}
      </div>
    </div>

    <div class="flex items-center flex-nowrap bg-[#111318]/95 border border-white/5 rounded-full px-2 sm:px-3.5 py-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.7)] gap-1 shrink-0 backdrop-blur-md overflow-hidden max-w-[95vw]">
      <div
        role="button" tabindex="0"
        @click="setActivePanel(activePanelComputed === 'add' ? null : 'add')"
        @keydown.enter.prevent="setActivePanel(activePanelComputed === 'add' ? null : 'add')"
        @keydown.space.prevent="setActivePanel(activePanelComputed === 'add' ? null : 'add')"
        :class="['flex items-center gap-1.5 px-2 sm:px-3.5 py-2 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap', activePanelComputed === 'add' ? 'bg-white/[0.08] text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
        title="添加角色、背景、天空球穹顶及机位"
      >
        <Icon icon="lucide:plus-circle" :width="14" />
        <span class="hidden sm:inline">添加</span>
      </div>

      <div
        role="button" tabindex="0"
        @click="setActivePanel(activePanelComputed === 'camera' ? null : 'camera')"
        @keydown.enter.prevent="setActivePanel(activePanelComputed === 'camera' ? null : 'camera')"
        @keydown.space.prevent="setActivePanel(activePanelComputed === 'camera' ? null : 'camera')"
        :class="['flex items-center gap-1.5 px-2 sm:px-3.5 py-2 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap', activePanelComputed === 'camera' ? 'bg-white/[0.08] text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
        title="切换主视角"
      >
        <Icon icon="lucide:video" :width="14" />
        <span class="hidden sm:inline">相机</span>
      </div>

      <div
        role="button" tabindex="0"
        @click="setActivePanel(activePanelComputed === 'aspect' ? null : 'aspect')"
        @keydown.enter.prevent="setActivePanel(activePanelComputed === 'aspect' ? null : 'aspect')"
        @keydown.space.prevent="setActivePanel(activePanelComputed === 'aspect' ? null : 'aspect')"
        :class="['flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap', activePanelComputed === 'aspect' ? 'bg-white/[0.08] text-white shadow' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]']"
        title="截图画幅比例"
      >
        <Icon icon="lucide:maximize-2" :width="14" />
        <span class="font-mono font-bold">{{ project.aspectRatio || 'auto' }}</span>
      </div>

      <div class="w-px h-5 bg-white/5 mx-0.5 sm:mx-1" />

      <div
        role="button" tabindex="0"
        @click="() => { emit('triggerExport'); }"
        @keydown.enter.prevent="() => { emit('triggerExport'); }"
        @keydown.space.prevent="() => { emit('triggerExport'); }"
        class="director-screenshot-button flex items-center gap-1.5 px-3 sm:px-4 py-2 border rounded-full text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
        title="一键截图并上传生成 URL"
      >
        <span>截图</span>
      </div>

      <div class="w-px h-5 bg-white/5 mx-0.5 sm:mx-1" />

      <div
        role="button" :tabindex="canUndo ? 0 : -1"
        @click="() => { if (canUndo) emit('undo'); }"
        @keydown.enter.prevent="() => { if (canUndo) emit('undo'); }"
        @keydown.space.prevent="() => { if (canUndo) emit('undo'); }"
        :class="['p-2 rounded-full transition-all cursor-pointer', canUndo ? 'text-gray-200 hover:bg-white/[0.05]' : 'text-gray-600 cursor-not-allowed']"
        title="撤销 (Ctrl+Z)"
      >
        <Icon icon="lucide:rotate-ccw" :width="13" />
      </div>
      <div
        role="button" :tabindex="canRedo ? 0 : -1"
        @click="() => { if (canRedo) emit('redo'); }"
        @keydown.enter.prevent="() => { if (canRedo) emit('redo'); }"
        @keydown.space.prevent="() => { if (canRedo) emit('redo'); }"
        :class="['p-2 rounded-full transition-all cursor-pointer', canRedo ? 'text-gray-200 hover:bg-white/[0.05]' : 'text-gray-600 cursor-not-allowed']"
        title="重做 (Ctrl+Y)"
      >
        <Icon icon="lucide:rotate-ccw" :width="13" class="transform scale-x-[-1] rotate-180" />
      </div>
    </div>
  </div>
</template>
