<template>
  <div class="cap-bar" :class="theme">
    <template v-for="tab in tabs" :key="tab.id">
      <!-- 暂时隐藏模型生成入口；保留能力数据与选择逻辑，后续开放时移除此 v-if。 -->
      <button
        v-if="tab.id !== 'model_generation'"
        class="cap-tab"
        :class="{ active: modelValue === tab.id }"
        type="button"
        :title="tab.name"
        :aria-pressed="modelValue === tab.id"
        @click="select(tab.id)"
      >
        <span class="cap-label">{{ tab.name }}</span>
        <span v-if="getCount(tab.id) > 0" class="cap-count">{{ getCount(tab.id) }}</span>
      </button>
    </template>
    <div class="cap-bar-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getCapabilitiesByType } from '@/api/models'

export interface CapItem {
  id: string
  name: string
}

const props = withDefaults(defineProps<{
  modelValue?: string
  type?: string
  prepend?: CapItem[]
  theme?: 'dark' | 'light'
  showAll?: boolean
  /** 每个能力的模型数量 { capId: count } */
  counts?: Record<string, number>
  allowedIds?: string[]
}>(), {
  modelValue: '',
  type: 'generations',
  prepend: () => [],
  theme: 'light',
  showAll: false,
  counts: () => ({}),
  allowedIds: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [id: string]
  'change': [id: string]
  'loaded': [caps: CapItem[]]
}>()

const tabs = ref<CapItem[]>([])

function getCount(id: string): number {
  if (id === 'all' || id === 'agent') return 0
  return props.counts[id] || 0
}

// 保存原始能力列表
const rawCaps = ref<CapItem[]>([])

/** 从 API 响应中安全提取能力数组，兼容多种响应格式 */
function extractCapabilitiesArray(res: any): any[] {
  if (Array.isArray(res)) return res
  if (res?.capabilities && Array.isArray(res.capabilities)) return res.capabilities
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res?.data?.capabilities && Array.isArray(res.data.capabilities)) return res.data.capabilities
  // 最后兜底：尝试在对象中找任何数组字段
  for (const val of Object.values(res || {})) {
    if (Array.isArray(val) && val.length > 0 && (val as any[])[0]?.id) return val as any[]
  }
  return []
}

async function load() {
  try {
    const res = await getCapabilitiesByType(props.type)
    const capList = extractCapabilitiesArray(res)
    rawCaps.value = capList.map((c: any) => ({
      id: c.id,
      name: c.name || c.id,
    }))
    updateTabs()
  } catch (e) {
    console.warn('CapabilityBar: 加载能力列表失败', e)
    rawCaps.value = []
    tabs.value = [...props.prepend]
  }
}

// 根据 counts 更新显示的 tabs
function updateTabs() {
  const hasCounts = Object.keys(props.counts).length > 0
  const allowedIdSet = new Set(props.allowedIds)
  // 检查 counts 中是否有任何一个能匹配到 rawCaps 的 id
  const hasMatchingCount = hasCounts && rawCaps.value.some((c: CapItem) => (props.counts[c.id] || 0) > 0)
  // 有 counts 且能匹配时才过滤；ID 体系不同则全部显示
  let filteredCaps = hasMatchingCount
    ? rawCaps.value.filter((c: CapItem) => (props.counts[c.id] || 0) > 0)
    : rawCaps.value
  if (allowedIdSet.size) {
    filteredCaps = filteredCaps.filter((c: CapItem) => allowedIdSet.has(c.id))
  }

  const list: CapItem[] = []
  if (props.prepend.length) list.push(...props.prepend.filter((c: CapItem) => !allowedIdSet.size || allowedIdSet.has(c.id)))
  if (props.showAll && (!allowedIdSet.size || allowedIdSet.has('all'))) list.push({ id: 'all', name: '全部' })
  list.push(...filteredCaps)
  tabs.value = list
  emit('loaded', filteredCaps)
}

function select(id: string) {
  emit('update:modelValue', id)
  emit('change', id)
}

onMounted(load)
watch(() => props.type, load)
watch(() => props.allowedIds, updateTabs, { deep: true })
// 当 counts 变化时更新 tabs（解决异步加载时 counts 为空的问题）
watch(() => props.counts, updateTabs, { deep: true })
</script>

<style scoped>
/* ── 通用 ── */
.cap-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 4px;
  border-radius: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.cap-bar::-webkit-scrollbar { display: none; }

.cap-bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
}

.cap-bar-actions:empty {
  display: none;
}

.cap-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
}

.cap-label {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.cap-count {
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  flex-shrink: 0;
}

/* ── dark 主题 ── */
.cap-bar.dark {
  background: #18181b;
  border: 1px solid #27272a;
}
.dark .cap-tab {
  background: transparent;
  color: #52525b;
}
.dark .cap-count {
  background: #27272a;
  color: #71717a;
}
.dark .cap-tab:hover {
  color: #a1a1aa;
  background: #27272a;
}
.dark .cap-tab.active {
  color: #e4e4e7;
  background: #27272a;
  box-shadow: inset 0 0 0 1px #3f3f46;
}
.dark .cap-tab.active .cap-count {
  background: #3b82f6;
  color: #fff;
}
/* 移除选中时的蓝色下划线 */

/* ── light 主题 ── */
.cap-bar.light {
  background: transparent;
  gap: 4px;
  padding: 0;
}
.light .cap-tab {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.light .cap-count {
  background: var(--bg-hover);
  color: var(--text-muted);
}
.light .cap-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.light .cap-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.light .cap-tab.active .cap-count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

</style>
