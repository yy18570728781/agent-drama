import { ref } from 'vue';
import * as THREE from 'three';
import type { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';

export interface RenderLoopDeps {
  dScene: DirectorScene;
  getProps: () => {
    project: DirectingProject;
    selectedElementId: string | null;
    selectedElementType: string | null;
    selectedJointKey: keyof MannequinJoints | null;
    customEditorCamera: boolean;
    hideHelpers?: boolean;
    selectionMode?: boolean;
    exportTrigger: number;
  };
  stepFlyCamera: () => void;
  triggerObjectChangeUpdate: (force?: boolean) => void;
  containerRef: HTMLDivElement | null;
  canvasRef: HTMLCanvasElement | null;
  setIsDragging: (v: boolean) => void;
  onGroupDragStart: () => void;
  emit: {
    (e: 'commitHistoryState'): void;
  };
}

export function useCanvasRenderLoop(deps: RenderLoopDeps) {
  const mainLetterbox = ref<{ x: number; y: number; w: number; h: number } | null>(null);

  const renderMainAndPip = () => {
    const props = deps.getProps();
    const activeCameraObj = props.project.cameras.find(c => c.id === props.project.activeCameraId);
    const helperVisibleMode = !props.hideHelpers && props.customEditorCamera && props.project.viewMode === '3D';

    if (deps.dScene.renderer && deps.dScene.scene) {
      try {
        if (!props.customEditorCamera && activeCameraObj) {
          renderMainCameraView(activeCameraObj, helperVisibleMode, props);
        } else if (deps.dScene.editorCamera) {
          mainLetterbox.value = null;
          const w = deps.containerRef ? deps.containerRef.clientWidth : 1;
          const h = deps.containerRef ? deps.containerRef.clientHeight : 1;
          deps.dScene.renderer.setViewport(0, 0, w, h);
          deps.dScene.renderer.setScissorTest(false);
          deps.dScene.setGizmosAndHelpersVisible(helperVisibleMode, props.project, props.customEditorCamera, false, !!props.selectionMode);
          deps.dScene.renderer.render(deps.dScene.scene, deps.dScene.editorCamera);
        }
      } catch (err) {
        console.error('WebGL main render failed:', err);
      }
    }

    renderPip(activeCameraObj, helperVisibleMode, props);
  };

  const renderMainCameraView = (activeCameraObj: any, helperVisibleMode: boolean, props: any) => {
    const w = deps.containerRef ? deps.containerRef.clientWidth : 1;
    const h = deps.containerRef ? deps.containerRef.clientHeight : 1;

    let targetAspect = w / h;
    const hasCustomAspect = props.project.aspectRatio && props.project.aspectRatio !== 'auto';
    if (hasCustomAspect) {
      targetAspect = deps.dScene.parseAspectRatio(props.project.aspectRatio);
    }

    let vw = w;
    let vh = w / targetAspect;
    if (vh > h) { vh = h; vw = h * targetAspect; }
    const vx = (w - vw) / 2;
    const vy = (h - vh) / 2;

    mainLetterbox.value = hasCustomAspect ? { x: vx, y: vy, w: vw, h: vh } : null;

    const tempCam = deps.dScene.buildSceneCamera(activeCameraObj, vw / vh);

    deps.dScene.renderer.setScissorTest(false);
    deps.dScene.renderer.setViewport(0, 0, w, h);
    deps.dScene.renderer.setClearColor(0x000000, 1);
    deps.dScene.renderer.clear();

    deps.dScene.renderer.setViewport(vx, vy, vw, vh);
    deps.dScene.renderer.setScissor(vx, vy, vw, vh);
    deps.dScene.renderer.setScissorTest(true);

    deps.dScene.setGizmosAndHelpersVisible(false, props.project, props.customEditorCamera, true, !!props.selectionMode);
    deps.dScene.renderer.render(deps.dScene.scene, tempCam);
    deps.dScene.setGizmosAndHelpersVisible(helperVisibleMode, props.project, props.customEditorCamera, false, !!props.selectionMode);
    deps.dScene.renderer.setScissorTest(false);
  };

  const renderPip = (activeCameraObj: any, helperVisibleMode: boolean, props: any) => {
    const pipCanvas = document.getElementById('pip-canvas') as HTMLCanvasElement | null;
    if (pipCanvas && deps.dScene.scene && activeCameraObj) {
      try {
        const w = pipCanvas.clientWidth;
        const h = pipCanvas.clientHeight;
        if (w > 0 && h > 0) {
          ensurePipRenderer(pipCanvas);
          if (!deps.dScene.pipRenderer) return;
          deps.dScene.pipRenderer.shadowMap.enabled = true;
          deps.dScene.pipRenderer.shadowMap.type = THREE.PCFShadowMap;
          deps.dScene.pipRenderer.outputColorSpace = THREE.SRGBColorSpace;
          deps.dScene.pipRenderer.setSize(w, h, false);

          let pipTargetAspect = w / h;
          if (props.project.aspectRatio && props.project.aspectRatio !== 'auto') {
            pipTargetAspect = deps.dScene.parseAspectRatio(props.project.aspectRatio);
          }

          let pvw = w;
          let pvh = w / pipTargetAspect;
          if (pvh > h) { pvh = h; pvw = h * pipTargetAspect; }
          const pvx = (w - pvw) / 2;
          const pvy = (h - pvh) / 2;

          const tempPipCam = deps.dScene.buildSceneCamera(activeCameraObj, pvw / pvh);

          deps.dScene.pipRenderer.setScissorTest(false);
          deps.dScene.pipRenderer.setViewport(0, 0, w, h);
          deps.dScene.pipRenderer.setClearColor(0x000000, 1);
          deps.dScene.pipRenderer.clear();
          deps.dScene.pipRenderer.setViewport(pvx, pvy, pvw, pvh);
          deps.dScene.pipRenderer.setScissor(pvx, pvy, pvw, pvh);
          deps.dScene.pipRenderer.setScissorTest(true);

          deps.dScene.setGizmosAndHelpersVisible(false, props.project, props.customEditorCamera, true, !!props.selectionMode);
          const pipGl = deps.dScene.pipRenderer.getContext();
          if (!pipGl.isContextLost()) {
            deps.dScene.pipRenderer.render(deps.dScene.scene, tempPipCam);
          }
          deps.dScene.setGizmosAndHelpersVisible(helperVisibleMode && props.customEditorCamera, props.project, props.customEditorCamera, false, !!props.selectionMode);
          deps.dScene.pipRenderer.setScissorTest(false);
        }
      } catch (err) {
        console.error('WebGL secondary PiP render failed:', err);
      }
    } else {
      if (deps.dScene.pipRenderer) {
        deps.dScene.pipRenderer.dispose();
        deps.dScene.pipRenderer.forceContextLoss();
        deps.dScene.pipRenderer = null;
      }
    }
  };

  const ensurePipRenderer = (pipCanvas: HTMLCanvasElement) => {
    if (!deps.dScene.pipRenderer || deps.dScene.pipRenderer.domElement !== pipCanvas) {
      if (deps.dScene.pipRenderer) {
        deps.dScene.pipRenderer.dispose();
        deps.dScene.pipRenderer.forceContextLoss();
        deps.dScene.pipRenderer = null;
      }
      try {
        deps.dScene.pipRenderer = new THREE.WebGLRenderer({ canvas: pipCanvas, antialias: true, alpha: true });
      } catch {
        deps.dScene.pipRenderer = null;
      }
      if (deps.dScene.pipRenderer) {
        const initGl = deps.dScene.pipRenderer.getContext();
        if (initGl && initGl.isContextLost()) {
          deps.dScene.pipRenderer.dispose();
          deps.dScene.pipRenderer.forceContextLoss();
          deps.dScene.pipRenderer = null;
        }
      }
    }
  };

  return { mainLetterbox, renderMainAndPip };
}
