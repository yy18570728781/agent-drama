<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { DirectingProject, MannequinObject, ImagePlaneObject, CameraConfig, LightConfig, MannequinJoints } from '@/components/director-3d/director3D.types';
import JointControls from '@/components/director-3d/panels/JointControls.vue';
import ImageControls from '@/components/director-3d/panels/ImageControls.vue';
import CameraLightControls from '@/components/director-3d/panels/CameraLightControls.vue';
import GroundControls from '@/components/director-3d/panels/GroundControls.vue';
import TransformInspector from '@/components/director-3d/panels/TransformInspector.vue';
import GroupControlsPanel from '@/components/director-3d/panels/GroupControlsPanel.vue';
import CameraProSettings from '@/components/director-3d/panels/CameraProSettings.vue';

const props = withDefaults(defineProps<{
  project: DirectingProject;
  selectedElementId: string | null;
  selectedElementType: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null;
  selectedJointKey: keyof MannequinJoints | null;
  customPresets: Array<{ id: string; name: string; joints: MannequinJoints }>;
}>(), {
});

const emit = defineEmits<{
  (e: 'changeSelectedJointKey', val: keyof MannequinJoints): void;
  (e: 'updateProject', proj: DirectingProject): void;
  (e: 'selectElement', id: string | null, type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null): void;
  (e: 'commitHistory'): void;
  (e: 'applyPresetPose', poseJoints: MannequinJoints): void;
  (e: 'updateMannequin', id: string, data: Partial<MannequinObject>): void;
  (e: 'updateImage', id: string, data: Partial<ImagePlaneObject>): void;
  (e: 'updateCamera', id: string, data: Partial<CameraConfig>): void;
  (e: 'updateLight', id: string, data: Partial<LightConfig>): void;
  (e: 'deleteElement', id: string, type: 'mannequin' | 'camera' | 'image' | 'light'): void;
  (e: 'addMannequinToGroup', mannequinId: string, groupId: string): void;
  (e: 'removeMannequinFromGroup', mannequinId: string): void;
  (e: 'saveCustomPreset', name: string, joints: MannequinJoints): void;
  (e: 'deleteCustomPreset', id: string): void;
}>();

const activeTab = ref<'attributes' | 'pose'>('attributes');

const selectedMannequin = computed(() => {
  return props.selectedElementType === 'mannequin'
    ? props.project.mannequins.find(m => m.id === props.selectedElementId)
    : null;
});

const selectedImagePlane = computed(() => {
  return props.selectedElementType === 'image'
    ? props.project.imagePlanes.find(img => img.id === props.selectedElementId)
    : null;
});

const selectedCameraVal = computed(() => {
  return props.selectedElementType === 'camera'
    ? props.project.cameras.find(c => c.id === props.selectedElementId)
    : null;
});

const selectedLightVal = computed(() => {
  return props.selectedElementType === 'light'
    ? props.project.lights.find(l => l.id === props.selectedElementId)
    : null;
});

// 各属性面板都有对应的非空 v-if 守卫，单独的别名让模板类型检查保留该约束。
const activeMannequin = computed(() => selectedMannequin.value as MannequinObject);
const activeImagePlane = computed(() => selectedImagePlane.value as ImagePlaneObject);
const activeCamera = computed(() => selectedCameraVal.value as CameraConfig);
const activeLight = computed(() => selectedLightVal.value as LightConfig);
const activeMannequinStyle = computed<'detailed' | 'simple' | 'glb'>(() => {
  const style = activeMannequin.value.style;
  return style === 'simple' || style === 'glb' ? style : 'detailed';
});

const selectedGroupObject = computed(() => {
  if (props.selectedElementType === 'group' && props.selectedElementId) {
    const foundMannequin = props.project.mannequins.find(m => m.groupId === props.selectedElementId);
    return {
      id: props.selectedElementId,
      name: foundMannequin?.groupName || '合唱/队形阵列'
    };
  }
  return null;
});

const groupMannequins = computed(() => {
  return selectedGroupObject.value
    ? props.project.mannequins.filter(m => m.groupId === selectedGroupObject.value!.id)
    : [];
});

function updateProjectGroundAndGrid(showGridValue: boolean) {
  emit('commitHistory');
  emit('updateProject', { ...props.project, showGrid: showGridValue });
}

function updateProjectHelpers(hideHelpersValue: boolean) {
  emit('commitHistory');
  emit('updateProject', { ...props.project, hideHelpers: hideHelpersValue });
}
</script>

<template>
  <aside class="w-80 bg-[#111318] border-l border-[#ffffff]/5 flex flex-col justify-between shrink-0 h-full shadow-2xl relative select-none" id="sidebar-right-root">
    <div class="flex flex-col h-full overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
      
      <!-- Header Indicator -->
      <div class="flex justify-between items-center pb-2 border-b border-white/5">
        <span class="text-[12px] font-sans font-medium text-white tracking-wide">
          {{ selectedElementType === 'mannequin' && selectedMannequin ? '角色' : '对象属性' }}
        </span>
        <span class="text-[9px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-gray-500 font-mono uppercase">
          {{ selectedElementType ? selectedElementType : 'SCENE' }}
        </span>
      </div>

      <!-- 1. SELECTION CONDITIONAL REDIRECTS -->
      <div class="flex-grow space-y-4">
        <!-- A. NO SELECTION: GENERAL SCENE PARAMETERS -->
        <div v-if="!selectedElementType" class="space-y-4">
          <div class="rounded-xl bg-black/20 p-4 border border-white/5 space-y-4">
            <div class="flex items-center gap-2 border-b border-white/5 pb-2">
              <Icon icon="lucide:settings" :width="13" class="text-blue-400" />
              <span class="text-xs font-semibold text-white">场景环境参数</span>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">显示网格地面</span>
                <input
                  type="checkbox"
                  :checked="project.showGrid !== false"
                  @change="updateProjectGroundAndGrid(($event.target as HTMLInputElement).checked)"
                  class="rounded border-white/10 bg-black text-blue-500 cursor-pointer"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">显示变换轴</span>
                <input
                  type="checkbox"
                  :checked="!project.hideHelpers"
                  @change="updateProjectHelpers(!($event.target as HTMLInputElement).checked)"
                  class="rounded border-white/10 bg-black text-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div class="rounded-xl bg-black/20 p-4 border border-white/5 space-y-3">
            <div class="flex items-center gap-2 border-b border-white/5 pb-2">
              <Icon icon="lucide:sliders" :width="13" class="text-yellow-400" />
              <span class="text-xs font-semibold text-white">天空背景贴图</span>
            </div>
            <p class="text-[10px] text-gray-500 leading-relaxed font-sans5">
              通过工作流连接传递图片至3D空间，将其渲染为360背景
            </p>
          </div>
        </div>

        <!-- B. MANNEQUIN (CHARACTER) TABBED DETAILS -->
        <div v-if="selectedElementType === 'mannequin' && selectedMannequin" class="space-y-4">
          <!-- Tabs selector -->
          <div class="flex bg-[#181a20] p-0.5 rounded-lg border border-white/5">
            <div
              role="button"
              tabindex="0"
              @click="activeTab = 'attributes'"
              @keydown.enter.prevent="activeTab = 'attributes'"
              @keydown.space.prevent="activeTab = 'attributes'"
              :class="[
                'flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-center',
                activeTab === 'attributes'
                  ? 'bg-white/[0.08] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              ]"
            >
              属性
            </div>
            <div
              role="button"
              tabindex="0"
              @click="activeTab = 'pose'"
              @keydown.enter.prevent="activeTab = 'pose'"
              @keydown.space.prevent="activeTab = 'pose'"
              :class="[
                'flex-1 py-1.5 text-xs rounded-md font-medium transition-all cursor-pointer text-center',
                activeTab === 'pose'
                  ? 'bg-white/[0.08] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              ]"
            >
              姿势
            </div>
          </div>

          <!-- TAB CONTENT: ATTRIBUTES -->
          <div v-if="activeTab === 'attributes'" class="space-y-4 animate-fade-in">
            <!-- Basic identifier and name -->
            <div class="bg-[#14171d]/60 p-3.5 rounded-xl border border-white/5 space-y-3.5">
              <div class="text-[11px] font-medium text-gray-400 pb-1.5 border-b border-white/5 flex items-center justify-between">
                <span>基础代号</span>
                <span class="text-[10px] font-mono text-gray-500">ID: {{ activeMannequin.id.slice(0, 6) }}</span>
              </div>

              <!-- Character Name Input -->
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 block pl-0.5">名称</label>
                <input
                  type="text"
                  :value="activeMannequin.name"
                  @input="($event) => { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { name: ($event.target as HTMLInputElement).value }); }"
                  class="w-full text-xs bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              <!-- Color Swatch & picker -->
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 block pl-0.5">颜色</label>
                <div class="flex items-center gap-2.5 bg-black/30 border border-white/10 px-2.5 py-1.5 rounded-lg h-[34px]">
                  <input
                    type="color"
                    :value="activeMannequin.color"
                    @mousedown="emit('commitHistory')"
                    @input="emit('updateMannequin', activeMannequin.id, { color: ($event.target as HTMLInputElement).value })"
                    class="w-5 h-5 border-0 bg-transparent cursor-pointer rounded shrink-0"
                  />
                  <span class="text-[11px] font-mono text-gray-300 uppercase">{{ activeMannequin.color }}</span>
                </div>
              </div>
            </div>

            <!-- Positioning, Rotates and Scales inspector -->
            <TransformInspector
              :title="activeMannequin.name"
              type="mannequin"
              :position="activeMannequin.position"
              :rotation="activeMannequin.rotation"
              :scale="activeMannequin.scale"
              @change="(updated) => emit('updateMannequin', activeMannequin.id, updated)"
            />

            <!-- Comprehensive detailed styling of model assets -->
            <div class="bg-[#14171d]/60 p-3.5 rounded-xl border border-white/5 space-y-3.5">
              <div class="text-[11px] font-medium text-gray-400 pb-1.5 border-b border-white/5">
                <span>傀儡模型高级参数</span>
              </div>

              <!-- Uniform Scale Multiplier -->
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 block">统一缩放</label>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    :value="activeMannequin.scale.x"
                    @mousedown="emit('commitHistory')"
                    @input="($event) => {
                      const val = parseFloat(($event.target as HTMLInputElement).value);
                      emit('updateMannequin', activeMannequin.id, {
                        scale: { x: val, y: val, z: val }
                      });
                    }"
                    class="flex-grow accent-blue-500 h-1 bg-white/10 rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    step="any"
                    :value="Number(activeMannequin.scale.x.toFixed(1))"
                    @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { scale: { x: v, y: v, z: v } }); } }"
                    class="w-10 text-[10px] font-mono font-bold text-blue-400 text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0"
                  />
                </div>
              </div>

              <!-- Rig Controller Scale -->
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 block">关节控制器比例</label>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.2"
                    max="3"
                    step="0.05"
                    :value="activeMannequin.controllerScale ?? 1"
                    @mousedown="emit('commitHistory')"
                    @input="emit('updateMannequin', activeMannequin.id, { controllerScale: parseFloat(($event.target as HTMLInputElement).value) })"
                    class="flex-grow accent-purple-500 h-1 bg-white/10 rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    step="any"
                    :value="Number((activeMannequin.controllerScale ?? 1).toFixed(2))"
                    @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { controllerScale: v }); } }"
                    class="w-10 text-[10px] font-mono font-bold text-purple-400 text-right bg-transparent border-b border-white/10 focus:border-purple-500 outline-none shrink-0"
                  />
                </div>
              </div>

              <!-- Height scaling slider (Vertical scaling) -->
              <div class="space-y-1">
                <label class="text-[10px] text-gray-400 block">高度形体比例</label>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.6"
                    max="1.7"
                    step="0.05"
                    :value="activeMannequin.scale.y"
                    @mousedown="emit('commitHistory')"
                    @input="emit('updateMannequin', activeMannequin.id, { scale: { x: activeMannequin.scale.x, y: parseFloat(($event.target as HTMLInputElement).value), z: activeMannequin.scale.z } })"
                    class="flex-grow accent-blue-500 h-1 bg-white/10 rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    step="any"
                    :value="Number(activeMannequin.scale.y.toFixed(2))"
                    @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v > 0) { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { scale: { x: activeMannequin.scale.x, y: v, z: activeMannequin.scale.z } }); } }"
                    class="w-10 text-[10px] font-mono font-bold text-gray-300 text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0"
                  />
                </div>
              </div>

              <!-- Style selector and Glb Selector -->
              <div class="space-y-1 pt-1">
                <label class="text-[10px] text-gray-400 block mb-1">骨骼样式</label>
                <select
                  :value="activeMannequin.style === 'glb' ? 'glb' : activeMannequin.style"
                  @change="($event) => {
                    const val = ($event.target as HTMLSelectElement).value;
                    emit('commitHistory');
                    if (val === 'detailed' || val === 'simple') {
                      emit('updateMannequin', activeMannequin.id, { style: val });
                    }
                  }"
                  class="w-full text-xs bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none cursor-pointer focus:border-blue-500 transition-colors"
                >
                  <option value="detailed">高精骨骼</option>
                  <option value="simple">极简木偶</option>
                  <option v-if="activeMannequin.style === 'glb'" value="glb" disabled>小白人</option>
                </select>
              </div>

              <!-- Floating Label show title option -->
              <div class="flex items-center justify-between pt-1">
                <span class="text-[10px] text-gray-400">浮空名字牌</span>
                <div
                  role="button"
                  tabindex="0"
                  @click="() => { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { showLabel: !(activeMannequin.showLabel ?? false) }); }"
                  @keydown.enter.prevent="() => { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { showLabel: !(activeMannequin.showLabel ?? false) }); }"
                  @keydown.space.prevent="() => { emit('commitHistory'); emit('updateMannequin', activeMannequin.id, { showLabel: !(activeMannequin.showLabel ?? false) }); }"
                  :class="[
                    'px-3 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer',
                    activeMannequin.showLabel
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                      : 'bg-black/30 text-gray-600 border border-white/5'
                  ]"
                >
                  {{ activeMannequin.showLabel ? '已开启' : '已关闭' }}
                </div>
              </div>
            </div>
          </div>

          <!-- TAB CONTENT: POSE (JOINT CONTROLLER) -->
          <div v-if="activeTab === 'pose'" class="animate-fade-in">
            <JointControls
              :joints="activeMannequin.joints"
              @changeJoints="(newJoints) => emit('updateMannequin', activeMannequin.id, { joints: newJoints })"
              :color="activeMannequin.color"
              @changeColor="(newColor) => emit('updateMannequin', activeMannequin.id, { color: newColor })"
              :name="activeMannequin.name"
              @changeName="(newName) => emit('updateMannequin', activeMannequin.id, { name: newName })"
              :scaleY="activeMannequin.scale.y"
              @changeScaleY="(newScaleY) => emit('updateMannequin', activeMannequin.id, { scale: { x: activeMannequin.scale.x, y: newScaleY, z: activeMannequin.scale.z } })"
              :selectedJointKey="selectedJointKey"
              @changeSelectedJointKey="(val) => emit('changeSelectedJointKey', val)"
              :style="activeMannequinStyle"
              @changeStyle="(style) => emit('updateMannequin', activeMannequin.id, { style })"
              @applyPresetPose="(joints) => emit('applyPresetPose', joints)"
              :showLabel="activeMannequin.showLabel ?? false"
              @changeShowLabel="(val) => emit('updateMannequin', activeMannequin.id, { showLabel: val })"
              @commitHistory="emit('commitHistory')"
              :customPresets="customPresets"
              @saveCustomPreset="(name, joints) => emit('saveCustomPreset', name, joints)"
              @deleteCustomPreset="(id) => emit('deleteCustomPreset', id)"
              :glbId="activeMannequin.glbId"
              :hideBaseProperties="true"
            />
          </div>
        </div>

        <!-- C. IMAGE INSPECTOR -->
        <div v-if="selectedElementType === 'image' && selectedImagePlane" class="space-y-4 animate-fade-in">
          <TransformInspector
            :title="activeImagePlane.name"
            type="image"
            :position="activeImagePlane.position"
            :rotation="activeImagePlane.rotation"
            :scale="activeImagePlane.scale"
            @change="(updated) => emit('updateImage', activeImagePlane.id, updated)"
          />

          <ImageControls
            :image="selectedImagePlane"
            @changeImage="(data) => emit('updateImage', activeImagePlane.id, data)"
            @deleteImage="emit('deleteElement', activeImagePlane.id, 'image')"
          />
        </div>

        <!-- D. CAMERA/LIGHT VIEWPORT INSPECTOR -->
        <div v-if="selectedElementType === 'camera' && selectedCameraVal" class="space-y-4 animate-fade-in">
          <div class="bg-[#14171d]/90 p-4 rounded-xl border border-white/5 space-y-3 shadow-xl">
            <label class="text-[10px] text-gray-500 block tracking-wider uppercase font-sans font-bold">镜头注视追踪目标</label>
            <select
              :value="activeCamera.lookAtTargetId || ''"
              @change="($event) => {
                const targetId = ($event.target as HTMLSelectElement).value;
                emit('commitHistory');
                emit('updateCamera', activeCamera.id, { lookAtTargetId: targetId || undefined });
              }"
              class="w-full text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
            >
              <option value="">自由视点（手动调整目标点）</option>
              <option
                v-for="m in project.mannequins"
                :key="m.id"
                :value="m.id"
              >
                追踪角色：{{ m.name }}
              </option>
            </select>
            <p v-if="activeCamera.lookAtTargetId" class="text-[9px] text-[#4cd137] leading-relaxed bg-[#4cd137]/5 p-2 rounded border border-[#4cd137]/10">
              ✓ 镜头已锁死至该被摄角色。相机成像焦平面将保持追踪对准，随该角色在 3D 舞台的移动而自动旋转跟焦。
            </p>
          </div>

          <TransformInspector
            :title="activeCamera.name"
            type="camera"
            :position="activeCamera.position"
            :target="activeCamera.target"
            @change="(updated) => emit('updateCamera', activeCamera.id, updated)"
          />

          <CameraProSettings
            :camera="selectedCameraVal"
            @updateCamera="(id, patch) => emit('updateCamera', id, patch)"
            @commitHistory="emit('commitHistory')"
          />
        </div>

        <!-- E. LIGHT TRANSFORMS -->
        <div v-if="selectedElementType === 'light' && selectedLightVal" class="space-y-4 animate-fade-in">
          <TransformInspector
            :title="activeLight.name"
            type="light"
            :position="activeLight.position"
            @change="(updated) => emit('updateLight', activeLight.id, updated)"
          />

          <!-- Dedicated controls for the selected light -->
          <div class="space-y-4 bg-[#14171d]/90 p-4 rounded-xl border border-white/5 shadow-xl text-gray-200">
            <h5 class="text-xs font-bold tracking-wider text-[#3b82f6] uppercase flex items-center gap-1.5">
              <Icon icon="lucide:sliders" :width="14" class="text-[#3b82f6]" />
              <span>灯光参数精调</span>
            </h5>

            <div class="bg-black/20 p-3 rounded border border-white/5 space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-xs text-gray-300">灯光颜色</span>
                <input
                  type="color"
                  :value="activeLight.color || '#ffffff'"
                  @input="($event) => { emit('commitHistory'); emit('updateLight', activeLight.id, { color: ($event.target as HTMLInputElement).value }); }"
                  class="w-8 h-6 border-0 bg-transparent cursor-pointer rounded"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between items-center text-[11px] text-gray-300">
                  <span>光照强度</span>
                  <input
                    type="number"
                    step="any"
                    :value="Number((activeLight.intensity || 1.0).toFixed(2))"
                    @change="($event) => { const v = parseFloat(($event.target as HTMLInputElement).value); if (!isNaN(v) && v >= 0) { emit('commitHistory'); emit('updateLight', activeLight.id, { intensity: v }); } }"
                    class="w-10 text-[10px] font-mono text-[#3b82f6] font-bold text-right bg-transparent border-b border-white/10 focus:border-blue-500 outline-none shrink-0"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.05"
                  :value="activeLight.intensity || 1.0"
                  @input="($event) => { emit('commitHistory'); emit('updateLight', activeLight.id, { intensity: parseFloat(($event.target as HTMLInputElement).value) }); }"
                  class="w-full accent-[#3b82f6] h-1 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- F. GROUND -->
        <div v-if="selectedElementType === 'ground'" class="animate-fade-in">
          <GroundControls
            :project="project"
            @updateProject="(proj) => emit('updateProject', proj)"
          />
        </div>

        <!-- G. GROUP FORMATION DETAILS -->
        <GroupControlsPanel
          v-if="selectedElementType === 'group' && selectedGroupObject"
          :project="project"
          :selectedGroupObject="selectedGroupObject"
          :groupMannequins="groupMannequins"
          :customPresets="customPresets"
          @updateProject="(proj) => emit('updateProject', proj)"
          @commitHistory="emit('commitHistory')"
          @removeMannequinFromGroup="(id) => emit('removeMannequinFromGroup', id)"
          @selectElement="(id, type) => emit('selectElement', id, type as any)"
        />
      </div>
    </div>
  </aside>
</template>
