import { createRouter, createWebHashHistory } from 'vue-router'
import { setupQrCodeLoginGuard } from './guards'
import { routes } from './routes'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

setupQrCodeLoginGuard(router)

export default router
