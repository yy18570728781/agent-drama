<script setup lang="ts">
import { onMounted } from 'vue'
import { RefreshCw, RotateCcw, Trash2 } from '@/components/common/icon/lucide'
import { useTeamonesRecordList } from '@/composables/assets/useTeamonesRecordList'

defineOptions({ name: 'TeamonesRecordList' })

const {
  loading,
  errorMessage,
  records,
  total,
  currentPage,
  pageSize,
  trashMode,
  repairingIds,
  pageTitle,
  thumbnailUrl,
  recordStatusText,
  recordFailReason,
  copyRecordFailReason,
  getRecordId,
  canRepairRecord,
  repairRecord,
  formatDate,
  statusTagType,
  loadRecords,
  handleCurrentChange,
  handleSizeChange,
  toggleTrashMode,
} = useTeamonesRecordList()

onMounted(() => {
  void loadRecords()
})
</script>

<template>
  <div class="teamones-record-page">
    <div class="page-header">
      <div class="page-heading">
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="page-description">
          {{ trashMode ? '查看已移入回收站的生成记录，便于核查或恢复。' : '查看生成任务使用的模型、执行状态与结果记录。' }}
        </p>
      </div>
      <div class="page-actions">
        <el-button :type="trashMode ? 'danger' : 'default'" plain @click="toggleTrashMode">
          <component :is="trashMode ? RotateCcw : Trash2" :size="15" />
          <span>{{ trashMode ? '返回正常记录' : '回收站' }}</span>
        </el-button>
        <el-button :loading="loading" @click="loadRecords">
          <RefreshCw :size="15" />
          <span>刷新</span>
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="errorMessage"
      class="page-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="errorMessage"
    />

    <div class="page-table">
      <el-table class="record-table" :data="records" height="100%" v-loading="loading" empty-text="暂无抽卡记录">
        <el-table-column label="缩略图" width="90">
          <template #default="scope">
            <div class="thumb-cell">
              <img v-if="thumbnailUrl(scope.row)" :src="thumbnailUrl(scope.row)" alt="thumb" class="thumb-image" />
              <span v-else class="thumb-empty">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="record_id" label="记录ID" min-width="110">
          <template #default="scope">
            <span class="id-cell">{{ scope.row.record_id || scope.row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="endpoint_id" label="终端ID" min-width="110">
          <template #default="scope">
            <span class="id-cell">{{ scope.row.endpoint_id ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" min-width="90" />
        <el-table-column prop="model_display_name" label="模型" min-width="140">
          <template #default="scope">
            <span>{{ scope.row.model_display_name || scope.row.model || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="statusText" label="状态" min-width="100">
          <template #default="scope">
            <div class="status-cell">
              <el-tag :type="statusTagType(scope.row.status)" effect="plain" round>
                {{ recordStatusText(scope.row) }}
              </el-tag>
              <el-tooltip
                v-if="scope.row.status === 'failed' && recordFailReason(scope.row)"
                :content="recordFailReason(scope.row)"
                placement="top"
                :show-after="150"
              >
                <el-button
                  size="small"
                  text
                  type="danger"
                  class="status-copy-btn"
                  @click="copyRecordFailReason(scope.row)"
                >
                  复制错误
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="prompt" label="提示词" min-width="320" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" min-width="180">
          <template #default="scope">
            <span class="date-cell">{{ formatDate(scope.row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button
              v-if="canRepairRecord(scope.row)"
              size="small"
              type="primary"
              plain
              :loading="repairingIds.has(getRecordId(scope.row))"
              @click="repairRecord(scope.row)"
            >
              修复记录
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="record-empty">
            <strong>{{ trashMode ? '回收站为空' : '暂无抽卡记录' }}</strong>
            <span>{{ trashMode ? '删除的记录会显示在这里' : '生成任务完成后会显示在这里' }}</span>
          </div>
        </template>
      </el-table>
    </div>

    <footer class="page-footer">
      <span class="footer-summary">共 <strong>{{ total }}</strong> 条记录</span>
      <el-pagination
        background
        layout="sizes, prev, pager, next"
        :total="total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </footer>
  </div>
</template>

<style scoped>
@import './TeamonesRecordList.css';
</style>
