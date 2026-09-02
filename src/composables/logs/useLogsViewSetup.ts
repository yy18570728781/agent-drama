import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { AlertCircle, Bug, Info, TriangleAlert } from '@/components/common/icon/lucide'
import { useLogsStore } from '@/stores/logs.store'
import type { LogLevel } from '@/utils/logger'

export function useLogsViewSetup() {
const store = useLogsStore()
const containerRef = ref<HTMLElement>()

// 页面状态
const searchKeyword = ref('')
const filterSource = ref('all')
const autoScroll = ref(true)
const showFullTime = ref(false)
const sseConnected = ref(false)
const copiedId = ref<string | null>(null)

// 时间过滤
const timeRange = ref('all')
const showCustomTimePicker = ref(true)
const customTimeStart = ref('')
const customTimeEnd = ref('')
const filterStartTime = ref<Date | null>(null)
const filterEndTime = ref<Date | null>(null)

// 统计面板
const showStatsPanel = ref(false)

const LEVEL_META: Record<LogLevel, { label: string; icon: any }> = {
  debug: { label: '调试', icon: Bug },
  info: { label: '信息', icon: Info },
  warn: { label: '警告', icon: TriangleAlert },
  error: { label: '错误', icon: AlertCircle },
}

// 搜索和来源过滤后的日志
const filteredAndSearchedEntries = computed(() => {
  let result = store.filteredEntries

  // 来源过滤
  if (filterSource.value !== 'all') {
    result = result.filter(e => e.source === filterSource.value)
  }

  // 时间过滤
  if (filterStartTime.value) {
    result = result.filter(e => new Date(e.timestamp) >= filterStartTime.value!)
  }
  if (filterEndTime.value) {
    result = result.filter(e => new Date(e.timestamp) <= filterEndTime.value!)
  }

  // 关键词搜索
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase()
    result = result.filter(e =>
      e.message.toLowerCase().includes(kw) ||
      e.module.toLowerCase().includes(kw) ||
      (e.detail && JSON.stringify(e.detail).toLowerCase().includes(kw))
    )
  }

  return result
})

// 统计计算
const totalLogs = computed(() => store.allEntries.length)
const errorPercent = computed(() => totalLogs.value ? (store.stats.error / totalLogs.value * 100) : 0)
const warnPercent = computed(() => totalLogs.value ? (store.stats.warn / totalLogs.value * 100) : 0)
const infoPercent = computed(() => totalLogs.value ? (store.stats.info / totalLogs.value * 100) : 0)
const debugPercent = computed(() => totalLogs.value ? (store.stats.debug / totalLogs.value * 100) : 0)

// 模块分布 Top 10
const topModules = computed(() => {
  const counts: Record<string, number> = {}
  store.allEntries.forEach(e => {
    counts[e.module] = (counts[e.module] || 0) + 1
  })
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const max = sorted[0]?.[1] || 1
  return sorted.map(([name, count]) => ({
    name,
    count,
    percent: (count / max * 100)
  }))
})

// 按小时统计（最近24小时）
const hourlyStats = computed(() => {
  const now = Date.now()
  const hours: { label: string; count: number; percent: number }[] = []

  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now - i * 3600000)
    hourStart.setMinutes(0, 0, 0)
    const hourEnd = new Date(hourStart.getTime() + 3600000)

    const count = store.allEntries.filter(e => {
      const t = new Date(e.timestamp).getTime()
      return t >= hourStart.getTime() && t < hourEnd.getTime()
    }).length

    hours.push({
      label: `${hourStart.getHours()}:00`,
      count,
      percent: 0 // 后面计算
    })
  }

  const max = Math.max(...hours.map(h => h.count), 1)
  hours.forEach(h => h.percent = (h.count / max * 100))

  return hours
})

// 时间过滤处理
const applyTimeFilter = () => {
  if (timeRange.value === 'all') {
    filterStartTime.value = null
    filterEndTime.value = null
  } else if (timeRange.value === 'custom') {
    showCustomTimePicker.value = true
  } else {
    const now = new Date()
    filterEndTime.value = now
    switch (timeRange.value) {
      case '1h':
        filterStartTime.value = new Date(now.getTime() - 3600000)
        break
      case '6h':
        filterStartTime.value = new Date(now.getTime() - 6 * 3600000)
        break
      case '24h':
        filterStartTime.value = new Date(now.getTime() - 24 * 3600000)
        break
      case '7d':
        filterStartTime.value = new Date(now.getTime() - 7 * 24 * 3600000)
        break
    }
  }
}

const applyCustomTime = () => {
  if (customTimeStart.value) {
    filterStartTime.value = new Date(customTimeStart.value)
  }
  if (customTimeEnd.value) {
    filterEndTime.value = new Date(customTimeEnd.value)
  }
  showCustomTimePicker.value = false
}

// 快捷过滤
const quickFilter = (level: LogLevel) => {
  store.filterLevel = store.filterLevel === level ? 'all' : level
  store.refresh()
}

// 时间格式化
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

const formatFullTime = (iso: string) => {
  const d = new Date(iso)
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${Y}-${M}-${D} ${h}:${m}:${s}.${ms}`
}

// 搜索高亮
const highlightSearch = (text: string) => {
  if (!searchKeyword.value.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const kw = escapeHtml(searchKeyword.value)
  const regex = new RegExp(`(${escapeRegExp(kw)})`, 'gi')
  return escaped.replace(regex, '<mark class="highlight">$1</mark>')
}

const escapeHtml = (str: string) => {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 详情格式化（带语法高亮）
const formatDetail = (detail: any) => {
  let content: string
  if (typeof detail === 'string') {
    content = detail
  } else if (detail instanceof Error) {
    content = `${detail.name}: ${detail.message}\n${detail.stack || ''}`
  } else {
    content = JSON.stringify(detail, null, 2)
  }

  // 简单的语法高亮
  content = escapeHtml(content)
  // 高亮字符串
  content = content.replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
  content = content.replace(/: "([^"]*)"/g, ': <span class="json-str">"$1"</span>')
  // 高亮数字
  content = content.replace(/: (\d+\.?\d*)/g, ': <span class="json-num">$1</span>')
  // 高亮布尔和null
  content = content.replace(/: (true|false|null)/g, ': <span class="json-bool">$1</span>')
  // 高亮错误堆栈中的文件路径
  content = content.replace(/(at\s+.*?\(.*?:\d+:\d+\))/g, '<span class="stack-frame">$1</span>')

  // 搜索高亮
  if (searchKeyword.value.trim()) {
    const kw = escapeHtml(searchKeyword.value)
    const regex = new RegExp(`(${escapeRegExp(kw)})`, 'gi')
    content = content.replace(regex, '<mark class="highlight">$1</mark>')
  }

  return content
}

// 展开/收起
const toggle = (entry: any) => {
  if (entry.detail) entry._expanded = !entry._expanded
}

// 复制日志
const copyEntry = async (entry: any) => {
  const text = `[${formatFullTime(entry.timestamp)}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}` +
    (entry.detail ? `\n${typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail, null, 2)}` : '')

  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = entry.id
    setTimeout(() => { copiedId.value = null }, 1500)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

// 滚动处理
const onScroll = () => {
  if (!containerRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = containerRef.value
  // 如果用户手动向上滚动，禁用自动滚动
  if (scrollTop + clientHeight < scrollHeight - 50) {
    autoScroll.value = false
  }
}

// 自动滚动到底部
watch([() => filteredAndSearchedEntries.value.length, autoScroll], async () => {
  if (autoScroll.value && containerRef.value) {
    await nextTick()
    containerRef.value.scrollTop = 0 // 日志是倒序的，所以滚动到顶部
  }
})

// SSE 连接状态
watch(() => store.showServerLogs, (val) => {
  sseConnected.value = val
}, { immediate: true })

const handleClear = async () => {
  if (confirm('确定清空所有日志？此操作不可恢复。')) {
    await store.clear()
  }
}

onMounted(async () => {
  await store.fetchServerLogs()
  store.subscribeToLogs()
  sseConnected.value = true
})

onUnmounted(() => {
  store.unsubscribeFromLogs()
})
  return { store, containerRef, searchKeyword, filterSource, autoScroll, showFullTime, sseConnected, copiedId, timeRange, showCustomTimePicker, customTimeStart, customTimeEnd, filterStartTime, filterEndTime, showStatsPanel, LEVEL_META, filteredAndSearchedEntries, totalLogs, errorPercent, warnPercent, infoPercent, debugPercent, topModules, hourlyStats, applyTimeFilter, applyCustomTime, quickFilter, fmtTime, formatFullTime, highlightSearch, formatDetail, toggle, copyEntry, onScroll, handleClear }
}
