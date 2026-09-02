<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { DistributionEngine } from '@/utils/director3DDistribution';
import { MannequinObject, DirectingProject, Vector3D } from '@/components/director-3d/director3D.types';
import { POSE_PRESETS, PRESET_GLB_MODELS } from '@/components/director-3d/director3D.constants';

const UE_MANNY = PRESET_GLB_MODELS.find(m => m.id === 'glb_ue_manny');

const props = defineProps<{
  project: DirectingProject;
}>();

const emit = defineEmits<{
  (e: 'addMannequins', newMannequins: MannequinObject[]): void;
  (e: 'commitHistory'): void;
}>();

const layoutType = ref<'circle' | 'circle-filled' | 'triangle' | 'vee' | 'line' | 'grid' | 'random'>('circle');
const mannequinStyle = ref<'detailed' | 'simple' | 'glb_ue'>('simple');
const mannequinColor = ref('#2bcbba');

const PROTAGONIST_NAMES = [
  '主角·艾莉丝', '主角·林风', '主角·雷恩', '主角·雪莉', '主角·龙介',
  '主角·苏珊', '主角·席维斯', '主角·白泽', '主角·沈墨', '主角·楚晨'
];

const BYSTANDER_NAMES = [
  '路人·小草', '路人·甲', '路人·乙', '路人·丙', '咖啡馆顾客',
  '执勤哨兵', '街头市民', '船巡洋兵', '保洁阿姨', '买菜大叔',
  '路过学生', '战术队员', '装配水兵', '货车司机', '吃瓜群众'
];

const circleRadius = ref<number>(4);
const circleCount = ref<number>(6);

const triangleSpacingX = ref<number>(2.0);
const triangleSpacingZ = ref<number>(2.0);
const triangleCount = ref<number>(10);

const veeSpacingX = ref<number>(2.2);
const veeSpacingZ = ref<number>(1.8);
const veeCount = ref<number>(7);

const lineLength = ref<number>(8);
const lineCount = ref<number>(5);

const gridRows = ref<number>(3);
const gridCols = ref<number>(3);
const gridSpacingX = ref<number>(2.2);
const gridSpacingZ = ref<number>(2.2);

const areaWidth = ref<number>(8);
const areaDepth = ref<number>(8);
const randomCount = ref<number>(8);

function getBaseTemplate(): MannequinObject {
  const isGlb = mannequinStyle.value === 'glb_ue';
  return {
    id: '',
    name: '',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: mannequinColor.value,
    visible: true,
    style: mannequinStyle.value === 'glb_ue' ? 'glb' : mannequinStyle.value,
    ...(isGlb && UE_MANNY ? { glbId: UE_MANNY.id, glbUrl: UE_MANNY.url } : {}),
    joints: JSON.parse(JSON.stringify(POSE_PRESETS.find(p => p.id === 'a-pose')?.joints || POSE_PRESETS[0].joints)),
  };
}

function handleGenerateDistribution() {
  emit('commitHistory');
  const template = getBaseTemplate();
  const center: Vector3D = { x: 0, y: 0, z: 0 };
  let spawned: MannequinObject[] = [];

  const engineStyle = mannequinStyle.value === 'glb_ue' ? 'glb' as const : mannequinStyle.value;

  if (layoutType.value === 'circle') {
    spawned = DistributionEngine.distributeCircle(center, circleRadius.value, circleCount.value, template, engineStyle);
  } else if (layoutType.value === 'circle-filled') {
    spawned = DistributionEngine.distributeCircleFilled(center, circleRadius.value, circleCount.value, template, engineStyle);
  } else if (layoutType.value === 'triangle') {
    spawned = DistributionEngine.distributeTriangle(center, triangleSpacingX.value, triangleSpacingZ.value, triangleCount.value, template, engineStyle);
  } else if (layoutType.value === 'vee') {
    spawned = DistributionEngine.distributeVee(center, veeSpacingX.value, veeSpacingZ.value, veeCount.value, template, engineStyle);
  } else if (layoutType.value === 'line') {
    const start: Vector3D = { x: -lineLength.value / 2, y: 0, z: 0 };
    const end: Vector3D = { x: lineLength.value / 2, y: 0, z: 0 };
    spawned = DistributionEngine.distributeLine(start, end, lineCount.value, template, engineStyle);
  } else if (layoutType.value === 'grid') {
    spawned = DistributionEngine.distributeGrid(center, gridRows.value, gridCols.value, gridSpacingX.value, gridSpacingZ.value, template, engineStyle);
  } else if (layoutType.value === 'random') {
    spawned = DistributionEngine.distributeRandomArea(center, areaWidth.value, areaDepth.value, randomCount.value, template, engineStyle);
  }

  if (spawned.length > 0) {
    const groupId = `group_${Date.now()}`;
    const shapeLabel = 
      layoutType.value === 'circle' ? '环形' : 
      layoutType.value === 'circle-filled' ? '实心圆' : 
      layoutType.value === 'triangle' ? '三角' : 
      layoutType.value === 'vee' ? '燕尾' : 
      layoutType.value === 'line' ? '线性' : 
      layoutType.value === 'grid' ? '矩阵' : '随区';
    const typeLabel =
      mannequinStyle.value === 'detailed' ? '高精' :
      mannequinStyle.value === 'simple' ? '极简' : 'UE人';
    const groupName = `人偶${shapeLabel}[${typeLabel}]-${Math.floor(Math.random() * 900 + 100)}组`;

    const groupedSpawned = spawned.map((m, idx) => {
      const charName = m.style === 'detailed'
        ? PROTAGONIST_NAMES[idx % PROTAGONIST_NAMES.length] + `-${idx + 1}`
        : BYSTANDER_NAMES[idx % BYSTANDER_NAMES.length] + `-${idx + 1}`;
      return {
        ...m,
        groupId,
        groupName,
        name: charName,
        showLabel: false,
        isGeneratedByArray: true,
      };
    });

    emit('addMannequins', groupedSpawned);
  }
}
</script>

<template>
  <div class="space-y-4 text-left animate-fade-in" id="distribution-panel-container">
    <!-- Select Mannequin Representation Style -->
    <div class="space-y-2 border-t border-white/5 pt-3">
      <label class="text-[11px] font-mono text-gray-400 block font-bold">人偶形体风格</label>
      <div class="grid grid-cols-3 gap-1 bg bg-black/30 p-1 rounded-xl border border-white/5">
        <div
          v-for="style in (['detailed', 'simple', 'glb_ue'] as const)"
          :key="style"
          role="button"
          tabindex="0"
          @click="mannequinStyle = style"
          @keydown.enter.prevent="mannequinStyle = style"
          @keydown.space.prevent="mannequinStyle = style"
          :class="[
            'py-1.5 px-0.5 rounded text-[10px] font-mono border cursor-pointer text-center transition-all',
            mannequinStyle === style
              ? 'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/40 font-bold shadow-lg'
              : 'bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-white/5'
          ]"
        >
          {{ 
            style === 'detailed' ? '高精骨骼' :
            style === 'simple' ? '极简木偶' : '小白人'
          }}
        </div>
      </div>
    </div>

    <!-- Color Customizer -->
    <div class="grid grid-cols-2 gap-2 items-center">
      <label class="text-[11px] font-mono text-gray-400">设定群组颜色:</label>
      <div class="flex gap-1.5 justify-end">
        <div
          v-for="c in ['#2bcbba', '#4b7bec', '#a55eff', '#eb3b5a', '#fa8231', '#20bf6b']"
          :key="c"
          role="button"
          tabindex="0"
          @click="mannequinColor = c"
          @keydown.enter.prevent="mannequinColor = c"
          @keydown.space.prevent="mannequinColor = c"
          class="w-4 h-4 rounded-full border border-white/20 transition-transform active:scale-90 cursor-pointer"
          :style="{ backgroundColor: c, boxShadow: mannequinColor === c ? '0 0 8px ' + c : 'none' }"
        />
      </div>
    </div>

    <!-- Layout Grid Buttons Selection -->
    <div class="space-y-2 border-t border-white/5 pt-3">
      <label class="text-[11px] font-mono text-gray-400 block font-bold">选择几何排列图形</label>
      <div class="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'circle'"
          @keydown.enter.prevent="layoutType = 'circle'"
          @keydown.space.prevent="layoutType = 'circle'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'circle' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          title="小人仅排布在圆圈圆周边缘"
        >
          <Icon icon="lucide:circle" :width="14" :height="14" />
          <span class="text-[9px] font-mono font-medium">只圆周上</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'circle-filled'"
          @keydown.enter.prevent="layoutType = 'circle-filled'"
          @keydown.space.prevent="layoutType = 'circle-filled'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'circle-filled' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          title="利用斐波那契螺旋盘布满整个圆形内部"
        >
          <Icon icon="lucide:circle-dot" :width="14" :height="14" />
          <span class="text-[9px] font-mono font-medium">实心圆内</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'triangle'"
          @keydown.enter.prevent="layoutType = 'triangle'"
          @keydown.space.prevent="layoutType = 'triangle'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'triangle' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          title="经典三角形/楔形雁阵防卫布阵"
        >
          <Icon icon="lucide:triangle" :width="14" :height="14" />
          <span class="text-[9px] font-mono font-medium">三角布阵</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'vee'"
          @keydown.enter.prevent="layoutType = 'vee'"
          @keydown.space.prevent="layoutType = 'vee'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'vee' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
          title="燕尾双翼夹击型阵型"
        >
          <Icon icon="lucide:chevrons-down" :width="14" :height="14" class="rotate-180" />
          <span class="text-[9px] font-mono font-medium">燕尾阵型</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'line'"
          @keydown.enter.prevent="layoutType = 'line'"
          @keydown.space.prevent="layoutType = 'line'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'line' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
        >
          <Icon icon="lucide:arrow-down-right" :width="14" :height="14" class="rotate-[-45deg]" />
          <span class="text-[9px] font-mono font-medium">线性对齐</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'grid'"
          @keydown.enter.prevent="layoutType = 'grid'"
          @keydown.space.prevent="layoutType = 'grid'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'grid' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
        >
          <Icon icon="lucide:grid" :width="14" />
          <span class="text-[9px] font-mono font-medium">网格矩阵</span>
        </div>

        <div
          role="button"
          tabindex="0"
          @click="layoutType = 'random'"
          @keydown.enter.prevent="layoutType = 'random'"
          @keydown.space.prevent="layoutType = 'random'"
          :class="[
            'p-2 rounded flex flex-col items-center gap-1 transition-all cursor-pointer',
            layoutType === 'random' ? 'bg-[#3b82f6] text-white shadow-lg font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
          ]"
        >
          <Icon icon="lucide:shuffle" :width="14" :height="14" />
          <span class="text-[9px] font-mono font-medium">区域随机</span>
        </div>
      </div>
    </div>

    <!-- Dynamic parameters for selected geometry -->
    <div class="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
      <div v-if="layoutType === 'circle'">
        <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
          <span>环绕半径</span>
          <span class="text-[#3b82f6]">{{ circleRadius }}米</span>
        </div>
        <input
          type="range"
          min="1.5"
          max="12"
          step="0.5"
          v-model.number="circleRadius"
          class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
        />
        <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1 mt-3">
          <span>生成人数</span>
          <span class="text-[#3b82f6]">{{ circleCount }}人</span>
        </div>
        <input
          type="range"
          min="2"
          max="24"
          step="1"
          v-model.number="circleCount"
          class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
        />
      </div>

      <div v-if="layoutType === 'circle-filled'">
        <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
          <span>实心圆分布半径</span>
          <span class="text-[#3b82f6]">{{ circleRadius }}米</span>
        </div>
        <input
          type="range"
          min="1.5"
          max="12"
          step="0.5"
          v-model.number="circleRadius"
          class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
        />
        <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1 mt-3">
          <span>螺旋分布总人数</span>
          <span class="text-[#3b82f6]">{{ circleCount }}人</span>
        </div>
        <input
          type="range"
          min="3"
          max="32"
          step="1"
          v-model.number="circleCount"
          class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
        />
      </div>

      <div v-if="layoutType === 'triangle'">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">横向间距 X</span>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              v-model.number="triangleSpacingX"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-[#3b82f6] float-right">{{ triangleSpacingX }}米</span>
          </div>
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">纵深间距 Z</span>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              v-model.number="triangleSpacingZ"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-[#3b82f6] float-right">{{ triangleSpacingZ }}米</span>
          </div>
        </div>
        <div>
          <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
            <span>三角生成总人数</span>
            <span class="text-[#3b82f6]">{{ triangleCount }}人</span>
          </div>
          <input
            type="range"
            min="3"
            max="28"
            step="1"
            v-model.number="triangleCount"
            class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
          />
        </div>
      </div>

      <div v-if="layoutType === 'vee'">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">双翼开展宽度 X</span>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              v-model.number="veeSpacingX"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-[#3b82f6] float-right">{{ veeSpacingX }}米</span>
          </div>
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">两翼纵深轴距 Z</span>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              v-model.number="veeSpacingZ"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-[#3b82f6] float-right">{{ veeSpacingZ }}米</span>
          </div>
        </div>
        <div>
          <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
            <span>燕尾队形总人数</span>
            <span class="text-[#3b82f6]">{{ veeCount }}人</span>
          </div>
          <input
            type="range"
            min="3"
            max="25"
            step="1"
            v-model.number="veeCount"
            class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
          />
        </div>
      </div>

      <div v-if="layoutType === 'line'">
        <div>
          <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
            <span>线段长度</span>
            <span class="text-[#3b82f6]">{{ lineLength }}米</span>
          </div>
          <input
            type="range"
            min="2"
            max="20"
            step="0.5"
            v-model.number="lineLength"
            class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
          />
        </div>
        <div class="mt-3">
          <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
            <span>等分人数</span>
            <span class="text-[#3b82f6]">{{ lineCount }}人</span>
          </div>
          <input
            type="range"
            min="2"
            max="16"
            step="1"
            v-model.number="lineCount"
            class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
          />
        </div>
      </div>

      <div v-if="layoutType === 'grid'">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label class="text-[10px] text-gray-400 font-mono block mb-1">矩阵行数(Rows)</label>
            <input
              type="number"
              min="1"
              max="6"
              v-model.number="gridRows"
              class="w-full bg-black/40 border border-white/15 rounded p-1 text-xs font-mono text-white text-center"
            />
          </div>
          <div>
            <label class="text-[10px] text-gray-400 font-mono block mb-1">矩阵列数(Cols)</label>
            <input
              type="number"
              min="1"
              max="6"
              v-model.number="gridCols"
              class="w-full bg-black/40 border border-white/15 rounded p-1 text-xs font-mono text-white text-center"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">行间距 Z</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.1"
              v-model.number="gridSpacingZ"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-gray-500 float-right">{{ gridSpacingZ }}米</span>
          </div>
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">列间距 X</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.1"
              v-model.number="gridSpacingX"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-gray-500 float-right">{{ gridSpacingX }}米</span>
          </div>
        </div>
      </div>

      <div v-if="layoutType === 'random'">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">区域布阵宽度</span>
            <input
              type="range"
              min="2"
              max="16"
              step="0.5"
              v-model.number="areaWidth"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-gray-500 float-right">{{ areaWidth }}米</span>
          </div>
          <div>
            <span class="text-[10px] text-gray-400 font-mono block mb-1">区域布阵深度</span>
            <input
              type="range"
              min="2"
              max="16"
              step="0.5"
              v-model.number="areaDepth"
              class="w-full accent-[#3b82f6] h-1"
            />
            <span class="text-[9px] font-mono text-gray-500 float-right">{{ areaDepth }}米</span>
          </div>
        </div>
        <div>
          <div class="flex justify-between text-[11px] text-gray-400 font-mono mb-1">
            <span>生成随机模特数</span>
            <span class="text-[#3b82f6]">{{ randomCount }}人</span>
          </div>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            v-model.number="randomCount"
            class="w-full h-1 bg-white/10 rounded cursor-pointer accent-[#3b82f6]"
          />
        </div>
      </div>
    </div>

    <!-- Deploy Button -->
    <div
      role="button"
      tabindex="0"
      @click="handleGenerateDistribution"
      @keydown.enter.prevent="handleGenerateDistribution"
      @keydown.space.prevent="handleGenerateDistribution"
      class="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all rounded-lg text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer"
      id="deploy-layout-btn"
    >
      <span>部署阵列</span>
    </div>
  </div>
</template>
