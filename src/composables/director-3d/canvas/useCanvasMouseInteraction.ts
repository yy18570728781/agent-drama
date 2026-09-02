import * as THREE from 'three';
import type { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';
import type { ShowHudToastFn } from './useCanvasHudToast';

function getObjectName(id: string, project: DirectingProject): string {
  if (id === 'ground') return '场景地表';
  if (!project) return id;
  if (id.startsWith('mannequin')) return (project.mannequins || []).find(m => m.id === id)?.name || '特效人偶';
  if (id.startsWith('image') || id.startsWith('plane')) return (project.imagePlanes || []).find(p => p.id === id)?.name || '背景图层';
  if (id.startsWith('camera') || id.startsWith('cam')) return (project.cameras || []).find(c => c.id === id)?.name || '摄影机';
  if (id.startsWith('light')) return (project.lights || []).find(l => l.id === id)?.name || '灯光光源';
  if ((project.mannequins || []).some(m => m.groupId === id)) {
    const parentName = (project.mannequins || []).find(m => m.groupId === id)?.groupName;
    return parentName ? `阵组: ${parentName}` : `阵组: ${id}`;
  }
  return id;
}

export interface MouseInteractionDeps {
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
    (e: 'selectElement', id: string | null, type: any, isShift?: boolean, isCtrl?: boolean, forceMultiIds?: string[]): void;
    (e: 'exitSelectionMode'): void;
    (e: 'viewportClick'): void;
    (e: 'changeSelectedJointKey', val: keyof MannequinJoints | null): void;
  };
  showHudToast: ShowHudToastFn;
  setIsDragging: (v: boolean) => void;
  canvasRef: HTMLCanvasElement | null;
  containerRef: HTMLDivElement | null;
}

export function useCanvasMouseInteraction(deps: MouseInteractionDeps) {
  const canvasMouseDownPos = { x: 0, y: 0 };
  let canvasMouseDownTime = 0;

  const onCanvasClick = (event: MouseEvent) => {
    if (!deps.canvasRef || !deps.containerRef) return;
    if (deps.dScene.justFinishedDraggingGizmo) return;

    const dx = event.clientX - canvasMouseDownPos.x;
    const dy = event.clientY - canvasMouseDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 6 || (Date.now() - canvasMouseDownTime > 350)) return;

    deps.emit('viewportClick');
    const props = deps.getProps();
    if (!props.customEditorCamera) return;
    if (deps.dScene.transformControls?.dragging) return;

    const rect = deps.canvasRef.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const hit = deps.dScene.selectElementAtMouse(mx, my, rect.width, rect.height, props.project, props.customEditorCamera, !!props.selectionMode);
    if (hit) {
      const isShift = event.shiftKey;
      const isCtrl = event.ctrlKey || event.metaKey;

      if (hit.type === 'mannequin') {
        const mObj = props.project.mannequins.find(m => m.id === hit.id);
        if (mObj && mObj.groupId) {
          deps.emit('selectElement', mObj.groupId, 'group', isShift, isCtrl);
          deps.showHudToast(`已选中整个阵列组：${mObj.groupName || mObj.groupId}`, 'info');
          if (props.selectionMode) deps.emit('exitSelectionMode');
          return;
        }
      }

      deps.emit('selectElement', hit.id, hit.type, isShift, isCtrl);
      if (hit.type === 'mannequin' && hit.jointName) {
        deps.emit('changeSelectedJointKey', hit.jointName as keyof MannequinJoints);
        deps.showHudToast(`已直选实际关节：${hit.jointName}`, 'info');
      }
      if (props.selectionMode) deps.emit('exitSelectionMode');
    }
  };

  const onCanvasDblClick = (event: MouseEvent) => {
    if (!deps.canvasRef) return;
    const props = deps.getProps();
    if (!props.customEditorCamera) return;

    const rect = deps.canvasRef.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const hit = deps.dScene.selectElementAtMouse(mx, my, rect.width, rect.height, props.project, props.customEditorCamera, !!props.selectionMode);
    if (hit && hit.type) {
      deps.emit('selectElement', hit.id, hit.type);
      deps.showHudToast(`已选中组内成员：${getObjectName(hit.id, props.project)}`, 'success');
      if (hit.type === 'mannequin' && hit.jointName) {
        deps.emit('changeSelectedJointKey', hit.jointName as keyof MannequinJoints);
      }
      if (props.selectionMode) deps.emit('exitSelectionMode');
    }
  };

  let isPointerDragging = false;
  let startX = 0, startY = 0;
  let startCameraPos = { x: 0, y: 0, z: 0 };
  let startCameraTgt = { x: 0, y: 0, z: 0 };
  let dragType: 'orbit' | 'pan' = 'orbit';

  const onPointerDown = (e: PointerEvent) => {
    const props = deps.getProps();
    if (props.customEditorCamera) return;
    const activeCamId = props.project.activeCameraId;
    const activeCam = props.project.cameras.find(c => c.id === activeCamId);
    if (!activeCam || activeCam.locked) return;

    isPointerDragging = true;
    startX = e.clientX; startY = e.clientY;
    startCameraPos = { ...activeCam.position };
    startCameraTgt = { ...activeCam.target };
    dragType = (e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'orbit';
    if (deps.canvasRef) deps.canvasRef.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const props = deps.getProps();
    if (!isPointerDragging || props.customEditorCamera) return;
    const activeCamId = props.project.activeCameraId;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const P = new THREE.Vector3(startCameraPos.x, startCameraPos.y, startCameraPos.z);
    const T = new THREE.Vector3(startCameraTgt.x, startCameraTgt.y, startCameraTgt.z);

    let nextPos: { x: number; y: number; z: number };
    let nextTgt: { x: number; y: number; z: number } = { x: T.x, y: T.y, z: T.z };

    if (dragType === 'pan') {
      const forward = new THREE.Vector3().subVectors(T, P).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      const dist = P.distanceTo(T);
      const factor = dist * 0.0015;
      const panVec = new THREE.Vector3().addScaledVector(right, -deltaX * factor).addScaledVector(up, deltaY * factor);
      const nextP = P.clone().add(panVec);
      const nextT = T.clone().add(panVec);
      nextPos = { x: Number(nextP.x.toFixed(4)), y: Number(nextP.y.toFixed(4)), z: Number(nextP.z.toFixed(4)) };
      nextTgt = { x: Number(nextT.x.toFixed(4)), y: Number(nextT.y.toFixed(4)), z: Number(nextT.z.toFixed(4)) };
    } else {
      const offset = new THREE.Vector3().subVectors(P, T);
      const r = offset.length();
      let theta = Math.atan2(offset.x, offset.z);
      let phi = Math.acos(Math.max(-0.999, Math.min(0.999, offset.y / r)));
      theta -= deltaX * 0.005;
      phi -= deltaY * 0.005;
      phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));
      offset.x = r * Math.sin(phi) * Math.sin(theta);
      offset.y = r * Math.cos(phi);
      offset.z = r * Math.sin(phi) * Math.cos(theta);
      const nextP = T.clone().add(offset);
      nextPos = { x: Number(nextP.x.toFixed(4)), y: Number(nextP.y.toFixed(4)), z: Number(nextP.z.toFixed(4)) };
    }

    deps.emit('updateProject' as any, { ...props.project, cameras: props.project.cameras.map(c => c.id === activeCamId ? { ...c, position: nextPos, target: nextTgt } : c) } as any);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDragging) return;
    isPointerDragging = false;
    if (deps.canvasRef) deps.canvasRef.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: WheelEvent) => {
    const props = deps.getProps();
    if (props.customEditorCamera) return;
    const activeCamId = props.project.activeCameraId;
    const activeCam = props.project.cameras.find(c => c.id === activeCamId);
    if (!activeCam || activeCam.locked) return;
    e.preventDefault();

    const P = new THREE.Vector3(activeCam.position.x, activeCam.position.y, activeCam.position.z);
    const T = new THREE.Vector3(activeCam.target.x, activeCam.target.y, activeCam.target.z);
    const dir = new THREE.Vector3().subVectors(T, P);
    const dist = dir.length();
    const nextDist = Math.max(0.2, dist + e.deltaY * 0.0015 * dist);
    const nextP = T.clone().add(dir.normalize().multiplyScalar(-nextDist));
    const nextPos = { x: Number(nextP.x.toFixed(4)), y: Number(nextP.y.toFixed(4)), z: Number(nextP.z.toFixed(4)) };

    deps.emit('updateProject' as any, { ...props.project, cameras: props.project.cameras.map(c => c.id === activeCamId ? { ...c, position: nextPos } : c) } as any);
  };

  const handleCanvasMouseDown = (e: MouseEvent) => {
    canvasMouseDownPos.x = e.clientX;
    canvasMouseDownPos.y = e.clientY;
    canvasMouseDownTime = Date.now();
  };

  const onContextMenu = (e: MouseEvent) => {
    if (!deps.getProps().customEditorCamera) e.preventDefault();
  };

  const mount = (canvas: HTMLCanvasElement) => {
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('dblclick', onCanvasDblClick);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
  };

  const unmount = (canvas: HTMLCanvasElement) => {
    canvas.removeEventListener('mousedown', handleCanvasMouseDown);
    canvas.removeEventListener('click', onCanvasClick);
    canvas.removeEventListener('dblclick', onCanvasDblClick);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };

  return { mount, unmount };
}
