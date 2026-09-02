<template>
  <div class="about-view">
    <div class="user-card">
      <div class="user-header">
        <div class="avatar">
          <User :size="40" class="avatar-icon" />
        </div>
        <div class="basic-info">
          <div class="user-name">陈建男</div>
          <div class="id-row">
            <span class="id-label">ID:</span>
            <span class="id-value">4139</span>
          </div>
        </div>
      </div>
      <div class="divider" />
      <div class="contact-section">
        <div class="section-title">联系方式</div>
        <div class="info-row">
          <span class="info-label">手机号码</span>
          <span class="info-value">15575859081</span>
        </div>
        <div class="info-row">
          <span class="info-label">邮箱</span>
          <span class="info-value">15575859081@teamones.com</span>
        </div>
        <div class="info-row">
          <span class="info-label">性别</span>
          <span class="info-value">男</span>
        </div>
      </div>
    </div>

    <div class="org-card">
      <div class="card-title">组织信息</div>
      <div class="info-row">
        <span class="info-label">所属公司</span>
        <span class="info-value">长沙神漫文化科技有限公司</span>
      </div>
      <div class="info-row">
        <span class="info-label">部门</span>
        <span class="info-value">TO组</span>
      </div>
    </div>

    <div class="role-card">
      <div class="card-title">角色权限</div>
      <div class="role-tags">
        <div class="role-tag purple">
          <User :size="14" />
          <span>组员</span>
        </div>
        <div class="role-tag green">
          <Check :size="14" />
          <span>QA</span>
        </div>
        <div class="role-tag blue">
          <Bot :size="14" />
          <span>AI小助手</span>
        </div>
        <div class="role-tag orange">
          <Film :size="14" />
          <span>环节制片</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Check, Bot, Film } from '@/components/common/icon/lucide'
</script>

<style scoped>
.about-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--bg-base);
}

.user-card, .org-card, .role-card {
  border-radius: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-surface);
  padding: 24px;
}

.user-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background: #7C6EF6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-icon { color: #FFFFFF; }

.basic-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.id-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.id-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.id-value {
  font-size: 13px;
  color: var(--text-primary);
}

.divider {
  height: 1px;
  background: var(--border-light);
}

.contact-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title, .card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.org-card, .role-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.role-tag.purple {
  background: rgba(124, 110, 246, 0.12);
  color: #7C6EF6;
}
.role-tag.green {
  background: rgba(52, 211, 153, 0.12);
  color: #34D399;
}
.role-tag.blue {
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
}
.role-tag.orange {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
</style>
