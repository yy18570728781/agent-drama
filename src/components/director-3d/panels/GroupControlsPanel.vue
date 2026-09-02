<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { DirectingProject, MannequinObject, MannequinJoints } from '@/components/director-3d/director3D.types';
import { POSE_PRESETS } from '@/components/director-3d/director3D.constants';

const props = withDefaults(defineProps<{
  project: DirectingProject;
  selectedGroupObject: { id: string; name: string } | null;
  groupMannequins: MannequinObject[];
  customPresets: Array<{ id: string; name: string; joints: MannequinJoints }>;
}>(), {
});

const emit = defineEmits<{
  (e: 'updateProject', proj: DirectingProject): void;
  (e: 'commitHistory'): void;
  (e: 'removeMannequinFromGroup', mannequinId: string): void;
  (e: 'selectElement', id: string | null, type: string | null): void;
}>();

const groupStyleValue = computed(() => {
  const first = props.groupMannequins[0];
  if (!first) return 'simple';
  return first.style || 'simple';
});

const allLabelsShown = computed(() => props.groupMannequins.every(m => m.showLabel ?? false));

function handleGroupStyleChange(value: string) {
  emit('commitHistory');
  const updatedMannequins = props.project.mannequins.map(m => {
    if (m.groupId !== props.selectedGroupObject!.id) return m;
    return { ...m, style: value as MannequinObject['style'] };
  });
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleGroupUniformScale(val: number) {
  const updatedMannequins = props.project.mannequins.map(m => {
    if (m.groupId !== props.selectedGroupObject!.id) return m;
    return { ...m, scale: { x: val, y: val, z: val } };
  });
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleGroupColor(color: string) {
  emit('commitHistory');
  const updatedMannequins = props.project.mannequins.map(m => {
    if (m.groupId !== props.selectedGroupObject!.id) return m;
    return { ...m, color };
  });
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleGroupToggleLabels() {
  emit('commitHistory');
  const newVal = !allLabelsShown.value;
  const updatedMannequins = props.project.mannequins.map(m => {
    if (m.groupId !== props.selectedGroupObject!.id) return m;
    return { ...m, showLabel: newVal };
  });
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleGroupRandomizePoses() {
  emit('commitHistory');
  const availablePoses = [...POSE_PRESETS, ...props.customPresets];
  if (availablePoses.length === 0) return;
  const updatedMannequins = props.project.mannequins.map(m => {
    if (m.groupId !== props.selectedGroupObject!.id) return m;
    const idx = Math.floor(Math.random() * availablePoses.length);
    return { ...m, joints: JSON.parse(JSON.stringify(availablePoses[idx].joints)) };
  });
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleGroupRename(newName: string) {
  const updatedMannequins = props.project.mannequins.map(m =>
    m.groupId === props.selectedGroupObject!.id ? { ...m, groupName: newName } : m
  );
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleClearGroupMannequins() {
  emit('commitHistory');
  const updatedMannequins = props.project.mannequins.filter(m => m.groupId !== props.selectedGroupObject!.id);
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
}

function handleDisbandGroup() {
  emit('commitHistory');
  const updatedMannequins = props.project.mannequins.filter(m => m.groupId !== props.selectedGroupObject!.id);
  emit('updateProject', { ...props.project, mannequins: updatedMannequins });
  emit('selectElement', null, null);
}
</script>

<template>
  <div class="rounded-xl bg-black/20 p-4 border border-white/5 space-y-4 animate-fade-in">
    <div class="flex items-center gap-2 border-b border-white/5 pb-2">
      <Icon icon="lucide:layers" :width="13" class="text-indigo-400" />
      <span class="text-xs font-semibold text-white">群体队列或队形排布</span>
    </div>

    <div class="space-y-4">
      <div class="flex flex-col gap-1.5">
        <span class="text-[11px] text-gray-500 font-mono">队形名称</span>
        <input
          type="text"
          :value="selectedGroupObject!.name"
          @input="handleGroupRename(($event.target as HTMLInputElement).value)"
          class="w-full bg-black/40 border border-[#ffffff]/5 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
        />
      </div>

      <div class="space-y-1.5">
        <span class="text-[11px] text-gray-400 block font-bold">更改此组使用的模型</span>
        <select
          :value="groupStyleValue"
          @change="handleGroupStyleChange(($event.target as HTMLSelectElement).value)"
          class="w-full text-xs bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none cursor-pointer focus:border-indigo-500 transition-colors"
        >
          <option value="detailed">高精度解剖骨骼</option>
          <option value="simple">极简木偶圆台</option>
          <option v-if="groupStyleValue === 'glb'" value="glb" disabled>UE 小白人 (GLB)</option>
        </select>
      </div>

      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-[11px] text-gray-400 block font-bold">缩放人偶</span>
          <input
            type="number"
            step="any"
            :value="Number((groupMannequins[0] ? groupMannequins[0].scale.x : 1.0).toFixed(1))"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) { emit('commitHistory'); handleGroupUniformScale(v); } }"
            class="w-10 text-[10px] font-mono font-bold text-indigo-400 text-right bg-transparent border-b border-white/10 focus:border-indigo-500 outline-none shrink-0"
          />
        </div>
        <div class="flex items-center gap-3">
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            :value="groupMannequins[0] ? groupMannequins[0].scale.x : 1.0"
            @mousedown="emit('commitHistory')"
            @input="handleGroupUniformScale(parseFloat(($event.target as HTMLInputElement).value))"
            class="flex-grow accent-indigo-500 h-1 bg-white/10 rounded cursor-pointer"
          />
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-[11px] text-gray-400 block font-bold">人偶颜色</span>
        <div class="grid grid-cols-4 gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
          <div
            v-for="c in ['#2bcbba', '#4b7bec', '#a55eff', '#eb3b5a', '#fa8231', '#20bf6b', '#ffffff', '#ffd12b']"
            :key="c"
            role="button"
            tabindex="0"
            @click="handleGroupColor(c)"
            @keydown.enter.prevent="handleGroupColor(c)"
            @keydown.space.prevent="handleGroupColor(c)"
            class="w-5 h-5 rounded-full border border-white/20 transition-transform active:scale-95 cursor-pointer mx-auto"
            :style="{ backgroundColor: c, boxShadow: (groupMannequins[0] && groupMannequins[0].color === c) ? '0 0 8px ' + c : 'none' }"
          />
        </div>
      </div>

      <div class="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5">
        <span class="text-[11px] text-gray-400 font-bold">浮空名字牌</span>
        <div
          role="button"
          tabindex="0"
          @click="handleGroupToggleLabels()"
          @keydown.enter.prevent="handleGroupToggleLabels()"
          @keydown.space.prevent="handleGroupToggleLabels()"
          :class="[
            'px-3 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer select-none',
            allLabelsShown
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20'
              : 'bg-black/40 text-gray-500 border border-white/5'
          ]"
        >
          {{ allLabelsShown ? '全部显示' : '全部关闭' }}
        </div>
      </div>

      <button
        type="button"
        @click="handleGroupRandomizePoses"
        class="flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 font-semibold text-xs rounded border border-indigo-500/20 cursor-pointer transition-colors"
      >
        <Icon icon="lucide:shuffle" :width="13" />
        随机全员姿势
      </button>

      <div class="space-y-2">
        <span class="text-[11px] text-gray-400 font-semibold block">队列人数 ({{ groupMannequins.length }})</span>
        <div class="max-h-40 overflow-y-auto bg-black/40 rounded-lg border border-white/5 p-2 space-y-1">
          <div v-for="m in groupMannequins" :key="m.id" class="flex justify-between items-center text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors">
            <span>{{ m.name }}</span>
            <div
              role="button"
              tabindex="0"
              @click="emit('removeMannequinFromGroup', m.id)"
              @keydown.enter.prevent="emit('removeMannequinFromGroup', m.id)"
              @keydown.space.prevent="emit('removeMannequinFromGroup', m.id)"
              class="text-red-400 hover:text-red-355 font-mono text-[9px] border border-red-500/10 px-1 py-0.5 rounded cursor-pointer"
            >
              移出队伍
            </div>
          </div>
        </div>
      </div>

      <div
        role="button"
        tabindex="0"
        @click="handleClearGroupMannequins()"
        @keydown.enter.prevent="handleClearGroupMannequins()"
        @keydown.space.prevent="handleClearGroupMannequins()"
        class="w-full text-center py-2 bg-red-500/10 hover:bg-red-500/15 text-red-400 font-medium text-xs rounded border border-red-500/15 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
      >
        <Icon icon="lucide:trash-2" :width="12" />
        <span>清除本组所有人偶</span>
      </div>

      <div
        role="button"
        tabindex="0"
        @click="handleDisbandGroup()"
        @keydown.enter.prevent="handleDisbandGroup()"
        @keydown.space.prevent="handleDisbandGroup()"
        class="w-full text-center py-2 bg-red-600/15 hover:bg-red-600/25 text-red-400 font-medium text-xs rounded border border-red-500/20 cursor-pointer transition-colors"
      >
        解散整个队伍/剔除所有人物
      </div>
    </div>
  </div>
</template>
