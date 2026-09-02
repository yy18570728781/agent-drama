import * as THREE from 'three';
import type { DirectingProject, CameraConfig } from '@/components/director-3d/director3D.types';

function mapToneMappingConstant(name: string): THREE.ToneMapping {
  switch (name) {
    case 'Linear': return THREE.LinearToneMapping;
    case 'Reinhard': return THREE.ReinhardToneMapping;
    case 'Cineon': return THREE.CineonToneMapping;
    case 'AgX': return THREE.AgXToneMapping;
    default: return THREE.ACESFilmicToneMapping;
  }
}

export interface CameraSyncDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  editorCamera: THREE.Camera;
  controls: { object: THREE.Object3D };
  cameraVisuals: Map<string, THREE.Group>;
  transformControls: { dragging: boolean; object?: THREE.Object3D } | null;
}

export function syncCameras(
  project: DirectingProject,
  selectedElementId: string | null,
  customEditorCamera: boolean,
  deps: CameraSyncDeps,
): void {
  if (!deps.scene) return;

  project.cameras.forEach((camObj) => {
    const isViewingThis = !customEditorCamera && project.activeCameraId === camObj.id;

    if (project.viewMode === '3D' && !isViewingThis && camObj.visible) {
      let camGroup = deps.cameraVisuals.get(camObj.id);
      if (!camGroup) {
        camGroup = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.5, metalness: 0.3 });
        const techMat = new THREE.MeshStandardMaterial({ color: '#14171d', roughness: 0.8, metalness: 0.1 });
        const glassMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.1, metalness: 0.8 });
        const metalMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', roughness: 0.3, metalness: 0.6 });

        const boxGeo = new THREE.BoxGeometry(0.3, 0.22, 0.45);
        const box = new THREE.Mesh(boxGeo, bodyMat);
        camGroup.add(box);

        const cylGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.15, 12);
        cylGeo.rotateX(Math.PI / 2);
        const cyl = new THREE.Mesh(cylGeo, glassMat);
        cyl.position.z = 0.26;
        camGroup.add(cyl);

        const matteBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), techMat);
        matteBox.position.set(0, 0, 0.36);
        camGroup.add(matteBox);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.35), techMat);
        handle.position.set(0, 0.13, -0.05);
        camGroup.add(handle);

        const reelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16);
        reelGeo.rotateZ(Math.PI / 2);

        const reel1 = new THREE.Mesh(reelGeo, metalMat);
        reel1.position.set(0, 0.22, -0.08);
        camGroup.add(reel1);

        const reel2 = new THREE.Mesh(reelGeo, metalMat);
        reel2.position.set(0, 0.22, 0.1);
        camGroup.add(reel2);

        const vf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.18), techMat);
        vf.position.set(0.17, 0.04, -0.1);
        camGroup.add(vf);

        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.15), new THREE.MeshBasicMaterial({ color: '#17c0eb' }));
        screen.position.set(0.191, 0.04, -0.1);
        camGroup.add(screen);

        const vertices = [
          0, 0, 0,  -0.8, 0.45, 1.8,
          0, 0, 0,   0.8, 0.45, 1.8,
          0, 0, 0,   0.8, -0.45, 1.8,
          0, 0, 0,  -0.8, -0.45, 1.8,
          -0.8, 0.45, 1.8,   0.8, 0.45, 1.8,
           0.8, 0.45, 1.8,   0.8, -0.45, 1.8,
           0.8, -0.45, 1.8, -0.8, -0.45, 1.8,
          -0.8, -0.45, 1.8, -0.8, 0.45, 1.8
        ];

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const lineMat = new THREE.LineDashedMaterial({
          color: '#ffa502',
          dashSize: 0.08,
          gapSize: 0.04,
          transparent: true,
          opacity: 0.65
        });

        const frustumLines = new THREE.LineSegments(lineGeo, lineMat);
        frustumLines.computeLineDistances();
        camGroup.add(frustumLines);

        camGroup.userData = { id: camObj.id, type: 'camera' };
        deps.cameraVisuals.set(camObj.id, camGroup);
      }

      let lookAtTarget = camObj.target;
      if (camObj.lookAtTargetId) {
        const targetMannequin = project.mannequins.find(m => m.id === camObj.lookAtTargetId);
        if (targetMannequin) {
          lookAtTarget = {
            x: targetMannequin.position.x,
            y: targetMannequin.position.y + 1.25,
            z: targetMannequin.position.z
          };
        }
      }

      const isDraggingThis = deps.transformControls?.dragging && deps.transformControls.object === camGroup;
      if (!isDraggingThis) {
        camGroup.position.set(camObj.position.x, camObj.position.y, camObj.position.z);
        camGroup.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
      }

      const isSelected = selectedElementId === camObj.id;
      const boxMesh = camGroup.children[0] as THREE.Mesh;
      if (boxMesh && boxMesh.material instanceof THREE.MeshStandardMaterial) {
        boxMesh.material.color.set(isSelected ? '#3ae374' : (project.activeCameraId === camObj.id ? '#17c0eb' : '#2c3e50'));
      }

      deps.scene.add(camGroup);
    } else {
      const camGroup = deps.cameraVisuals.get(camObj.id);
      if (camGroup) {
        deps.scene.remove(camGroup);
      }
    }
  });

  const activeCam = project.cameras.find(c => c.id === project.activeCameraId);
  if (activeCam && deps.renderer) {
    deps.renderer.toneMappingExposure = activeCam.exposure ?? 1.0;
    deps.renderer.toneMapping = mapToneMappingConstant(activeCam.toneMapping ?? 'ACESFilmic');
  }

  deps.cameraVisuals.forEach((group, id) => {
    if (!project.cameras.some(c => c.id === id)) {
      deps.scene.remove(group);
      deps.cameraVisuals.delete(id);
    }
  });

  syncEditorCamera(activeCam, customEditorCamera, deps);
}

function syncEditorCamera(
  activeCam: CameraConfig | undefined,
  customEditorCamera: boolean,
  deps: CameraSyncDeps,
): void {
  if (!activeCam) {
    if (customEditorCamera && !(deps.editorCamera instanceof THREE.PerspectiveCamera)) {
      const aspect = deps.renderer.domElement.clientWidth / deps.renderer.domElement.clientHeight;
      const persp = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
      persp.position.copy(deps.editorCamera.position);
      deps.editorCamera = persp;
      deps.controls.object = persp;
      persp.updateProjectionMatrix();
    }
    return;
  }

  if (customEditorCamera) {
    if (!(deps.editorCamera instanceof THREE.PerspectiveCamera)) {
      const aspect = deps.renderer.domElement.clientWidth / deps.renderer.domElement.clientHeight;
      const persp = new THREE.PerspectiveCamera(50, aspect, 0.1, 5000);
      persp.position.copy(deps.editorCamera.position);
      deps.editorCamera = persp;
      deps.controls.object = persp;
      persp.updateProjectionMatrix();
    }
    return;
  }

  const camObj = activeCam;
  const targetNear = Math.max(0.001, camObj.near ?? 0.1);
  const targetFar = camObj.far ?? 5000;
  const aspect = (deps.editorCamera instanceof THREE.PerspectiveCamera) ? deps.editorCamera.aspect : (deps.renderer.domElement.clientWidth / deps.renderer.domElement.clientHeight);

  if (camObj.cameraType === 'orthographic') {
    const size = camObj.orthoSize ?? 5;
    if (!(deps.editorCamera instanceof THREE.OrthographicCamera)) {
      const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, targetNear, targetFar);
      ortho.position.copy(deps.editorCamera.position);
      deps.editorCamera = ortho;
      deps.controls.object = ortho;
    }
    const halfH = size;
    const halfW = size * aspect;
    (deps.editorCamera as THREE.OrthographicCamera).left = -halfW;
    (deps.editorCamera as THREE.OrthographicCamera).right = halfW;
    (deps.editorCamera as THREE.OrthographicCamera).top = halfH;
    (deps.editorCamera as THREE.OrthographicCamera).bottom = -halfH;
    (deps.editorCamera as THREE.OrthographicCamera).near = targetNear;
    (deps.editorCamera as THREE.OrthographicCamera).far = targetFar;
  } else {
    if (!(deps.editorCamera instanceof THREE.PerspectiveCamera)) {
      const persp = new THREE.PerspectiveCamera(camObj.fov, aspect, targetNear, targetFar);
      persp.position.copy(deps.editorCamera.position);
      deps.editorCamera = persp;
      deps.controls.object = persp;
    }
    (deps.editorCamera as THREE.PerspectiveCamera).fov = camObj.fov;
    (deps.editorCamera as THREE.PerspectiveCamera).near = targetNear;
    (deps.editorCamera as THREE.PerspectiveCamera).far = targetFar;
    if (camObj.focalLength) {
      (deps.editorCamera as THREE.PerspectiveCamera).setFocalLength(camObj.focalLength);
    }
  }
  (deps.editorCamera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix();
}
