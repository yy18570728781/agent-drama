import { ref } from 'vue'
import { defineStore } from 'pinia'

export const usePbrOverlayStore = defineStore('pbrOverlay', () => {
  const visible = ref(false)

  function openOverlay(): void {
    visible.value = true
  }

  function closeOverlay(): void {
    visible.value = false
  }

  return {
    visible,
    openOverlay,
    closeOverlay,
  }
})
