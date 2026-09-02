<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';
import ViewfinderOverlay from '@/components/director-3d/overlay/ViewfinderOverlay.vue';

import { useCanvasHudToast } from '@/composables/director-3d/canvas/useCanvasHudToast';
import { useCanvasKeyboard } from '@/composables/director-3d/canvas/useCanvasKeyboard';
import { useCanvasFlyCamera } from '@/composables/director-3d/canvas/useCanvasFlyCamera';
import { useCanvasViewport } from '@/composables/director-3d/canvas/useCanvasViewport';
import { useCanvasWatchers } from '@/composables/director-3d/canvas/useCanvasWatchers';
import { useCanvasMouseInteraction } from '@/composables/director-3d/canvas/useCanvasMouseInteraction';
import { useCanvasRenderLoop } from '@/composables/director-3d/canvas/useCanvasRenderLoop';
import { useCanvasTransformSync } from '@/composables/director-3d/canvas/useCanvasTransformSync';

const props = withDefaults(defineProps<{
  project: DirectingProject;
  selectedElementId: string | null;
  selectedElementType: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null;
  exportTrigger: number;
  customEditorCamera: boolean;
  selectedJointKey: keyof MannequinJoints | null;
  hideHelpers?: boolean;
  selectionMode?: boolean;
}>(), {
  hideHelpers: false,
  selectionMode: false
});

const emit = defineEmits<{
  (e: 'selectElement', id: string | null, type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null, isShift?: boolean, isCtrl?: boolean, forceMultiIds?: string[]): void;
  (e: 'exitSelectionMode'): void;
  (e: 'exportDone', dataUrl: string): void;
  (e: 'changeCustomEditorCamera', val: boolean): void;
  (e: 'changeSelectedJointKey', val: keyof MannequinJoints | null): void;
  (e: 'updateProject', proj: DirectingProject): void;
  (e: 'commitHistoryState'): void;
  (e: 'viewportClick'): void;
}>();

const getProps = () => props;

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const dScene = new DirectorScene();

let isDragging = false;
const setIsDragging = (v: boolean) => { isDragging = v; };

const { hudToast, showHudToast } = useCanvasHudToast();
const keyboard = useCanvasKeyboard({ dScene, showHudToast });
const flyCamera = useCanvasFlyCamera({ dScene, getProps, emit: emit as any, showHudToast });
const viewport = useCanvasViewport({ dScene, getProps, emit: emit as any, showHudToast });
const transformSync = useCanvasTransformSync({ dScene, getProps, emit: emit as any });
const mouseInteraction = useCanvasMouseInteraction({
  dScene, getProps,
  emit: emit as any,
  showHudToast,
  setIsDragging,
  get canvasRef() { return canvasRef.value; },
  get containerRef() { return containerRef.value; },
});
const renderLoop = useCanvasRenderLoop({
  dScene, getProps,
  stepFlyCamera: flyCamera.stepFlyCamera,
  triggerObjectChangeUpdate: transformSync.triggerObjectChangeUpdate,
  get containerRef() { return containerRef.value; },
  get canvasRef() { return canvasRef.value; },
  setIsDragging,
  onGroupDragStart: () => {},
  emit: emit as any,
});
useCanvasWatchers({ dScene, getProps, emit: emit as any });

onMounted(() => {
  if (!containerRef.value || !canvasRef.value) return;

  dScene.initialize(containerRef.value, canvasRef.value,
    ({ force }) => { transformSync.triggerObjectChangeUpdate(force); },
    (dragged) => {
      setIsDragging(dragged);
      if (dragged) {
        emit('commitHistoryState');
        if (dScene.transformControls?.object === dScene.groupGizmo && props.selectedElementType === 'group' && props.selectedElementId) {
          const gId = props.selectedElementId;
          dScene.groupGizmoInitialPos.copy(dScene.groupGizmo!.position);
          dScene.groupGizmoInitialRot.copy(dScene.groupGizmo!.rotation);
          dScene.groupGizmoInitialScale.copy(dScene.groupGizmo!.scale);
          dScene.groupInitialPositions.clear();
          dScene.groupInitialRotations.clear();
          dScene.groupInitialScales.clear();
          props.project.mannequins.forEach(m => {
            if (m.groupId === gId) {
              dScene.groupInitialPositions.set(m.id, new THREE.Vector3(m.position.x, m.position.y, m.position.z));
              dScene.groupInitialRotations.set(m.id, new THREE.Vector3(m.rotation.x, m.rotation.y, m.rotation.z));
              dScene.groupInitialScales.set(m.id, new THREE.Vector3(m.scale.x, m.scale.y, m.scale.z));
            }
          });
        }
      }
    }
  );

  dScene.onGlbLoaded = () => {
    const p = getProps();
    dScene.syncMannequins(p.project, p.selectedElementId, p.selectedElementType, p.selectedJointKey, !!p.hideHelpers);
  };

  let animationFrameId: number;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    dScene.stepAnimations(props.project);
    if (dScene.controls) {
      dScene.controls.enabled = props.customEditorCamera && !dScene.transformControls?.dragging;
      if (dScene.controls.enabled) dScene.controls.update();
    }
    flyCamera.stepFlyCamera();
    renderLoop.renderMainAndPip();
    dScene.syncNameTags(props.project);
  };
  animate();

  let resizeAnimFrameId: number;
  const handleResize = () => {
    if (!containerRef.value) return;
    dScene.resize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  };
  window.addEventListener('resize', handleResize);
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeAnimFrameId);
    resizeAnimFrameId = requestAnimationFrame(handleResize);
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);

  mouseInteraction.mount(canvasRef.value);
  keyboard.mount();
  flyCamera.mount();
  viewport.mount();

  dScene.syncLights(props.project);
  dScene.syncCameras(props.project, props.selectedElementId, props.customEditorCamera);
  dScene.syncImagePlanes(props.project);
  dScene.syncMannequins(props.project, props.selectedElementId, props.selectedElementType, props.selectedJointKey, !!props.hideHelpers);
  dScene.syncGround(props.project);
  dScene.syncTransformGizmoAttachment(props.project, props.selectedElementId, props.selectedElementType, props.selectedJointKey, !!props.hideHelpers, props.customEditorCamera);
  dScene.setGizmosAndHelpersVisible(!props.hideHelpers, props.project, props.customEditorCamera, false, !!props.selectionMode);

  onUnmounted(() => {
    cancelAnimationFrame(animationFrameId);
    cancelAnimationFrame(resizeAnimFrameId);
    window.removeEventListener('resize', handleResize);
    resizeObserver.disconnect();
    keyboard.unmount();
    flyCamera.unmount();
    viewport.unmount();
    if (canvasRef.value) mouseInteraction.unmount(canvasRef.value);
    dScene.dispose();
  });
});

flyCamera.setupWatchers();

function generateThumbnail() {
  return dScene.generateThumbnail(props.project);
}

defineExpose({ generateThumbnail });
</script>

<template>
  <div ref="containerRef" class="relative w-full h-full bg-[#101216] select-none overflow-hidden" id="editor-main-viewport">
    <canvas ref="canvasRef" class="w-full h-full block" id="threejs-director-main-canvas" />

    <ViewfinderOverlay
      :project="project"
      :customEditorCamera="customEditorCamera"
      :viewportSlots="viewport.viewportSlots.value"
      :hudToast="hudToast"
      @save-viewport="viewport.saveViewport"
      @load-viewport="viewport.loadViewport"
      @exit-camera-view="emit('changeCustomEditorCamera', true)"
    />
  </div>
</template>
