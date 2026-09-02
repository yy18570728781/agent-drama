import { watch, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import type { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';
import type { ShowHudToastFn } from './useCanvasHudToast';

export interface FlyCameraDeps {
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
  emit: {
    (e: 'updateProject', proj: DirectingProject): void;
    (e: 'changeCustomEditorCamera', val: boolean): void;
  };
  showHudToast: ShowHudToastFn;
}

export function useCanvasFlyCamera(deps: FlyCameraDeps) {
  const pressedKeys = new Set<string>();
  let lastCustomCam = false;

  const stepFlyCamera = () => {
    const props = deps.getProps();
    const activeCameraId = props.project.activeCameraId;
    const activeCameraObj = props.project.cameras.find(c => c.id === activeCameraId);
    if (
      !props.customEditorCamera && 
      props.selectedElementType === 'camera' && 
      props.selectedElementId === activeCameraId &&
      activeCameraObj && 
      !activeCameraObj.locked &&
      pressedKeys.size > 0
    ) {
      const pos = new THREE.Vector3(activeCameraObj.position.x, activeCameraObj.position.y, activeCameraObj.position.z);
      const tgt = new THREE.Vector3(activeCameraObj.target.x, activeCameraObj.target.y, activeCameraObj.target.z);
      
      const forward = new THREE.Vector3().subVectors(tgt, pos).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      
      let moveVec = new THREE.Vector3(0, 0, 0);
      let currentSpeed = 0.05;
      if (pressedKeys.has('shift')) {
        currentSpeed = 0.15;
      }
      
      if (pressedKeys.has('w')) moveVec.addScaledVector(forward, currentSpeed);
      if (pressedKeys.has('s')) moveVec.addScaledVector(forward, -currentSpeed);
      if (pressedKeys.has('d')) moveVec.addScaledVector(right, currentSpeed);
      if (pressedKeys.has('a')) moveVec.addScaledVector(right, -currentSpeed);
      if (pressedKeys.has('e')) moveVec.y += currentSpeed;
      if (pressedKeys.has('q')) moveVec.y -= currentSpeed;
      
      if (moveVec.lengthSq() > 0) {
        const nextPos = pos.clone().add(moveVec);
        const nextTgt = tgt.clone().add(moveVec);
        
        deps.emit('updateProject', {
          ...props.project,
          cameras: props.project.cameras.map(c => c.id === activeCameraId ? {
            ...c,
            position: {
              x: Number(nextPos.x.toFixed(4)),
              y: Number(nextPos.y.toFixed(4)),
              z: Number(nextPos.z.toFixed(4)),
            },
            target: {
              x: Number(nextTgt.x.toFixed(4)),
              y: Number(nextTgt.y.toFixed(4)),
              z: Number(nextTgt.z.toFixed(4)),
            }
          } : c)
        });
      }
    }
  };

  const handleWASDKeyDown = (e: KeyboardEvent) => {
    const props = deps.getProps();
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.getAttribute('contenteditable') === 'true')
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
      if (!props.customEditorCamera && props.selectedElementType === 'camera') {
        if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
          e.preventDefault();
        }
        pressedKeys.add(key);
      }
    }
  };

  const handleWASDKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) {
      pressedKeys.delete(key);
    }
  };

  const handleBlur = () => {
    pressedKeys.clear();
  };

  const syncCameraOnSwitch = (newVal: boolean) => {
    const props = deps.getProps();
    if (newVal && !lastCustomCam) {
      const activeCam = props.project.cameras.find(c => c.id === props.project.activeCameraId);
      if (activeCam && deps.dScene.editorCamera && deps.dScene.controls) {
        deps.dScene.editorCamera.position.set(activeCam.position.x, activeCam.position.y, activeCam.position.z);
        deps.dScene.controls.target.set(activeCam.target.x, activeCam.target.y, activeCam.target.z);
        
        (deps.dScene.editorCamera as THREE.PerspectiveCamera).fov = activeCam.fov;
        (deps.dScene.editorCamera as THREE.PerspectiveCamera).updateProjectionMatrix();
        
        deps.dScene.controls.update();
        deps.showHudToast('3D自由视角观察相机已同步摄影机画幅位置', 'success');
      }
    }
    lastCustomCam = newVal;
  };

  const setupWatchers = () => {
    watch(() => deps.getProps().customEditorCamera, syncCameraOnSwitch);
  };

  const mount = () => {
    window.addEventListener('keydown', handleWASDKeyDown);
    window.addEventListener('keyup', handleWASDKeyUp);
    window.addEventListener('blur', handleBlur);
    lastCustomCam = deps.getProps().customEditorCamera;
  };

  const unmount = () => {
    window.removeEventListener('keydown', handleWASDKeyDown);
    window.removeEventListener('keyup', handleWASDKeyUp);
    window.removeEventListener('blur', handleBlur);
  };

  return { stepFlyCamera, setupWatchers, mount, unmount };
}
