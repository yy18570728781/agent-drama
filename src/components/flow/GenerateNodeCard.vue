<template>
  <BaseNodeCard
    :title="data.label || type"
    :icon="icon"
    :category="categoryClass"
    :status="status"
    :preview="preview"
    :preview-type="previewType"
    :input-ports="visibleInputPorts"
    :output-ports="visibleOutputPorts"
    :disable-input-ports="!!data.disableInputPorts"
    :disable-output-ports="!!data.disableOutputPorts"
  >
    <div v-if="baseParamDefs.length" class="node-params fixed-params" @pointerdown.stop @mousedown.stop @keydown.stop>
      <div v-for="p in baseParamDefs" :key="p.name" class="param-row-wrap">
        <Handle
          v-if="isGenerateNode"
          type="target"
          :id="p.name"
          :position="Position.Left"
          class="param-handle"
        />
        <div class="inline-param param-row">
          <label class="inline-label">{{ p.label || p.name }}</label>
          <select
            v-if="p.type === 'select'"
            :value="getParam(p.name)"
            @change="onInput(p.name, $event.target.value)"
            class="inline-select"
          >
            <option v-for="opt in normalizeOptions(p)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <select
            v-else-if="p.type === 'model_select'"
            :value="getParam(p.name)"
            @change="onInput(p.name, $event.target.value)"
            class="inline-select"
          >
            <option value="">选择模型</option>
            <option v-for="m in filteredModels" :key="m.id" :value="m.id">{{ m.display_name || m.name || m.id }}</option>
          </select>
          <textarea
            v-else-if="p.type === 'textarea'"
            :value="getParam(p.name)"
            @input="onInput(p.name, $event.target.value)"
            class="inline-textarea"
            rows="2"
          />
          <input v-else type="text" :value="getParam(p.name)" @input="onInput(p.name, $event.target.value)" class="inline-input" />
        </div>
      </div>
    </div>

    <div v-if="dynamicParamDefs.length" class="node-params dynamic-params" @pointerdown.stop @mousedown.stop @keydown.stop>
      <div class="dynamic-divider">
        <span>模型参数</span>
      </div>
      <div v-for="p in dynamicParamDefs" :key="'dyn-' + p.name" class="param-row-wrap">
        <Handle
          type="target"
          :id="p.name"
          :position="Position.Left"
          class="param-handle param-handle-dyn"
        />
        <div class="inline-param param-row">
          <label class="inline-label dyn-label">{{ p.label || p.name }}</label>
          <select
            v-if="p.type === 'select'"
            :value="getParam(p.name)"
            @change="onInput(p.name, $event.target.value)"
            class="inline-select dyn-control"
          >
            <option v-for="opt in normalizeOptions(p)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input
            v-else-if="p.type === 'integer' || p.type === 'float' || p.type === 'number'"
            type="number"
            :value="getParam(p.name)"
            :min="p.min" :max="p.max"
            :step="p.step || (p.type === 'float' ? 0.1 : 1)"
            @input="onInput(p.name, Number($event.target.value))"
            class="inline-input dyn-control"
          />
          <textarea
            v-else-if="p.type === 'textarea'"
            :value="getParam(p.name)"
            @input="onInput(p.name, $event.target.value)"
            class="inline-textarea dyn-control"
            rows="2"
          />
          <input
            v-else
            type="text"
            :value="getParam(p.name)"
            @input="onInput(p.name, $event.target.value)"
            class="inline-input dyn-control"
            :placeholder="p.label"
          />
        </div>
      </div>
    </div>

    <div v-if="loadingParams" class="loading-hint">加载参数中...</div>
  </BaseNodeCard>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import BaseNodeCard from './BaseNodeCard.vue'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
})

const models = inject('flowModels', ref([]))
const capabilityPorts = inject('flowCapabilityPorts', ref({}))
const onParamChange = inject('flowOnParamChange', null)

const NODE_ICONS = {
  text_input: '📝', image_input: '🖼️', generate: '✨',
  llm: '🤖', output_gallery: '🖼️', output_text: '📄',
}
const CATEGORY_MAP = {
  text_input: 'input', image_input: 'input', generate: 'process',
  llm: 'process', output_gallery: 'output', output_text: 'output',
}
const CAPABILITY_FILTER = {
  image_generation: ['image_generation'],
  video_generation: ['video_generation'],
  model_generation: ['model_generation'],
  audio_generation: ['audio_generation'],
}

const icon = computed(() => NODE_ICONS[props.type] || '⚙️')
const categoryClass = computed(() => CATEGORY_MAP[props.type] || 'process')
const isGenerateNode = computed(() => (
  ['generate', 'text_generation', 'image_generation', 'video_generation', 'model_generation', 'audio_generation']
    .includes(String(props.type || ''))
))
const status = computed(() => props.data.status)
const preview = computed(() => props.data.preview || props.data.thumb || props.data.url || '')
const ports = computed(() => props.data?.ports || { inputs: [], outputs: [] })
const visibleInputPorts = computed(() => (ports.value.inputs || []).filter((port) => port?.visible !== false))
const visibleOutputPorts = computed(() => {
  if (isGenerateNode.value) return []
  return (ports.value.outputs || []).filter((port) => port?.visible !== false)
})

const filteredModels = computed(() => {
  const all = models.value || []
  if (isGenerateNode.value) {
    const cap = props.data?.request?.capability || 'image_generation'
    const fc = CAPABILITY_FILTER[cap] || []
    if (fc.length) return all.filter((m) => fc.some((c) => (m.capabilities || []).includes(c)))
  }
  if (props.type === 'llm') return all.filter((m) => ['chat', 'coding', 'agent'].some((c) => (m.capabilities || []).includes(c)))
  return all
})

const baseParamDefs = computed(() => props.data.paramDefs || [])
const dynamicParamDefs = ref([])
const loadingParams = ref(false)
const requestParams = computed(() => props.data?.request?.params || {})

watch(
  () => [props.data?.request?.params?.model, props.data?.request?.capability],
  async ([model, capability]) => {
    if (!model || !isGenerateNode.value) { dynamicParamDefs.value = []; return }
    loadingParams.value = true
    try {
      const { default: client } = await import('@/api/client')
      const { data } = await client.get(`/api/models/${model}/params`, {
        params: { capability: capability || undefined },
      })
      const params = data?.data?.params || {}
      dynamicParamDefs.value = Object.entries(params).map(([name, def]) => ({
        name,
        type: mapParamType(def.type),
        label: def.label || name,
        default: def.default,
        options: def.options || null,
        min: def.min, max: def.max, step: def.step,
      }))
    } catch {
      dynamicParamDefs.value = []
    } finally {
      loadingParams.value = false
    }
  },
  { immediate: true }
)

const previewType = computed(() => {
  if (!preview.value) return null
  if (typeof preview.value === 'string') {
    if (preview.value.match(/\.(png|jpg|jpeg|gif|webp|svg)/i) || preview.value.startsWith('data:image')) return 'image'
    if (preview.value.match(/\.(mp4|webm|mov)/i)) return 'video'
  }
  return 'text'
})

function mapParamType(t) {
  if (!t) return 'string'
  t = t.toLowerCase()
  if (t === 'select' || t === 'enum') return 'select'
  if (t === 'integer' || t === 'int') return 'integer'
  if (t === 'float' || t === 'number' || t === 'double') return 'float'
  if (t === 'text' || t === 'textarea') return 'textarea'
  return 'string'
}

function normalizeOptions(p) {
  if (!p.options) return []
  return p.options.map((o) => typeof o === 'string' ? { value: o, label: o } : o)
}

function getParam(name) {
  return requestParams.value?.[name] ?? ''
}
function onInput(name, value) { if (onParamChange) onParamChange(props.id, name, value) }
</script>

<style scoped>
.node-params {
  padding: 6px 10px 8px;
  border-top: 1px solid var(--border, #333);
  display: flex; flex-direction: column; gap: 5px;
}
.param-row-wrap {
  position: relative;
}
.inline-param { display: flex; flex-direction: column; gap: 2px; }
.inline-param.param-row {
  flex-direction: row; align-items: center; gap: 6px;
}
.inline-label { font-size: 10px; color: var(--text-secondary, #888); font-weight: 500; white-space: nowrap; min-width: 28px; flex-shrink: 0; }
.param-row .inline-select, .param-row .inline-input { flex: 1; min-width: 0; }

.inline-input, .inline-textarea, .inline-select {
  padding: 4px 8px; border-radius: 4px;
  border: 1px solid var(--border, #444);
  background: var(--bg-base, #161625);
  color: var(--text-primary, #e0e0e0);
  font-size: 11px; font-family: inherit; outline: none;
  width: 100%; box-sizing: border-box;
}
.inline-input:focus, .inline-textarea:focus, .inline-select:focus { border-color: var(--accent-light, #6C5CE7); }
.inline-textarea { resize: vertical; min-height: 36px; line-height: 1.4; }
.inline-select { cursor: pointer; }

.param-handle {
  width: 8px !important; height: 8px !important;
  left: -5px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  position: absolute !important;
  border: 1.5px solid var(--accent-light, #6C5CE7) !important;
  background: var(--bg-surface, #1e1e2e) !important;
}
.param-handle:hover { background: var(--accent-light, #6C5CE7) !important; }
.param-handle-dyn {
  border-color: #00b894 !important;
}
.param-handle-dyn:hover { background: #00b894 !important; }

.dynamic-params {
  background: rgba(0, 184, 148, .04);
  border-top: 1px dashed rgba(0,184,148,.3);
}
.dynamic-divider {
  font-size: 9px;
  color: #00b894;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding-bottom: 2px;
  font-weight: 600;
  opacity: .7;
}
.dyn-label { color: #00b894 !important; }
.dyn-control {
  border-color: rgba(0,184,148,.3) !important;
  background: rgba(0,184,148,.05) !important;
}
.dyn-control:focus { border-color: #00b894 !important; }

.loading-hint { padding: 4px 10px; font-size: 10px; color: var(--accent-light, #6C5CE7); text-align: center; }
</style>
