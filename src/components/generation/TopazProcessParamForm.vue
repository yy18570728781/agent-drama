<template>
  <!-- 预设 -->
  <el-popover trigger="click" :width="240" role="dialog" popper-class="dark-popover topaz-process-popover" placement="top-start" :popper-options="{ modifiers: [{ name: 'flip', enabled: false }] }">
    <template #reference>
      <button class="toolbar-select-btn">
        <span class="btn-value">{{ selectedPresetName }}</span>
        <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
      </button>
    </template>
    <div class="preset-list">
      <div class="preset-header">选择预设</div>
      <button class="preset-item" @click="loadPreset('')">
        <span class="preset-item-name">-- 不使用预设 --</span>
      </button>
      <button
        v-for="p in presetList"
        :key="p.id"
        class="preset-item"
        @click="loadPreset(p.id)"
      >
        <span class="preset-item-name">{{ p.name }}</span>
        <span class="preset-item-id">{{ p.id }}</span>
      </button>
      <div class="preset-divider"></div>
      <button class="preset-item preset-load-btn" @click="triggerFileInput">
        <span class="preset-item-name">📂 从文件加载…</span>
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        style="display:none"
        @change="handleFileLoad"
      />
    </div>
  </el-popover>

  <!-- 超分 -->
  <el-popover trigger="click" :width="380" role="dialog" popper-class="dark-popover topaz-process-popover" placement="top-start" :popper-options="{ modifiers: [{ name: 'flip', enabled: false }] }">
    <template #reference>
      <button class="toolbar-select-btn" :class="procParams.enable_enhance ? 'toggle-on' : 'toggle-off'">
        <span class="btn-value">超分</span>
        <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
      </button>
    </template>
    <div class="proc-pop-body">
      <div class="proc-toggle-row" @click="procParams.enable_enhance = !procParams.enable_enhance">
        <div class="proc-toggle-switch" :class="{ on: procParams.enable_enhance }"></div>
        <span class="proc-toggle-label">启用放大</span>
      </div>
      <ProcessEnhancePanel
        :params="procParams"
        :enabled="procParams.enable_enhance"
        :upscale-models="upscaleModels"
        :estimating="estimating"
        :estimate-info="estimateInfo"
        @estimate="handleEstimate"
      />
    </div>
  </el-popover>

  <!-- 插帧 -->
  <el-popover trigger="click" :width="380" role="dialog" popper-class="dark-popover topaz-process-popover" placement="top-start" :popper-options="{ modifiers: [{ name: 'flip', enabled: false }] }">
    <template #reference>
      <button class="toolbar-select-btn" :class="procParams.enable_interpolate ? 'toggle-on' : 'toggle-off'">
        <span class="btn-value">插帧</span>
        <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
      </button>
    </template>
    <div class="proc-pop-body">
      <div class="proc-toggle-row" @click="procParams.enable_interpolate = !procParams.enable_interpolate">
        <div class="proc-toggle-switch" :class="{ on: procParams.enable_interpolate }"></div>
        <span class="proc-toggle-label">启用插帧</span>
      </div>
      <ProcessInterpolatePanel
        :params="procParams"
        :enabled="procParams.enable_interpolate"
        :interp-models="interpModels"
        :fps-presets="fpsPresets"
      />
    </div>
  </el-popover>

  <!-- 输出 -->
  <el-popover trigger="click" :width="380" role="dialog" popper-class="dark-popover topaz-process-popover" placement="top-start" :popper-options="{ modifiers: [{ name: 'flip', enabled: false }] }">
    <template #reference>
      <button class="toolbar-select-btn">
        <span class="btn-value">输出</span>
        <ChevronDown :size="14" :stroke-width="2" class="btn-arrow" />
      </button>
    </template>
    <div class="proc-pop-body">
      <ProcessOutputPanel :params="procParams" :encoders="encoders" />
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronDown } from '@/components/common/icon/lucide'
import { ElMessage } from 'element-plus'
import ProcessEnhancePanel from './ProcessEnhancePanel.vue'
import ProcessInterpolatePanel from './ProcessInterpolatePanel.vue'
import ProcessOutputPanel from './ProcessOutputPanel.vue'
import { useTopazProcess } from '@/composables/generation/useTopazProcess'
import { useTopazProcessModels } from '@/composables/generation/useTopazProcessModels'
import { PROC_DEFAULT_PARAMS, withWorkerRetry } from '@/services/generation/topazProcess.constants'
import * as topazService from '@/services/generation/topazProcess.service'
import type { PresetInfo, PresetDetail } from '@/services/generation/topazProcess.types'

const props = defineProps<{
  initialValues?: Record<string, unknown>
  refImages?: { url?: string }[]
}>()

const emit = defineEmits<{
  change: [data: Record<string, unknown>]
}>()

const {
  params: procParams,
  estimating,
  estimateInfo,
  applyPreset,
  runEstimate,
  submit,
} = useTopazProcess()

const {
  upscaleModels,
  interpModels,
  encoders,
  fpsPresets,
} = useTopazProcessModels()

const presetList = ref<PresetInfo[]>([])
const selectedPresetName = ref('预设')

async function loadPresetList() {
  try {
    const data = await topazService.fetchPresets()
    presetList.value = data.presets || []
  } catch {
    presetList.value = []
  }
}

async function loadPreset(id: string) {
  if (!id) {
    Object.assign(procParams, { ...PROC_DEFAULT_PARAMS })
    selectedPresetName.value = '预设'
    return
  }
  try {
    const detail = await topazService.fetchPresetDetail(id)
    applyPreset(detail)
    selectedPresetName.value = detail.name || id
    ElMessage.success(`已加载预设: ${detail.name || id}`)
  } catch (e) {
    ElMessage.error('加载预设失败: ' + (e as Error).message)
  }
}

async function handleEstimate() {
  const item = props.refImages?.[0]
  if (!item?.url) {
    ElMessage.warning('请先添加参考视频')
    return
  }
  try {
    await withWorkerRetry((workerBase) => runEstimate(item.url!, '', workerBase))
    ElMessage.success('参数分析完成，已自动填充')
  } catch (e) {
    ElMessage.error('分析失败: ' + (e as Error).message)
  }
}

const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileLoad(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result as string) as PresetDetail
      if (!raw.name) raw.name = file.name.replace(/\.json$/i, '')
      applyPreset(raw)
      selectedPresetName.value = raw.name
      ElMessage.success(`已加载预设文件: ${raw.name}`)
    } catch (err) {
      ElMessage.error('JSON 解析失败: ' + (err as Error).message)
    }
  }
  reader.onerror = () => ElMessage.error('文件读取失败')
  reader.readAsText(file)
  input.value = ''
}

watch(
  procParams,
  (val) => {
    emit('change', { ...val })
  },
  { deep: true },
)

watch(
  () => props.initialValues,
  (values) => {
    if (!values) return
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null && k in procParams) {
        ;(procParams as Record<string, unknown>)[k] = v
      }
    }
  },
  { immediate: false },
)

loadPresetList()

defineExpose({
  submit: (videoUrl: string, videoPath: string) =>
    submit(videoUrl, videoPath),
  params: procParams,
})
</script>

<style scoped src="./TopazProcessParamForm.css"></style>

<style>
.topaz-process-popover.el-popover {
  max-width: calc(100vw - 16px);
}
</style>
