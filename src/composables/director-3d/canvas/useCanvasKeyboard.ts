import { onMounted, onUnmounted } from 'vue';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';
import type { ShowHudToastFn } from './useCanvasHudToast';

export interface KeyboardDeps {
  dScene: DirectorScene;
  showHudToast: ShowHudToastFn;
}

export function useCanvasKeyboard(deps: KeyboardDeps) {
  const handleTransformModeKeys = (e: KeyboardEvent) => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    if (e.key.toLowerCase() === 'w') {
      if (deps.dScene.transformControls) deps.dScene.transformControls.setMode('translate');
      deps.showHudToast('变换调节：位移 (Translate)', 'info');
    } else if (e.key.toLowerCase() === 'e') {
      if (deps.dScene.transformControls) deps.dScene.transformControls.setMode('rotate');
      deps.showHudToast('变换调节：旋转 (Rotate)', 'info');
    } else if (e.key.toLowerCase() === 'r') {
      if (deps.dScene.transformControls) deps.dScene.transformControls.setMode('scale');
      deps.showHudToast('变换调节：缩放 (Scale)', 'info');
    }
  };

  const handleChangeTransformMode = ((e: Event) => {
    const mode = (e as CustomEvent).detail;
    if (deps.dScene.transformControls) {
      deps.dScene.transformControls.setMode(mode);
    }
  }) as EventListener;

  const mount = () => {
    window.addEventListener('keydown', handleTransformModeKeys);
    window.addEventListener('changeTransformMode', handleChangeTransformMode);
  };

  const unmount = () => {
    window.removeEventListener('keydown', handleTransformModeKeys);
    window.removeEventListener('changeTransformMode', handleChangeTransformMode);
  };

  return { mount, unmount };
}
