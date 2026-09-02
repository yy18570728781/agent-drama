<script setup lang="ts">
import { ref, computed } from 'vue';
import { MannequinJoints } from '@/components/director-3d/director3D.types';
import { POSE_PRESETS } from '@/components/director-3d/director3D.constants';

const props = withDefaults(defineProps<{
  joints: MannequinJoints;
  color: string;
  name: string;
  scaleY: number;
  selectedJointKey?: keyof MannequinJoints | null;
  style: 'detailed' | 'simple' | 'glb';
  showLabel?: boolean;
  customPresets: Array<{ id: string; name: string; joints: MannequinJoints }>;
  glbId?: string;
  hideBaseProperties?: boolean;
}>(), {
  selectedJointKey: null,
  showLabel: false,
  hideBaseProperties: false,
});

const emit = defineEmits<{
  (e: 'changeJoints', joints: MannequinJoints): void;
  (e: 'changeColor', color: string): void;
  (e: 'changeName', name: string): void;
  (e: 'changeScaleY', val: number): void;
  (e: 'changeSelectedJointKey', key: keyof MannequinJoints): void;
  (e: 'changeStyle', style: 'detailed' | 'simple' | 'glb'): void;
  (e: 'applyPresetPose', pose: MannequinJoints): void;
  (e: 'changeShowLabel', val: boolean): void;
  (e: 'commitHistory'): void;
  (e: 'saveCustomPreset', name: string, joints: MannequinJoints): void;
  (e: 'deleteCustomPreset', id: string): void;
}>();

const JOINT_LABELS: Record<keyof MannequinJoints, string> = {
  head: '头部',
  chest: '胸部',
  pelvis: '骨盆',
  leftShoulder: '左肩',
  leftElbow: '左肘',
  leftWrist: '左手腕',
  rightShoulder: '右肩',
  rightElbow: '右肘',
  rightWrist: '右手腕',
  leftHip: '左大腿',
  leftKnee: '左膝盖',
  leftAnkle: '左脚踝',
  rightHip: '右大腿',
  rightKnee: '右膝盖',
  rightAnkle: '右脚踝',
};

const localSelectedJointKey = ref<keyof MannequinJoints>('leftShoulder');
const newPresetName = ref('');

const selectedJointKey = computed(() => {
  return props.selectedJointKey || localSelectedJointKey.value;
});

function setSelectedJointKey(key: keyof MannequinJoints) {
  emit('changeSelectedJointKey', key);
  localSelectedJointKey.value = key;
}

const activeRotation = computed(() => {
  return props.joints[selectedJointKey.value] || { x: 0, y: 0, z: 0 };
});

function triggerHistoryStart() {
  emit('commitHistory');
}

function handleAngleChange(axis: 'x' | 'y' | 'z', value: number) {
  const updatedJoints = { ...props.joints };
  const currentRot = updatedJoints[selectedJointKey.value] || { x: 0, y: 0, z: 0 };
  updatedJoints[selectedJointKey.value] = {
    ...currentRot,
    [axis]: value,
  };
  emit('changeJoints', updatedJoints);
}

function handleResetJoint() {
  triggerHistoryStart();
  const updatedJoints = { ...props.joints };
  updatedJoints[selectedJointKey.value] = { x: 0, y: 0, z: 0 };
  emit('changeJoints', updatedJoints);
}

function handleSavePose(e: Event) {
  e.preventDefault();
  if (!newPresetName.value.trim()) return;
  triggerHistoryStart();
  emit('saveCustomPreset', newPresetName.value, props.joints);
  newPresetName.value = '';
}

const jointKeys = computed(() => Object.keys(props.joints) as Array<keyof MannequinJoints>);
</script>

<template>
  <div class="space-y-4 bg-[#111318] p-4 rounded-xl border border-white/5 shadow-xl text-gray-200 animate-fade-in" id="joint-controls-root">
    
    <!-- 模特基础属性区块 -->
    <div v-if="!hideBaseProperties" class="space-y-3.5">
      <div class="flex items-center justify-between border-b border-white/5 pb-2">
        <span class="text-[11px] font-bold tracking-wider text-gray-400 uppercase">属性参数 (Inspector)</span>
        <span class="text-[9px] text-[#29b6f6] bg-[#29b6f6]/10 px-1.5 py-0.5 rounded font-bold">1:1 精准傀儡</span>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">模特代号</label>
          <input
            type="text"
            :value="name"
            @input="($event) => { triggerHistoryStart(); emit('changeName', ($event.target as HTMLInputElement).value); }"
            class="w-full text-xs bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-[#29b6f6] transition-colors"
            id="model-name-input"
          />
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">材质表面</label>
          <div class="flex items-center gap-1.5 bg-black/30 px-2 py-1 border border-white/10 rounded h-[29px]">
            <input
              type="color"
              :value="color"
              @mousedown="triggerHistoryStart"
              @touchstart="triggerHistoryStart"
              @input="emit('changeColor', ($event.target as HTMLInputElement).value)"
              class="w-5 h-5 border-0 bg-transparent cursor-pointer rounded-sm shrink-0"
              id="model-color-picker"
            />
            <span class="text-[10px] font-mono text-gray-300 truncate">{{ color.toUpperCase() }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">骨骼表现力</label>
          <select
            :value="style === 'glb' ? 'glb' : style"
            @change="($event) => {
              const val = ($event.target as HTMLSelectElement).value;
              triggerHistoryStart();
              if (val === 'detailed' || val === 'simple') {
                emit('changeStyle', val);
              }
            }"
            class="w-full text-xs bg-black/30 border border-[#00e5ff]/20 rounded px-2 py-1.5 text-white focus:outline-none cursor-pointer focus:border-[#00e5ff] transition-all"
          >
            <option value="detailed">高精度解剖骨骼</option>
            <option value="simple">极简木偶圆台</option>
            <option v-if="style === 'glb'" value="glb" disabled>UE 小白人 (GLB)</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] text-gray-400 mb-1">高度比例</label>
          <div class="flex items-center gap-2 h-[29px] bg-black/35 px-2 rounded border border-white/5">
            <input
              type="range"
              min="0.6"
              max="1.7"
              step="0.05"
              :value="scaleY"
              @mousedown="triggerHistoryStart"
              @touchstart="triggerHistoryStart"
              @input="emit('changeScaleY', parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full accent-[#29b6f6] h-1 bg-white/10 rounded cursor-pointer"
              id="model-height-slider"
            />
            <input
              type="number"
              step="any"
              :value="Number(scaleY.toFixed(2))"
              @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) { triggerHistoryStart(); emit('changeScaleY', v); } }"
              class="w-10 text-[10px] font-bold text-[#29b6f6] font-mono text-right bg-transparent border-b border-white/10 focus:border-[#29b6f6] outline-none shrink-0"
            />
          </div>
        </div>
      </div>

      <!-- 名字标签 -->
      <div class="flex items-center justify-between bg-black/20 px-2.5 py-1.5 rounded-lg border border-white/5">
        <span class="text-[10px] text-gray-400">浮空姓名牌显示</span>
        <div
          role="button"
          tabindex="0"
          @click="() => { triggerHistoryStart(); emit('changeShowLabel', !showLabel); }"
          @keydown.enter.prevent="() => { triggerHistoryStart(); emit('changeShowLabel', !showLabel); }"
          @keydown.space.prevent="() => { triggerHistoryStart(); emit('changeShowLabel', !showLabel); }"
          :class="[
            'px-3 py-1 rounded text-[10px] font-bold transition-all cursor-pointer',
            showLabel
              ? 'bg-[#29b6f6]/20 text-[#29b6f6] border border-[#29b6f6]/30'
              : 'bg-black/30 text-gray-500 hover:text-gray-300 border border-white/5'
          ]"
        >
          {{ showLabel ? '显示' : '隐藏' }}
        </div>
      </div>
    </div>

    <!-- 姿态暂存及预设库区块 -->
    <div class="border-t border-white/5 pt-3.5 space-y-3" id="pose-presets-section">
      <span class="text-[11px] font-bold tracking-wider text-gray-400 uppercase block">姿态暂存预设库</span>

      <!-- 保存新姿态的表单 -->
      <form @submit.prevent="handleSavePose" class="flex gap-1.5 bg-black/25 p-1 rounded-lg border border-white/5">
        <input
          type="text"
          required
          placeholder="命名... "
          v-model="newPresetName"
          class="flex-grow bg-transparent border-0 px-2 text-[10px] text-white focus:outline-none focus:ring-0 font-sans"
        />
        <div
          role="button"
          tabindex="0"
          @click="handleSavePose"
          @keydown.enter.prevent="handleSavePose"
          @keydown.space.prevent="handleSavePose"
          class="flex items-center gap-1 bg-[#29b6f6] hover:bg-[#00e5ff] text-zinc-950 font-bold px-2 py-1 rounded text-[10px] transition-colors shrink-0 cursor-pointer"
        >
          <span>存为预设</span>
        </div>
      </form>

      <!-- 预设列表 - 4列 (放四个) -->
      <div class="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
        
        <!-- 标准基础静态动作 (A-Pose) -->
        <div
          role="button"
          tabindex="0"
          @click="() => {
            const systemAPose = POSE_PRESETS.find(p => p.id === 'a-pose');
            if (systemAPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemAPose.joints)));
            }
          }"
          @keydown.enter.prevent="() => {
            const systemAPose = POSE_PRESETS.find(p => p.id === 'a-pose');
            if (systemAPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemAPose.joints)));
            }
          }"
          @keydown.space.prevent="() => {
            const systemAPose = POSE_PRESETS.find(p => p.id === 'a-pose');
            if (systemAPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemAPose.joints)));
            }
          }"
          class="relative group p-1 rounded-md border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer h-12 text-[9px]"
          title="点击一键应用系统 A姿势"
        >
          <div class="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-400 group-hover:text-black transition-all">
            <span class="text-[8px] font-mono font-bold font-sans">A</span>
          </div>
          <span class="text-gray-300 font-sans truncate w-full px-0.5">A-pose</span>
        </div>

        <!-- 标准基础静态动作 (T-Pose) -->
        <div
          role="button"
          tabindex="0"
          @click="() => {
            const systemTPose = POSE_PRESETS.find(p => p.id === 't-pose');
            if (systemTPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemTPose.joints)));
            }
          }"
          @keydown.enter.prevent="() => {
            const systemTPose = POSE_PRESETS.find(p => p.id === 't-pose');
            if (systemTPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemTPose.joints)));
            }
          }"
          @keydown.space.prevent="() => {
            const systemTPose = POSE_PRESETS.find(p => p.id === 't-pose');
            if (systemTPose) {
              triggerHistoryStart();
              emit('applyPresetPose', JSON.parse(JSON.stringify(systemTPose.joints)));
            }
          }"
          class="relative group p-1 rounded-md border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer h-12 text-[9px]"
          title="点击一键应用系统 T姿势"
        >
          <div class="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-400 group-hover:text-black transition-all">
            <span class="text-[8px] font-mono font-bold font-sans">T</span>
          </div>
          <span class="text-gray-300 font-sans truncate w-full px-0.5">T-pose</span>
        </div>

        <!-- 用户自定义暂存动作阵列 -->
        <div
          v-for="preset in customPresets"
          :key="preset.id"
          role="button"
          tabindex="0"
          @click="() => { triggerHistoryStart(); emit('applyPresetPose', JSON.parse(JSON.stringify(preset.joints))); }"
          @keydown.enter.prevent="() => { triggerHistoryStart(); emit('applyPresetPose', JSON.parse(JSON.stringify(preset.joints))); }"
          @keydown.space.prevent="() => { triggerHistoryStart(); emit('applyPresetPose', JSON.parse(JSON.stringify(preset.joints))); }"
          class="relative group p-1 rounded-md border border-[#29b6f6]/10 bg-[#1e2330]/20 hover:bg-[#1e2330]/40 hover:border-[#00e5ff]/30 transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer h-12 text-[9px]"
          :title="'点击应用【' + preset.name + '】姿势'"
        >
          <!-- 删除该自定义预设 - Hover显示 -->
          <div
            role="button"
            tabindex="0"
            @click.stop="emit('deleteCustomPreset', preset.id)"
            @keydown.enter.prevent.stop="emit('deleteCustomPreset', preset.id)"
            @keydown.space.prevent.stop="emit('deleteCustomPreset', preset.id)"
            class="absolute top-0.5 right-0.5 p-0.5 text-gray-400 hover:text-red-400 hover:bg-red-500/15 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
            title="删除该自定义预设"
          >
            <span class="text-[8px]">✕</span>
          </div>

          <div class="w-4 h-4 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 group-hover:bg-teal-400 group-hover:text-black transition-all">
            <span class="text-[7px] font-bold">★</span>
          </div>
          <span class="text-gray-200 font-sans truncate w-full px-0.5">
            {{ preset.name.length > 5 ? preset.name.slice(0, 4) + '…' : preset.name }}
          </span>
        </div>

        <div v-if="customPresets.length === 0" class="col-span-2 text-center py-2 text-[8px] text-gray-500 border border-dashed border-white/5 rounded-lg flex items-center justify-center">
          暂无自定义预设
        </div>
      </div>
    </div>

    <!-- 选择人偶骨骼关节 -->
    <div class="border-t border-white/5 pt-3.5" id="joint-selection-blueprint-section">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-bold tracking-wider text-gray-400 uppercase">选择旋转关节</span>
        <span class="text-[10px] font-mono font-bold text-[#29b6f6]">{{ JOINT_LABELS[selectedJointKey] }}</span>
      </div>
      
      <!-- 精细酷炫关节蓝图 -->
      <div class="flex justify-center mb-2.5 bg-black/35 p-3 rounded-lg border border-white/5 relative">
        <svg width="130" height="200" viewBox="0 0 100 160" class="opacity-95">
          <!-- 核心中轴骨骼骨架线 -->
          <line x1="50" y1="26" x2="50" y2="75" stroke="#1e293b" stroke-width="2.5" />
          <line x1="50" y1="26" x2="50" y2="75" stroke="#334155" stroke-width="1.5" stroke-dasharray="2,2" />
          
          <!-- 肩胛骨及盆腔连线 -->
          <line x1="28" y1="42" x2="72" y2="42" stroke="#475569" stroke-width="2" />
          <line x1="36" y1="75" x2="64" y2="75" stroke="#475569" stroke-width="2" />
          
          <!-- 头部节点 -->
          <circle
            cx="50"
            cy="20"
            r="8"
            :fill="selectedJointKey === 'head' ? '#00e5ff' : '#475569'"
            :stroke="selectedJointKey === 'head' ? '#ffffff' : '#0f172a'"
            stroke-width="1.5"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('head')"
          />
          <!-- 胸部骨盒 -->
          <rect
            x="39"
            y="38"
            width="22"
            height="18"
            rx="2"
            :fill="selectedJointKey === 'chest' ? '#00e5ff' : '#334155'"
            :stroke="selectedJointKey === 'chest' ? '#ffffff' : '#0f172a'"
            stroke-width="1.5"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('chest')"
          />
          <!-- 盆腔梯形 -->
          <polygon
            points="36,70 64,70 58,80 42,80"
            :fill="selectedJointKey === 'pelvis' ? '#00e5ff' : '#334155'"
            :stroke="selectedJointKey === 'pelvis' ? '#ffffff' : '#0f172a'"
            stroke-width="1.5"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('pelvis')"
          />
          
          <!-- 左手臂链 -->
          <circle
            cx="28"
            cy="42"
            r="4.5"
            :fill="selectedJointKey === 'leftShoulder' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftShoulder' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftShoulder')"
          />
          <line x1="28" y1="42" x2="20" y2="56" stroke="#475569" stroke-width="2.5" />
          <circle
            cx="20"
            cy="56"
            r="4.5"
            :fill="selectedJointKey === 'leftElbow' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftElbow' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftElbow')"
          />
          <line x1="20" y1="56" x2="14" y2="71" stroke="#475569" stroke-width="2" />
          <circle
            cx="14"
            cy="71"
            r="4"
            :fill="selectedJointKey === 'leftWrist' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftWrist' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftWrist')"
          />

          <!-- 右手臂链 -->
          <circle
            cx="72"
            cy="42"
            r="4.5"
            :fill="selectedJointKey === 'rightShoulder' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightShoulder' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightShoulder')"
          />
          <line x1="72" y1="42" x2="80" y2="56" stroke="#475569" stroke-width="2.5" />
          <circle
            cx="80"
            cy="56"
            r="4.5"
            :fill="selectedJointKey === 'rightElbow' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightElbow' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightElbow')"
          />
          <line x1="80" y1="56" x2="86" y2="71" stroke="#475569" stroke-width="2" />
          <circle
            cx="86"
            cy="71"
            r="4"
            :fill="selectedJointKey === 'rightWrist' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightWrist' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightWrist')"
          />

          <!-- 左大腿与膝盖脚踝 -->
          <circle
            cx="36"
            cy="76"
            r="4.5"
            :fill="selectedJointKey === 'leftHip' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftHip' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftHip')"
          />
          <line x1="36" y1="76" x2="34" y2="102" stroke="#475569" stroke-width="2.5" />
          <circle
            cx="34"
            cy="102"
            r="4.5"
            :fill="selectedJointKey === 'leftKnee' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftKnee' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftKnee')"
          />
          <line x1="34" y1="102" x2="34" y2="128" stroke="#475569" stroke-width="2" />
          <circle
            cx="34"
            cy="128"
            r="4"
            :fill="selectedJointKey === 'leftAnkle' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'leftAnkle' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('leftAnkle')"
          />

          <!-- 右大腿与膝盖脚踝 -->
          <circle
            cx="64"
            cy="76"
            r="4.5"
            :fill="selectedJointKey === 'rightHip' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightHip' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightHip')"
          />
          <line x1="64" y1="76" x2="66" y2="102" stroke="#475569" stroke-width="2.5" />
          <circle
            cx="66"
            cy="102"
            r="4.5"
            :fill="selectedJointKey === 'rightKnee' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightKnee' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightKnee')"
          />
          <line x1="66" y1="102" x2="66" y2="128" stroke="#475569" stroke-width="2" />
          <circle
            cx="66"
            cy="128"
            r="4"
            :fill="selectedJointKey === 'rightAnkle' ? '#00e5ff' : '#94a3b8'"
            :stroke="selectedJointKey === 'rightAnkle' ? '#ffffff' : '#0f172a'"
            stroke-width="1"
            class="cursor-pointer hover:fill-[#00e5ff] hover:stroke-white transition-all duration-150"
            @click="setSelectedJointKey('rightAnkle')"
          />
        </svg>
        <div class="absolute bottom-2 inset-x-2 text-center text-[9px] text-gray-500 font-mono bg-black/50 py-0.5 rounded">
          点击模型部位可直接选中关节
        </div>
      </div>

      <!-- 快速下拉选择 -->
      <select
        :value="selectedJointKey"
        @change="setSelectedJointKey(($event.target as HTMLSelectElement).value as any)"
        class="w-full text-xs bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none cursor-pointer"
        id="active-joint-dropdown"
      >
        <option v-for="key in jointKeys" :key="key" :value="key" class="bg-[#111318] text-white">
          关节: {{ JOINT_LABELS[key] }} ({{ key }})
        </option>
      </select>
    </div>

    <!-- 3D 关节姿态微调拉杆 -->
    <div class="border-t border-white/5 pt-3.5 space-y-3">
      <div class="flex justify-between items-center text-xs">
        <span class="font-bold text-[#29b6f6]">轴向参数精微控制</span>
        <div
          role="button"
          tabindex="0"
          @click="handleResetJoint"
          @keydown.enter.prevent="handleResetJoint"
          @keydown.space.prevent="handleResetJoint"
          class="text-[9px] hover:text-white bg-white/5 hover:bg-white/10 text-gray-400 px-2.5 py-1 rounded transition-colors cursor-pointer"
          id="reset-joint-button"
        >
          归零所选关节
        </div>
      </div>

      <!-- Pitch (X) -->
      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-300">
          <span>前后俯仰 (Pitch / X axis)</span>
          <input
            type="number"
            step="any"
            :value="activeRotation.x"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) { triggerHistoryStart(); handleAngleChange('x', v); } }"
            class="w-10 font-mono text-right bg-transparent border-b border-white/10 focus:border-[#00e5ff] outline-none shrink-0"
            :class="activeRotation.x !== 0 ? 'text-[#00e5ff] font-bold' : 'text-gray-500'"
          />
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          :value="activeRotation.x"
          @mousedown="triggerHistoryStart"
          @touchstart="triggerHistoryStart"
          @input="handleAngleChange('x', parseInt(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#00e5ff] h-1 bg-white/10 rounded cursor-pointer"
          id="joint-x-slider"
        />
      </div>

      <!-- Yaw (Y) -->
      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-300">
          <span>左右旋转 (Yaw / Y axis)</span>
          <input
            type="number"
            step="any"
            :value="activeRotation.y"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) { triggerHistoryStart(); handleAngleChange('y', v); } }"
            class="w-10 font-mono text-right bg-transparent border-b border-white/10 focus:border-[#00e5ff] outline-none shrink-0"
            :class="activeRotation.y !== 0 ? 'text-[#00e5ff] font-bold' : 'text-gray-500'"
          />
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          :value="activeRotation.y"
          @mousedown="triggerHistoryStart"
          @touchstart="triggerHistoryStart"
          @input="handleAngleChange('y', parseInt(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#00e5ff] h-1 bg-white/10 rounded cursor-pointer"
          id="joint-y-slider"
        />
      </div>

      <!-- Roll (Z) -->
      <div class="space-y-1">
        <div class="flex justify-between items-center text-[10px] text-gray-300">
          <span>自我自旋 (Roll / Z axis)</span>
          <input
            type="number"
            step="any"
            :value="activeRotation.z"
            @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v)) { triggerHistoryStart(); handleAngleChange('z', v); } }"
            class="w-10 font-mono text-right bg-transparent border-b border-white/10 focus:border-[#00e5ff] outline-none shrink-0"
            :class="activeRotation.z !== 0 ? 'text-[#00e5ff] font-bold' : 'text-gray-500'"
          />
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          :value="activeRotation.z"
          @mousedown="triggerHistoryStart"
          @touchstart="triggerHistoryStart"
          @input="handleAngleChange('z', parseInt(($event.target as HTMLInputElement).value))"
          class="w-full accent-[#00e5ff] h-1 bg-white/10 rounded cursor-pointer"
          id="joint-z-slider"
        />
      </div>
    </div>

  </div>
</template>
