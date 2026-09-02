import { ref } from 'vue';

export type HudToast = { message: string; type: 'success' | 'info' | 'error' } | null;
export type ShowHudToastFn = (message: string, type?: 'success' | 'info' | 'error') => void;

export function useCanvasHudToast() {
  const hudToast = ref<HudToast>(null);
  let hudToastTimeout: ReturnType<typeof setTimeout> | null = null;

  const showHudToast: ShowHudToastFn = (message, type = 'success') => {
    if (hudToastTimeout) {
      clearTimeout(hudToastTimeout);
    }
    hudToast.value = { message, type };
    hudToastTimeout = setTimeout(() => {
      hudToast.value = null;
    }, 2500);
  };

  return { hudToast, showHudToast };
}
