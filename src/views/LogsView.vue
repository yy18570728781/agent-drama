<template>
  <div class="logs-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="stats-group">
          <span class="stat err" @click="quickFilter('error')" title="点击筛选错误">
            <AlertCircle class="stat-icon" :size="12" :stroke-width="2.25" />
            <span class="stat-label">错误</span>
            <span class="stat-count">{{ store.stats.error }}</span>
          </span>
          <span class="stat wrn" @click="quickFilter('warn')" title="点击筛选警告">
            <TriangleAlert class="stat-icon" :size="12" :stroke-width="2.25" />
            <span class="stat-label">警告</span>
            <span class="stat-count">{{ store.stats.warn }}</span>
          </span>
          <span class="stat inf" @click="quickFilter('info')" title="点击筛选信息">
            <Info class="stat-icon" :size="12" :stroke-width="2.25" />
            <span class="stat-label">信息</span>
            <span class="stat-count">{{ store.stats.info }}</span>
          </span>
          <span class="stat dbg" @click="quickFilter('debug')" title="点击筛选调试">
            <Bug class="stat-icon" :size="12" :stroke-width="2.25" />
            <span class="stat-label">调试</span>
            <span class="stat-count">{{ store.stats.debug }}</span>
          </span>
        </div>
        <div class="filter-group">
          <select v-model="store.filterLevel" @change="store.refresh" class="ctl">
            <option value="all">全部级别</option>
            <option value="error">错误</option>
            <option value="warn">警告</option>
            <option value="info">信息</option>
            <option value="debug">调试</option>
          </select>
          <select v-model="filterSource" class="ctl">
            <option value="all">全部来源</option>
            <option value="frontend">前端</option>
            <option value="backend">后端</option>
          </select>
          <select v-model="timeRange" class="ctl" @change="applyTimeFilter">
            <option value="all">全部时间</option>
            <option value="1h">最近1小时</option>
            <option value="6h">最近6小时</option>
            <option value="24h">最近24小时</option>
            <option value="7d">最近7天</option>
            <option value="custom">自定义...</option>
          </select>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索日志内容..."
            class="ctl search-input"
          />
          <input
            v-model="store.filterModule"
            type="text"
            placeholder="模块过滤..."
            class="ctl filter-input"
            @keyup.enter="store.refresh"
          />
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-icon" @click="showStatsPanel = !showStatsPanel" :class="{ active: showStatsPanel }" title="统计面板">
          📊
        </button>
        <label class="toggle" title="自动滚动到最新日志">
          <input type="checkbox" v-model="autoScroll" />
          <span>自动滚动</span>
        </label>
        <label class="toggle" title="显示完整日期时间">
          <input type="checkbox" v-model="showFullTime" />
          <span>完整时间</span>
        </label>
        <button @click="store.refresh" class="btn" :disabled="store.isLoading">
          <span v-if="store.isLoading" class="spin">↻</span>
          <span v-else>刷新</span>
        </button>
        <button @click="store.exportLogs" class="btn">导出</button>
        <button @click="handleClear" class="btn btn-danger">清空</button>
      </div>
    </div>

    <!-- 时间范围自定义弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="timeRange === 'custom' && showCustomTimePicker" class="time-picker-overlay" @click.self="showCustomTimePicker = false">
          <div class="time-picker-dialog">
            <h4>选择时间范围</h4>
            <div class="time-picker-fields">
              <div class="time-field">
                <label>开始时间</label>
                <input type="datetime-local" v-model="customTimeStart" />
              </div>
              <div class="time-field">
                <label>结束时间</label>
                <input type="datetime-local" v-model="customTimeEnd" />
              </div>
            </div>
            <div class="time-picker-actions">
              <button class="btn" @click="showCustomTimePicker = false">取消</button>
              <button class="btn btn-primary" @click="applyCustomTime">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 错误提示 -->
    <div v-if="store.error" class="error-banner">
      <AlertCircle class="error-icon" :size="16" :stroke-width="2.25" />
      <span class="error-text">{{ store.error }}</span>
      <button @click="store.error = null" class="btn-x">✕</button>
    </div>

    <!-- 统计面板 -->
    <Transition name="slide">
      <div v-if="showStatsPanel" class="stats-panel">
        <div class="stats-header">
          <h3>📊 日志统计</h3>
          <button class="btn-x" @click="showStatsPanel = false">✕</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-head">
              <div class="stat-card-title">总计</div>
            </div>
            <div class="stat-card-value">{{ store.allEntries.length }}</div>
          </div>
          <div class="stat-card error">
            <div class="stat-card-head">
              <AlertCircle class="stat-card-icon" :size="14" :stroke-width="2.25" />
              <div class="stat-card-title">错误</div>
            </div>
            <div class="stat-card-value">{{ store.stats.error }}</div>
            <div class="stat-card-bar" :style="{ width: errorPercent + '%' }"></div>
          </div>
          <div class="stat-card warning">
            <div class="stat-card-head">
              <TriangleAlert class="stat-card-icon" :size="14" :stroke-width="2.25" />
              <div class="stat-card-title">警告</div>
            </div>
            <div class="stat-card-value">{{ store.stats.warn }}</div>
            <div class="stat-card-bar" :style="{ width: warnPercent + '%' }"></div>
          </div>
          <div class="stat-card info">
            <div class="stat-card-head">
              <Info class="stat-card-icon" :size="14" :stroke-width="2.25" />
              <div class="stat-card-title">信息</div>
            </div>
            <div class="stat-card-value">{{ store.stats.info }}</div>
            <div class="stat-card-bar" :style="{ width: infoPercent + '%' }"></div>
          </div>
          <div class="stat-card debug">
            <div class="stat-card-head">
              <Bug class="stat-card-icon" :size="14" :stroke-width="2.25" />
              <div class="stat-card-title">调试</div>
            </div>
            <div class="stat-card-value">{{ store.stats.debug }}</div>
            <div class="stat-card-bar" :style="{ width: debugPercent + '%' }"></div>
          </div>
        </div>
        <div class="stats-modules">
          <h4>模块分布</h4>
          <div class="module-list">
            <div v-for="mod in topModules" :key="mod.name" class="module-item">
              <span class="module-name">{{ mod.name }}</span>
              <div class="module-bar-wrapper">
                <div class="module-bar" :style="{ width: mod.percent + '%' }"></div>
              </div>
              <span class="module-count">{{ mod.count }}</span>
            </div>
          </div>
        </div>
        <div class="stats-timeline">
          <h4>时间分布（最近24小时）</h4>
          <div class="timeline-chart">
            <div
              v-for="(hour, i) in hourlyStats"
              :key="i"
              class="timeline-bar"
              :style="{ height: Math.max(4, hour.percent) + '%' }"
              :title="`${hour.label}: ${hour.count}条`"
            ></div>
          </div>
          <div class="timeline-labels">
            <span>24h前</span>
            <span>12h前</span>
            <span>现在</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 日志列表 -->
    <div class="logs-container" ref="containerRef" @scroll="onScroll">
      <div v-if="store.isLoading && !filteredAndSearchedEntries.length" class="empty">
        <span>加载中...</span>
      </div>
      <div v-else-if="!filteredAndSearchedEntries.length" class="empty">
        <span>暂无日志</span>
      </div>
      <div v-else class="log-list">
        <div
          v-for="entry in filteredAndSearchedEntries"
          :key="entry.id"
          :class="['log-row', entry.level, { expanded: (entry as any)._expanded }]"
          @click="toggle(entry)"
        >
          <!-- 主行 -->
          <div class="row-main">
            <span :class="['lvl', entry.level]">
              <component :is="LEVEL_META[entry.level].icon" class="lvl-icon" :size="12" :stroke-width="2.25" />
              <span>{{ LEVEL_META[entry.level].label }}</span>
            </span>
            <span class="time" :title="formatFullTime(entry.timestamp)">
              {{ showFullTime ? formatFullTime(entry.timestamp) : fmtTime(entry.timestamp) }}
            </span>
            <span class="source-badge" :class="entry.source">
              {{ entry.source === 'frontend' ? 'FE' : 'BE' }}
            </span>
            <span class="mod" :title="entry.module">{{ entry.module }}</span>
            <span class="msg" v-html="highlightSearch(entry.message)"></span>
            <div class="row-actions" @click.stop>
              <button v-if="entry.detail" class="action-btn" @click="toggle(entry)" :title="(entry as any)._expanded ? '收起' : '展开'">
                {{ (entry as any)._expanded ? '▼' : '▶' }}
              </button>
              <button class="action-btn" @click="copyEntry(entry)" title="复制">⧉</button>
            </div>
          </div>
          <!-- 展开详情 -->
          <div v-if="(entry as any)._expanded" class="row-detail">
            <pre v-html="formatDetail(entry.detail)"></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span>共 {{ filteredAndSearchedEntries.length }} 条日志</span>
      <span v-if="searchKeyword">（搜索: {{ searchKeyword }}）</span>
      <span class="connection-status" :class="{ connected: sseConnected }">
        {{ sseConnected ? '● 实时' : '○ 离线' }}
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
defineOptions({ name: 'LogsView' })
import { AlertCircle, TriangleAlert, Info, Bug } from '@/components/common/icon/lucide'
import { useLogsViewSetup } from '@/composables/logs/useLogsViewSetup'
const { store, containerRef, searchKeyword, filterSource, autoScroll, showFullTime, sseConnected, copiedId, timeRange, showCustomTimePicker, customTimeStart, customTimeEnd, filterStartTime, filterEndTime, showStatsPanel, LEVEL_META, filteredAndSearchedEntries, totalLogs, errorPercent, warnPercent, infoPercent, debugPercent, topModules, hourlyStats, applyTimeFilter, applyCustomTime, quickFilter, fmtTime, formatFullTime, highlightSearch, formatDetail, toggle, copyEntry, onScroll, handleClear } = useLogsViewSetup()
</script>

<style scoped src="./LogsView.css"></style>
