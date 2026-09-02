import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/discover' },
  { path: '/discover', name: 'discover', component: () => import('@/views/DiscoverView.vue') },
  {
    path: '/discover/cases/:caseId/preview',
    name: 'discover-case-preview',
    component: () => import('@/views/DiscoverCasePreviewView.vue'),
    meta: { standalone: true },
  },
  { path: '/card', name: 'card', component: () => import('@/views/CardView.vue') },
  { path: '/logs', name: 'logs', component: () => import('@/views/LogsView.vue') },
  { path: '/toolbox', name: 'toolbox', component: () => import('@/views/ToolboxView.vue') },
  {
    path: '/flow/single',
    name: 'flow-single',
    component: () => import('@/views/FlowRouteView.vue'),
    meta: { standalone: true },
  },
  { path: '/flow', name: 'flow', component: () => import('@/views/FlowRouteView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/subjects', name: 'subjects', component: () => import('@/views/SubjectListView.vue') },
  { path: '/subjects/:id', name: 'subject-detail', component: () => import('@/views/SubjectDetailView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/discover' },
]
