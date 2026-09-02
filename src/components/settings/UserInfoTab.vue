<template>
  <div class="user-info-tab">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载用户信息...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <AlertCircle :size="24" />
      <span>{{ resolvedErrorText }}</span>
      <button class="retry-btn" @click="handleRetry">重试</button>
    </div>

    <!-- User Info Content -->
    <template v-else-if="userInfo">
      <!-- Details -->
      <div class="details-card">
        <div class="card-title">
          <User :size="16" />
          <span>基本信息</span>
        </div>
        <div class="detail-list">
          <div class="detail-row">
            <span class="label">手机号</span>
            <span class="value">{{ userInfo.user?.phone || '-' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">邮箱</span>
            <span class="value">{{ userInfo.user?.email || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- Balance -->
      <div class="balance-card">
        <div class="card-title">
          <Wallet :size="16" />
          <span>当前可用积分</span>
        </div>
        <div class="balance-value">{{ balanceText }}</div>
      </div>

      <!-- Roles -->
      <div v-if="userInfo.role_info?.length" class="tags-card">
        <div class="card-title">
          <Shield :size="16" />
          <span>角色</span>
        </div>
        <div class="tags">
          <span v-for="role in userInfo.role_info" :key="role.code" class="tag tag-role">
            {{ role.name }}
          </span>
        </div>
      </div>

      <!-- Departments -->
      <div v-if="userInfo.department_info?.length" class="tags-card">
        <div class="card-title">
          <Building2 :size="16" />
          <span>部门</span>
        </div>
        <div class="tags">
          <span v-for="dept in userInfo.department_info" :key="dept.id" class="tag tag-dept">
            {{ dept.name }}
          </span>
        </div>
      </div>
    </template>

    <!-- 登录操作区 -->
    <div class="login-actions-card">
      <template v-if="authStatus === 'ready'">
        <button class="action-btn btn-logout" @click="handleLogout">退出登录</button>
      </template>
      <template v-else>
        <div class="login-actions-hint">{{ resolvedErrorText }}</div>
        <div class="login-actions-row">
          <button class="action-btn btn-password" @click="showPasswordModal = true">账密登录</button>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="false"></div>

    <!-- 账密登录弹窗 -->
    <div v-if="showPasswordModal" class="modal-mask" @click.self="showPasswordModal = false">
      <div class="modal">
        <h3 class="modal-title">账密登录</h3>
        <div class="modal-field">
          <label>账号</label>
          <input v-model="loginForm.username" type="text" placeholder="请输入账号" @keydown.enter="handlePasswordLogin" />
        </div>
        <div class="modal-field">
          <label>密码</label>
          <input v-model="loginForm.password" type="password" placeholder="请输入密码" @keydown.enter="handlePasswordLogin" />
        </div>
        <p v-if="loginError" class="modal-error">{{ loginError }}</p>
        <div class="modal-actions">
          <button class="action-btn btn-sso" @click="showPasswordModal = false">取消</button>
          <button class="action-btn btn-password" :disabled="pwdLoading" @click="handlePasswordLogin">
            {{ pwdLoading ? '登录中...' : '登录' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { AlertCircle, User, Shield, Building2, Wallet } from '@/components/common/icon/lucide'
import { useUserStore } from '@/stores/auth.store'

const userStore = useUserStore()
const {
  loading,
  error,
  userInfo,
  balance,
  balanceLoading,
  authStatus,
} = storeToRefs(userStore)

const resolvedErrorText = computed(() => {
  return error.value || '获取用户信息失败'
})

const balanceText = computed(() => {
  if (balanceLoading.value) return '加载中...'
  if (typeof balance.value !== 'number') return '-'
  return balance.value.toLocaleString('en-US')
})

async function handleRetry() {
  await userStore.refreshProfile(true)
}

function handleLogout() {
  userStore.logout()
}

// 账密登录
const showPasswordModal = ref(false)
const pwdLoading = ref(false)
const loginError = ref('')
const loginForm = reactive({ username: '', password: '' })

async function handlePasswordLogin() {
  loginError.value = ''
  if (!loginForm.username.trim()) { loginError.value = '请输入账号'; return }
  if (!loginForm.password.trim()) { loginError.value = '请输入密码'; return }

  pwdLoading.value = true
  try {
    await userStore.passwordLogin(loginForm.username, loginForm.password)
    await userStore.fetchBalance(true)
    showPasswordModal.value = false
    loginForm.username = ''
    loginForm.password = ''
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录失败'
  } finally {
    pwdLoading.value = false
  }
}

onMounted(() => {
  if (!userInfo.value?.user?.id) {
    void userStore.refreshProfile()
    return
  }
  void userStore.fetchBalance()
})
</script>

<style scoped src="./UserInfoTab.scss"></style>
