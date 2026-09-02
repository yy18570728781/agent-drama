<template>
  <div class="auth-page">
    <div class="auth-panel">
      <div class="auth-panel-inner">
        <!-- 自动登录中 -->
        <template v-if="isAutoLogging">
          <div class="auth-spinner"></div>
          <p class="auth-status-title">{{ authLoadingTitle }}</p>
          <p class="auth-status-hint">{{ authLoadingHint }}</p>
        </template>

        <!-- 登录表单 -->
        <template v-else>
          <div class="auth-brand">
            <h1 class="auth-brand-title">AI-Comic-Director-Canvas</h1>
            <p class="auth-brand-desc">AI 漫画画布创作平台</p>
          </div>

          <form class="auth-form" @submit.prevent="onPasswordLogin">
            <div class="auth-field">
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="请输入账号"
                autocomplete="username"
                @keydown.enter="onPasswordLogin"
              />
            </div>
            <div class="auth-field auth-field-password">
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                autocomplete="current-password"
                @keydown.enter="onPasswordLogin"
              />
              <button type="button" class="auth-toggle-pwd" @click="showPassword = !showPassword">
                <svg v-if="!showPassword" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>

            <p v-if="loginError" class="auth-error">{{ loginError }}</p>

            <button
              type="submit"
              class="auth-btn auth-btn-primary auth-btn-block"
              :disabled="loginLoading"
            >
              {{ loginLoading ? '登录中...' : '登录' }}
            </button>
          </form>

        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useUserStore } from '@/stores/auth.store'

const userStore = useUserStore()

/* ── 自动登录状态 ── */
const isAutoLogging = computed(() => (
  userStore.authStatus === 'loading' && !userStore.manualLogout
))

const authLoadingTitle = computed(() => {
  return '正在恢复登录...'
})

const authLoadingHint = computed(() => {
  return '正在验证当前登录状态'
})

/* ── 账密登录 ── */

const loginLoading = ref(false)
const loginError = ref('')
const loginForm = reactive({ username: '', password: '' })
const showPassword = ref(false)

async function onPasswordLogin() {
  loginError.value = ''
  if (!loginForm.username.trim()) { loginError.value = '请输入账号'; return }
  if (!loginForm.password.trim()) { loginError.value = '请输入密码'; return }

  loginLoading.value = true
  try {
    await userStore.passwordLogin(loginForm.username, loginForm.password)
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录失败'
  } finally {
    loginLoading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base, #1a1a2e);
}

/* ── 登录面板 ── */
.auth-panel {
  width: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  background: var(--bg-elevated, #16213e);
  border: 1px solid var(--border-subtle, #333);
  border-radius: 16px;
}

.auth-panel-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  position: relative;
}

/* ── 品牌 ── */
.auth-brand {
  text-align: center;
  margin-bottom: 8px;
}

.auth-brand-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #e0e0e0);
  margin: 0 0 6px;
}

.auth-brand-desc {
  font-size: 14px;
  color: var(--text-secondary, #999);
  margin: 0;
}

/* ── 自动登录 ── */
.auth-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-subtle, #333);
  border-top-color: var(--accent, #4fc3f7);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-status-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  margin: 0;
}

.auth-status-hint {
  font-size: 13px;
  color: var(--text-secondary, #999);
  margin: 0;
}

/* ── 表单 ── */
.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-muted, #444);
  background: var(--bg-base, #1a1a2e);
  color: var(--text-primary, #e0e0e0);
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.2s;
}

.auth-field input::placeholder {
  color: var(--text-muted, #666);
}

.auth-field input:focus {
  border-color: var(--accent, #4fc3f7);
}

.auth-field-password {
  position: relative;
}

.auth-field-password input {
  padding-right: 42px;
}

.auth-field-password input::-ms-reveal,
.auth-field-password input::-webkit-credentials-auto-fill-button {
  display: none;
}

.auth-toggle-pwd {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted, #666);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.auth-toggle-pwd:hover {
  color: var(--text-secondary, #999);
}

/* ── 错误提示 ── */
.auth-error {
  font-size: 13px;
  color: #ff6b6b;
  margin: -4px 0 0;
}

/* ── 分割线 ── */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  color: var(--text-muted, #666);
  font-size: 12px;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-muted, #333);
}

/* ── 按钮 ── */
.auth-btn {
  padding: 11px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--accent, #4fc3f7);
  line-height: 1.4;
}

.auth-btn-primary {
  background: var(--accent, #4fc3f7);
  color: #000;
  border-color: var(--accent, #4fc3f7);
}

.auth-btn-primary:hover {
  opacity: 0.85;
}

.auth-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-btn-outline {
  background: transparent;
  color: var(--accent, #4fc3f7);
}

.auth-btn-outline:hover {
  background: var(--accent, #4fc3f7);
  color: #000;
}

.auth-btn-block {
  width: 100%;
}
</style>
