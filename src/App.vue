<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SidebarNav from '@/components/layout/SidebarNav.vue'
import GlobalTaskQueue from '@/components/generation/GlobalTaskQueue.vue'
import ImageCompressDialogHost from '@/components/common/ImageCompressDialogHost.vue'
import { setAuthBootstrapPending } from '@/api/client'
import { resolveSidecarBase } from '@/api/sidecarBase'
import { useGenerationBalanceSync } from '@/composables/generation/useGenerationBalanceSync'
import { useUserStore } from '@/stores/auth.store'
import { usePbrOverlayStore } from '@/stores/pbrOverlay.store'

const PBRToolOverlay = defineAsyncComponent(() => import('@/components/pbr/PBRToolOverlay.vue'))

const userStore = useUserStore()
const pbrOverlayStore = usePbrOverlayStore()
const route = useRoute()

useGenerationBalanceSync()

const isStandaloneView = computed(() => route.meta.standalone === true)
const isDiscoverRoute = computed(() => route.path.startsWith('/discover'))

function handleUnauthorized(): void {
  if (userStore.manualLogout) return
  void userStore.bootstrapSession(true)
}

async function bootstrapAuth(): Promise<void> {
  if (userStore.authStatus === 'ready' || userStore.authStatus === 'error') return
  setAuthBootstrapPending(true)
  try {
    void resolveSidecarBase()
    if (userStore.manualLogout) return
    await userStore.bootstrapSession()
  } finally {
    setAuthBootstrapPending(false)
  }
}

onMounted(() => {
  window.addEventListener('auth:unauthorized', handleUnauthorized)
  void bootstrapAuth()
})

onUnmounted(() => {
  window.removeEventListener('auth:unauthorized', handleUnauthorized)
})
</script>

<template>
  <div class="app-shell" :class="{ 'is-discover-route': isDiscoverRoute }">
    <SidebarNav v-if="!isStandaloneView">
      <template #footerAction>
        <GlobalTaskQueue />
      </template>
    </SidebarNav>
    <div class="workspace">
      <main class="main-content">
        <RouterView />
      </main>
    </div>
    <PBRToolOverlay v-if="pbrOverlayStore.visible" />
    <ImageCompressDialogHost />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: row-reverse;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-base);
  min-width: 0;
}
</style>
