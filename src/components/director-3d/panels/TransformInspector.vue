<script setup lang="ts">
import { ref, useTemplateRef, nextTick, onMounted, onUnmounted } from 'vue';
import { Vector3D } from '@/components/director-3d/director3D.types';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  title: string;
  type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group';
  position: Vector3D;
  rotation?: Vector3D;
  scale?: Vector3D;
  target?: Vector3D; // For cameras
}>();

const emit = defineEmits<{
  (e: 'change', updated: {
    position?: Vector3D;
    rotation?: Vector3D;
    scale?: Vector3D;
    target?: Vector3D;
  }): void;
}>();

const DEFAULTS = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  target: { x: 0, y: 1.5, z: 0 },
};

const toastMsg = ref<string | null>(null);

function showLocalToast(msg: string) {
  toastMsg.value = msg;
  setTimeout(() => {
    toastMsg.value = null;
  }, 1500);
}

const currentMode = ref<'translate' | 'rotate' | 'scale'>('translate');

function setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
  currentMode.value = mode;
  window.dispatchEvent(new CustomEvent('changeTransformMode', { detail: mode }));
}

const syncModeKeys = (e: KeyboardEvent) => {
  if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
  const key = e.key.toLowerCase();
  if (key === 'w') currentMode.value = 'translate';
  else if (key === 'e') currentMode.value = 'rotate';
  else if (key === 'r') currentMode.value = 'scale';
};

onMounted(() => window.addEventListener('keydown', syncModeKeys));
onUnmounted(() => window.removeEventListener('keydown', syncModeKeys));

function handleCopyAll() {
  const dataToCopy = {
    position: props.position,
    rotation: props.rotation || { x: 0, y: 0, z: 0 },
    scale: props.scale || { x: 1, y: 1, z: 1 },
    target: props.target || { x: 0, y: 1.5, z: 0 },
    objectType: props.type,
  };
  localStorage.setItem('director_studio_transform_clipboard', JSON.stringify(dataToCopy));
  showLocalToast('📋 变换属性已全部复制');
}

function handlePasteAll() {
  try {
    const raw = localStorage.getItem('director_studio_transform_clipboard');
    if (!raw) {
      showLocalToast('⚠️ 剪贴板中无变换数据');
      return;
    }
    const parsed = JSON.parse(raw);
    
    const updatedData: {
      position?: Vector3D;
      rotation?: Vector3D;
      scale?: Vector3D;
      target?: Vector3D;
    } = {};

    if (parsed.position) updatedData.position = parsed.position;
    
    if (props.rotation !== undefined && parsed.rotation) {
      updatedData.rotation = parsed.rotation;
    }

    if (props.scale !== undefined && parsed.scale) {
      updatedData.scale = parsed.scale;
    }

    if (props.target !== undefined && parsed.target) {
      updatedData.target = parsed.target;
    }

    emit('change', updatedData);
    showLocalToast('📥 变换属性已成功粘贴');
  } catch (e) {
    showLocalToast('❌ 粘贴解析失败');
  }
}

function handleResetVector(field: 'position' | 'rotation' | 'scale' | 'target') {
  const defaultVal = DEFAULTS[field];
  emit('change', { [field]: { ...defaultVal } });
  showLocalToast(`🔄 已重置"${
    field === 'position' ? '位移' : 
    field === 'rotation' ? '旋转' : 
    field === 'scale' ? '缩放' : '视点目标'
  }"`);
}
</script>

<template>
  <div class="bg-[#14171d]/90 p-3 rounded-xl border border-white/5 space-y-3 font-mono shadow-xl relative overflow-hidden animate-fade-in" id="transform-inspector-card">
    <!-- HUD Header -->
    <div class="flex items-center justify-between border-b border-white/5 pb-2.5">
      <div class="flex items-center gap-1.5">
        <div class="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
        <div class="text-left">
          <span class="text-[11px] text-gray-400 block tracking-wider uppercase font-sans">通用坐标属性调节</span>
          <span class="text-[12px] font-bold text-white font-sans truncate max-w-[150px] block mt-0.5">
            {{ title || '未选中' }}
          </span>
        </div>
      </div>
      
      <!-- Copy/Paste panel -->
      <div class="flex gap-1">
        <div
          role="button"
          tabindex="0"
          @click="handleCopyAll"
          @keydown.enter.prevent="handleCopyAll"
          @keydown.space.prevent="handleCopyAll"
          title="一键复制位移、旋转、缩放属性"
          class="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/5"
          id="inspector-copy-btn"
        >
          <Icon icon="lucide:copy" :width="12" />
        </div>
        <div
          role="button"
          tabindex="0"
          @click="handlePasteAll"
          @keydown.enter.prevent="handlePasteAll"
          @keydown.space.prevent="handlePasteAll"
          title="粘贴剪贴板中的变换属性"
          class="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/5"
          id="inspector-paste-btn"
        >
          <Icon icon="lucide:clipboard" :width="12" />
        </div>
      </div>
    </div>

    <!-- Floating internal notification inside panel -->
    <div v-if="toastMsg" class="absolute top-2 left-1/2 -translate-x-1/2 bg-[#2d3748] border border-white/10 text-[9px] text-[#74b9ff] px-2.5 py-1 rounded shadow-lg z-20 pointer-events-none animate-fade-in">
      {{ toastMsg }}
    </div>

    <!-- Transform Mode Switcher (W/E/R) -->
    <div v-if="type !== 'ground' && type !== 'group'" class="flex gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
      <div
        role="button"
        tabindex="0"
        @click="setTransformMode('translate')"
        @keydown.enter.prevent="setTransformMode('translate')"
        @keydown.space.prevent="setTransformMode('translate')"
        :class="[
          'flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border',
          currentMode === 'translate'
            ? 'bg-blue-600/25 text-blue-400 border-blue-500/30'
            : 'bg-transparent text-gray-500 border-transparent hover:text-white hover:bg-white/5'
        ]"
      >
        <Icon icon="lucide:move" :width="10" />
        位移 (W)
      </div>
      <div
        role="button"
        tabindex="0"
        @click="setTransformMode('rotate')"
        @keydown.enter.prevent="setTransformMode('rotate')"
        @keydown.space.prevent="setTransformMode('rotate')"
        :class="[
          'flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border',
          currentMode === 'rotate'
            ? 'bg-emerald-600/25 text-emerald-400 border-emerald-500/30'
            : 'bg-transparent text-gray-500 border-transparent hover:text-white hover:bg-white/5'
        ]"
      >
        <Icon icon="lucide:rotate-cw" :width="10" />
        旋转 (E)
      </div>
      <div
        role="button"
        tabindex="0"
        @click="setTransformMode('scale')"
        @keydown.enter.prevent="setTransformMode('scale')"
        @keydown.space.prevent="setTransformMode('scale')"
        :class="[
          'flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border',
          currentMode === 'scale'
            ? 'bg-pink-600/25 text-pink-400 border-pink-500/30'
            : 'bg-transparent text-gray-500 border-transparent hover:text-white hover:bg-white/5'
        ]"
      >
        <Icon icon="lucide:maximize-2" :width="10" />
        缩放 (R)
      </div>
    </div>

    <!-- 1. POSITION VECTOR -->
    <VectorTweakRow
      label="三维空间位移 (m)"
      iconColor="text-red-400"
      :value="position"
      :min="-50"
      :max="50"
      :step="0.05"
      @reset="handleResetVector('position')"
      @change="(updatedPos) => emit('change', { position: updatedPos })"
    />

    <!-- 2. ROTATION VECTOR (or TARGET for Camera) -->
    <VectorTweakRow
      v-if="rotation !== undefined"
      label="三维旋转角度 (°)"
      iconColor="text-[#20bf6b]"
      :value="rotation"
      :min="-360"
      :max="360"
      :step="0.5"
      :isRotation="true"
      @reset="handleResetVector('rotation')"
      @change="(updatedRot) => emit('change', { rotation: updatedRot })"
    />

    <!-- TARGET VECTOR for Camera specifically -->
    <VectorTweakRow
      v-if="target !== undefined"
      label="镜头视向焦点 (m)"
      iconColor="text-[#20bf6b]"
      :value="target"
      :min="-50"
      :max="50"
      :step="0.05"
      @reset="handleResetVector('target')"
      @change="(updatedTarget) => emit('change', { target: updatedTarget })"
    />

    <!-- 3. SCALE VECTOR -->
    <VectorTweakRow
      v-if="scale !== undefined && type !== 'camera' && type !== 'light'"
      label="形体拉伸比例 (倍)"
      iconColor="text-[#3867d6]"
      :value="scale"
      :min="0.01"
      :max="10"
      :step="0.02"
      @reset="handleResetVector('scale')"
      @change="(updatedScale) => emit('change', { scale: updatedScale })"
    />

    <!-- Help Tips -->
    <div class="text-[8.5px] text-gray-500 bg-black/20 p-1.5 rounded border border-white/5 flex gap-1.5 items-start mt-1">
      <Icon icon="lucide:help-circle" :width="10" class="text-[#3b82f6] shrink-0 mt-0.5" />
      <span class="leading-tight">
        左键拖动输入框像滑块一样快速微调数值。
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType, computed as vueComputed, h } from 'vue';

const TweakableField = defineComponent({
  name: 'TweakableField',
  props: {
    axis: { type: String as PropType<'x' | 'y' | 'z'>, required: true },
    value: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, required: true },
    suffix: { type: String, default: '' },
  },
  emits: ['change'],
  setup(props, { emit }) {
    const isEditingText = ref(false);
    const typedVal = ref('');
    const inputRef = useTemplateRef<HTMLInputElement>('inputRef');
    const dragStartX = ref<number | null>(null);
    const dragOriginalVal = ref<number>(0);

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      e.preventDefault();

      dragStartX.value = e.clientX;
      dragOriginalVal.value = props.value;

      function handleMouseMove(moveEvt: MouseEvent) {
        if (dragStartX.value === null) return;
        const deltaX = moveEvt.clientX - dragStartX.value;
        const sensitivity = props.step * 0.4;
        let calculated = dragOriginalVal.value + deltaX * sensitivity;
        calculated = Math.max(props.min, Math.min(props.max, calculated));
        calculated = parseFloat(calculated.toFixed(3));
        emit('change', calculated);
      }

      function handleMouseUp() {
        dragStartX.value = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      }

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    function handleDoubleClick() {
      isEditingText.value = true;
      typedVal.value = props.value.toString();
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus();
          inputRef.value.select();
        }
      });
    }

    function handleBlur() {
      const num = parseFloat(typedVal.value);
      if (!isNaN(num)) {
        emit('change', parseFloat(num.toFixed(3)));
      }
      isEditingText.value = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        isEditingText.value = false;
      }
    }

    const axisColor = vueComputed(() => {
      return props.axis === 'x' ? 'text-red-400' :
             props.axis === 'y' ? 'text-emerald-400' : 'text-[#3867d6]';
    });

    return {
      isEditingText,
      typedVal,
      inputRef,
      handleMouseDown,
      handleDoubleClick,
      handleBlur,
      handleKeyDown,
      axisColor,
    };
  },
  render() {
    const { isEditingText, typedVal, axis, value, suffix, axisColor, handleMouseDown, handleDoubleClick, handleBlur, handleKeyDown } = this;
    const axisLabel = h('div', {
      class: ['w-4 h-full flex items-center justify-center font-bold text-[9px] bg-white/[0.03] select-none cursor-ew-resize border-r border-white/5', axisColor],
      onMousedown: handleMouseDown,
      onDblclick: handleDoubleClick,
      title: '按住鼠标左右拖地可微调数值\n双击打字修改',
    }, axis.toUpperCase());

    const editingInput = h('input', {
      ref: 'inputRef',
      type: 'text',
      value: typedVal,
      onBlur: handleBlur,
      onKeydown: handleKeyDown,
      onInput: (e: Event) => { this.typedVal = (e.target as HTMLInputElement).value; },
      class: 'w-full h-full bg-slate-950 font-mono text-[10px] text-white px-1 outline-none text-right font-bold',
    });

    const displayDiv = h('div', {
      class: 'flex-grow h-full items-center justify-end flex px-1 cursor-ew-resize font-bold select-none text-[10px] text-gray-200',
      onMousedown: handleMouseDown,
      onDblclick: handleDoubleClick,
      title: '按住左右拖动微调\n双击输入数值',
    }, [
      h('span', { class: 'truncate max-w-[45px] font-mono' }, value.toFixed(2)),
      h('span', { class: 'text-[8px] text-gray-500 ml-0.5 scale-90' }, suffix),
    ]);

    return h('div', {
      class: 'flex items-center bg-black/50 border border-white/5 hover:border-white/15 rounded md:h-7 h-6 transition-all overflow-hidden',
      id: 'tweakable-' + axis,
    }, [axisLabel, isEditingText ? editingInput : displayDiv]);
  }
});

const VectorTweakRow = defineComponent({
  name: 'VectorTweakRow',
  components: { TweakableField },
  props: {
    label: { type: String, required: true },
    iconColor: { type: String, required: true },
    value: { type: Object as PropType<Vector3D>, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, required: true },
    isRotation: { type: Boolean, default: false },
  },
  emits: ['reset', 'change'],
  setup(props, { emit }) {
    const safeValue = vueComputed(() => props.value || { x: 0, y: 0, z: 0 });

    function handleFieldChange(axis: 'x' | 'y' | 'z', newVal: number) {
      emit('change', {
        ...safeValue.value,
        [axis]: newVal,
      });
    }

    return {
      safeValue,
      handleFieldChange,
    };
  },
  render() {
    const { label, iconColor, safeValue, min, max, step, isRotation } = this;
    const axes = ['x', 'y', 'z'] as const;

    const header = h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: ['text-[10px] font-bold tracking-wider flex items-center gap-1.5', iconColor] }, [
        h(Icon, { icon: 'lucide:sliders', width: 11, class: 'opacity-60' }),
        h('span', label),
      ]),
      h('div', {
        role: 'button',
        tabindex: 0,
        onClick: () => this.$emit('reset'),
        onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.$emit('reset'); } },
        title: '回退/重置为默认值',
        class: 'text-gray-500 hover:text-white transition-colors cursor-pointer',
      }, [
        h(Icon, { icon: 'lucide:rotate-ccw', width: 10 }),
      ]),
    ]);

    const fields = h('div', { class: 'grid grid-cols-3 gap-1.5' },
      axes.map(axis =>
        h(TweakableField, {
          key: axis,
          axis,
          value: safeValue[axis] ?? 0,
          min,
          max,
          step,
          suffix: isRotation ? '°' : 'm',
          onChange: (val: number) => this.handleFieldChange(axis, val),
        })
      )
    );

    return h('div', { class: 'space-y-1 text-left' }, [header, fields]);
  }
});
</script>
