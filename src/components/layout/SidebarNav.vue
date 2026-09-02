<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { primaryNavItems } from '@/app/navigation'
import type { NavItem } from '@/app/navigation'

const route = useRoute()
const router = useRouter()
const sidebarRef = ref<HTMLElement | null>(null)

function isNavItemActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function openNavItem(item: NavItem): void {
  void router.push(item.to)
}
</script>

<template>
  <nav ref="sidebarRef" class="sidebar-nav" aria-label="主导航">
    <div class="nav-items">
      <button
        v-for="item in primaryNavItems"
        :key="item.page"
        class="nav-item"
        :class="{ active: isNavItemActive(item) }"
        type="button"
        :aria-current="isNavItemActive(item) ? 'page' : undefined"
        @click="openNavItem(item)"
      >
        <span
          class="custom-icon nav-icon"
          :class="item.iconClass"
          aria-hidden="true"
        ></span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>

    <div class="nav-spacer"></div>

    <div class="sidebar-footer-action">
      <slot name="footerAction"></slot>
    </div>
  </nav>
</template>

<style scoped src="./SidebarNav.scss"></style>
