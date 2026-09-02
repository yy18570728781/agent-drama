import * as THREE from 'three';
import { type DirectingProject, type CameraConfig } from '@/components/director-3d/director3D.types';

export interface SnapshotDeps {
  scene: THREE.Scene;
  imagePlaneMeshes: Map<string, THREE.Mesh>;
  textureCache: Map<string, THREE.Texture>;
  groundGroup: THREE.Group | null;
  setGizmosAndHelpersVisible: (
    helpersVisible: boolean,
    project: DirectingProject,
    customEditorCamera: boolean,
    forSnapshotOrPip: boolean,
    selectionMode?: boolean,
  ) => void;
  buildSceneCamera: (camObj: CameraConfig, aspect: number) => THREE.Camera;
  parseAspectRatio: (ratio: string | undefined) => number;
}

async function replaceTexturesWithBlobUrls(
  imagePlaneMeshes: Map<string, THREE.Mesh>,
): Promise<Array<{ mesh: THREE.Mesh; origSrc: string }>> {
  const replaced: Array<{ mesh: THREE.Mesh; origSrc: string }> = [];
  for (const [, mesh] of imagePlaneMeshes) {
    const mat = mesh.material;
    if (!(mat instanceof THREE.MeshBasicMaterial) || !mat.map) continue;
    const tex = mat.map;
    const src = (tex.image as HTMLImageElement)?.src;
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) continue;
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
      img.src = blobUrl;
      const newTex = new THREE.Texture(img);
      newTex.needsUpdate = true;
      if ('colorSpace' in newTex) newTex.colorSpace = THREE.SRGBColorSpace;
      mat.map = newTex;
      mat.needsUpdate = true;
      replaced.push({ mesh, origSrc: src });
    } catch { continue; }
  }
  return replaced;
}

function restoreTextures(
  replaced: Array<{ mesh: THREE.Mesh; origSrc: string }>,
  textureCache: Map<string, THREE.Texture>,
): void {
  for (const { mesh, origSrc } of replaced) {
    const mat = mesh.material;
    if (!(mat instanceof THREE.MeshBasicMaterial)) continue;
    const cached = textureCache.get(origSrc);
    if (cached) {
      mat.map = cached;
      mat.needsUpdate = true;
    }
  }
}

export async function generateSnapshot(
  project: DirectingProject,
  deps: SnapshotDeps,
): Promise<string | null> {
  if (!deps.scene) return null;

  const activeCameraObj = project.cameras.find(c => c.id === project.activeCameraId);
  if (!activeCameraObj) return null;

  const aspectRatio = deps.parseAspectRatio(project.aspectRatio);
  const snapshotW = 1920;
  const snapshotH = Math.round(snapshotW / aspectRatio);

  const offscreen = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  offscreen.setSize(snapshotW, snapshotH, false);
  offscreen.outputColorSpace = THREE.SRGBColorSpace;
  offscreen.shadowMap.enabled = true;
  offscreen.shadowMap.type = THREE.PCFShadowMap;

  const snapshotCamera = deps.buildSceneCamera(activeCameraObj, aspectRatio);

  const groundWasVisible = deps.groundGroup?.visible;
  if (deps.groundGroup && project.groundVisible === false) deps.groundGroup.visible = false;

  deps.setGizmosAndHelpersVisible(false, project, false, true);

  offscreen.render(deps.scene, snapshotCamera);

  let localDataUrl = '';
  try {
    localDataUrl = offscreen.domElement.toDataURL('image/png') || '';
  } catch {}

  offscreen.dispose();
  offscreen.forceContextLoss();

  const helperVisibleMode = !project.hideHelpers && project.viewMode === '3D';
  deps.setGizmosAndHelpersVisible(helperVisibleMode, project, true, false);

  if (deps.groundGroup && groundWasVisible !== undefined) {
    deps.groundGroup.visible = groundWasVisible;
  }

  let uploadedUrl: string | null = null;
  if (localDataUrl) {
    try {
      const res = await fetch(localDataUrl);
      const blob = await res.blob();
      const { uploadFileToCosUrl } = await import('@/api/uploadHelpers');
      uploadedUrl = await uploadFileToCosUrl(blob, `director_snapshot_${Date.now()}.png`);
    } catch (err) {
      console.warn('Snapshot upload failed:', err);
    }
  }

  return uploadedUrl || localDataUrl || null;
}

export function generateThumbnail(
  project: DirectingProject,
  deps: SnapshotDeps,
): string {
  if (!deps.scene) return '';

  const activeCameraObj = project.cameras.find(c => c.id === project.activeCameraId);
  if (!activeCameraObj) return '';

  const thumbW = 320;
  const thumbH = 180;
  const aspectRatio = deps.parseAspectRatio(project.aspectRatio);

  const offscreen = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  offscreen.setSize(thumbW, thumbH, false);
  offscreen.outputColorSpace = THREE.SRGBColorSpace;

  const cam = deps.buildSceneCamera(activeCameraObj, aspectRatio);

  const groundWasVisible = deps.groundGroup?.visible;
  if (deps.groundGroup && project.groundVisible === false) deps.groundGroup.visible = false;

  deps.setGizmosAndHelpersVisible(false, project, false, true);
  offscreen.render(deps.scene, cam);

  let dataUrl = '';
  try {
    dataUrl = offscreen.domElement.toDataURL('image/jpeg', 0.7) || '';
  } catch {}

  offscreen.dispose();
  offscreen.forceContextLoss();

  const helperVisibleMode = !project.hideHelpers && project.viewMode === '3D';
  deps.setGizmosAndHelpersVisible(helperVisibleMode, project, true, false);
  if (deps.groundGroup && groundWasVisible !== undefined) {
    deps.groundGroup.visible = groundWasVisible;
  }

  return dataUrl;
}
