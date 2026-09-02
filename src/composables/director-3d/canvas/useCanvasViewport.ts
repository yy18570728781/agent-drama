import { ref } from 'vue';
import * as THREE from 'three';
import type { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';
import { safeJsonStringify } from '@/utils/director3DSerialization';
import type { ShowHudToastFn } from './useCanvasHudToast';

interface ViewportData {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export interface ViewportDeps {
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
    (e: 'changeCustomEditorCamera', val: boolean): void;
  };
  showHudToast: ShowHudToastFn;
}

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

export function useCanvasViewport(deps: ViewportDeps) {
  const viewportSlots = ref<Record<string, ViewportData>>({});

  const focusOnSelectedElement = () => {
    const props = deps.getProps();
    const selId = props.selectedElementId;
    const selType = props.selectedElementType;
    if (!selId || !selType) return;

    const targetPos = new THREE.Vector3();
    let focusRadius = 3.0;

    if (selType === 'group') {
      if (deps.dScene.groupGizmo) {
        targetPos.copy(deps.dScene.groupGizmo.position);
        focusRadius = 5.0;
      } else {
        const gm = props.project.mannequins.filter(m => m.groupId === selId);
        if (gm.length > 0) {
          let sx = 0, sy = 0, sz = 0;
          gm.forEach(m => { sx += m.position.x; sy += m.position.y; sz += m.position.z; });
          targetPos.set(sx / gm.length, sy / gm.length + 0.85, sz / gm.length);
          focusRadius = 5.0;
        }
      }
    } else if (selType === 'mannequin') {
      const mGroup = deps.dScene.mannequinMeshes.get(selId);
      if (mGroup) { mGroup.getWorldPosition(targetPos); targetPos.y += 0.85; focusRadius = 2.5; }
    } else if (selType === 'camera') {
      const cg = deps.dScene.cameraVisuals.get(selId);
      if (cg) { cg.getWorldPosition(targetPos); focusRadius = 3.5; }
    } else if (selType === 'image') {
      const im = deps.dScene.imagePlaneMeshes.get(selId);
      if (im) { im.getWorldPosition(targetPos); focusRadius = Math.max(im.scale.x, im.scale.y, 2.0); }
    } else if (selType === 'light') {
      const lg = deps.dScene.lightVisuals.get(selId);
      if (lg) { lg.getWorldPosition(targetPos); focusRadius = 2.5; }
    } else if (selType === 'ground') {
      if (deps.dScene.groundGroup) { deps.dScene.groundGroup.getWorldPosition(targetPos); focusRadius = 10.0; }
    }

    if (deps.dScene.editorCamera && deps.dScene.controls) {
      deps.emit('changeCustomEditorCamera', true);
      const offset = new THREE.Vector3().subVectors(deps.dScene.editorCamera.position, deps.dScene.controls.target);
      if (offset.lengthSq() === 0) offset.set(0, 0.5, 1);
      offset.normalize().multiplyScalar(focusRadius * 1.5);
      const nextCamPos = new THREE.Vector3().addVectors(targetPos, offset);

      const animDuration = 400;
      const startCamPos = deps.dScene.editorCamera.position.clone();
      const startTarget = deps.dScene.controls.target.clone();
      let animStartTime: number | null = null;

      const animFocus = (timestamp: number) => {
        if (!animStartTime) animStartTime = timestamp;
        const elapsed = timestamp - animStartTime;
        const progress = Math.min(elapsed / animDuration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        if (deps.dScene.editorCamera && deps.dScene.controls) {
          deps.dScene.editorCamera.position.lerpVectors(startCamPos, nextCamPos, ease);
          deps.dScene.controls.target.lerpVectors(startTarget, targetPos, ease);
          deps.dScene.controls.update();
        }

        if (progress < 1) {
          requestAnimationFrame(animFocus);
        } else {
          deps.showHudToast(`镜头已聚焦于: [${getObjectName(selId, props.project)}]`, 'success');
        }
      };
      requestAnimationFrame(animFocus);
    }
  };

  const saveViewport = (slotKey: string) => {
    if (!deps.dScene.editorCamera || !deps.dScene.controls) return;
    const pos = deps.dScene.editorCamera.position.clone();
    const tar = deps.dScene.controls.target.clone();
    try {
      const savedRaw = localStorage.getItem('director_viewport_slots');
      const parsed = savedRaw ? JSON.parse(savedRaw) : {};
      parsed[slotKey] = { position: { x: pos.x, y: pos.y, z: pos.z }, target: { x: tar.x, y: tar.y, z: tar.z } };
      localStorage.setItem('director_viewport_slots', safeJsonStringify(parsed));
      viewportSlots.value[slotKey] = { position: { x: pos.x, y: pos.y, z: pos.z }, target: { x: tar.x, y: tar.y, z: tar.z } };
      deps.showHudToast(`已成功保存当前视口记忆至：槽位 ${slotKey}`, 'success');
    } catch (err) {
      console.error('Failed to save viewport memory', err);
      deps.showHudToast(`保存视口失败`, 'error');
    }
  };

  const loadViewport = (slotKey: string) => {
    try {
      const savedRaw = localStorage.getItem('director_viewport_slots');
      const parsed = savedRaw ? JSON.parse(savedRaw) : {};
      const slot = parsed[slotKey];
      if (slot && deps.dScene.editorCamera && deps.dScene.controls) {
        deps.emit('changeCustomEditorCamera', true);
        deps.dScene.editorCamera.position.set(slot.position.x, slot.position.y, slot.position.z);
        deps.dScene.controls.target.set(slot.target.x, slot.target.y, slot.target.z);
        deps.dScene.controls.update();
        deps.showHudToast(`镜头已快速切位至 3D 自由视角 [槽位 ${slotKey}]`, 'success');
      } else if (!slot) {
        deps.showHudToast(`槽位 ${slotKey} 尚空。请调整视角后按 [Ctrl + ${slotKey}] 保存视角记忆`, 'info');
      }
    } catch (err) {
      console.error('Failed to load viewport slots', err);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) return;
    const key = e.key;
    if (key.toLowerCase() === 'f') { e.preventDefault(); focusOnSelectedElement(); }
    else if (['1', '2', '3', '4'].includes(key)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveViewport(key); }
      else if (!e.shiftKey && !e.altKey) { loadViewport(key); }
    }
  };

  const mount = () => {
    try { const saved = localStorage.getItem('director_viewport_slots'); if (saved) viewportSlots.value = JSON.parse(saved); } catch (e) { console.error('Error loading viewport slots', e); }
    window.addEventListener('keydown', handleKeyDown);
  };
  const unmount = () => { window.removeEventListener('keydown', handleKeyDown); };

  return { viewportSlots, focusOnSelectedElement, saveViewport, loadViewport, mount, unmount };
}
