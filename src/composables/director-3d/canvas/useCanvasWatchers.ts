import { watch } from 'vue';
import type { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';

export interface WatcherDeps {
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
    (e: 'exportDone', dataUrl: string): void;
  };
}

export function useCanvasWatchers(deps: WatcherDeps) {
  watch(() => deps.getProps().project.cameras, () => {
    const p = deps.getProps();
    deps.dScene.syncCameras(p.project, p.selectedElementId, p.customEditorCamera);
  }, { deep: true });

  watch(() => deps.getProps().project.lights, () => {
    deps.dScene.syncLights(deps.getProps().project);
  }, { deep: true });

  watch(() => deps.getProps().project.imagePlanes, () => {
    deps.dScene.syncImagePlanes(deps.getProps().project);
  }, { deep: true });

  watch(() => deps.getProps().project.mannequins, () => {
    const p = deps.getProps();
    deps.dScene.syncMannequins(p.project, p.selectedElementId, p.selectedElementType, p.selectedJointKey, !!p.hideHelpers);
  }, { deep: true });

  watch(() => deps.getProps().project.ground, () => {
    deps.dScene.syncGround(deps.getProps().project);
  }, { deep: true });

  watch([
    () => deps.getProps().selectedElementId,
    () => deps.getProps().selectedElementType,
    () => deps.getProps().selectedJointKey,
    () => deps.getProps().hideHelpers,
    () => deps.getProps().customEditorCamera,
    () => deps.getProps().selectionMode
  ], () => {
    const p = deps.getProps();
    deps.dScene.syncMannequins(p.project, p.selectedElementId, p.selectedElementType, p.selectedJointKey, !!p.hideHelpers);
    deps.dScene.syncTransformGizmoAttachment(
      p.project, p.selectedElementId, p.selectedElementType, p.selectedJointKey, !!p.hideHelpers, p.customEditorCamera
    );
    deps.dScene.setGizmosAndHelpersVisible(!p.hideHelpers && p.customEditorCamera && p.project.viewMode === '3D', p.project, p.customEditorCamera, false, !!p.selectionMode);
  });

  watch([() => deps.getProps().project.showGrid, () => deps.getProps().project.viewMode], () => {
    const p = deps.getProps();
    if (deps.dScene.gridHelper) {
      deps.dScene.gridHelper.visible = p.project.showGrid && p.project.viewMode === '3D';
    }
  });

  watch(() => deps.getProps().exportTrigger, async (newVal) => {
    if (newVal > 0) {
      const dataUrl = await deps.dScene.generateSnapshot(deps.getProps().project);
      if (dataUrl) {
        deps.emit('exportDone', dataUrl);
      }
    }
  });
}
