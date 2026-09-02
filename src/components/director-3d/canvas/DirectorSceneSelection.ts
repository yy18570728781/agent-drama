import * as THREE from 'three';
import type { DirectingProject, CameraConfig } from '@/components/director-3d/director3D.types';

export interface SelectionDeps {
  editorCamera: THREE.Camera;
  scene: THREE.Scene;
  mannequinMeshes: Map<string, THREE.Group>;
  imagePlaneMeshes: Map<string, THREE.Mesh>;
  cameraVisuals: Map<string, THREE.Group>;
  lightVisuals: Map<string, THREE.Group>;
  groundGroup: THREE.Group | null;
  buildSceneCamera: (camObj: CameraConfig, aspect: number) => THREE.Camera;
}

export function selectElementAtMouse(
  mouseX: number,
  mouseY: number,
  canvasWidth: number,
  canvasHeight: number,
  project: DirectingProject,
  customEditorCamera: boolean,
  selectionMode: boolean,
  deps: SelectionDeps,
): { id: string; type: any; jointName?: string } | null {
  if (!deps.editorCamera || !deps.scene) return null;

  const mouse = new THREE.Vector2(mouseX, mouseY);
  const raycaster = new THREE.Raycaster();

  const activeCamId = project.activeCameraId;
  const activeCam = project.cameras.find(c => c.id === activeCamId);

  let raycastCam: THREE.Camera = deps.editorCamera;
  if (!customEditorCamera && activeCam) {
    const tempCam = deps.buildSceneCamera(activeCam, canvasWidth / canvasHeight);
    tempCam.position.set(activeCam.position.x, activeCam.position.y, activeCam.position.z);
    tempCam.lookAt(activeCam.target.x, activeCam.target.y, activeCam.target.z);
    tempCam.updateMatrixWorld();
    raycastCam = tempCam;
  }

  raycaster.setFromCamera(mouse, raycastCam);
  (raycaster as any).params = { Line: { threshold: 0.08 } };

  const selectablesList: THREE.Object3D[] = [];
  deps.mannequinMeshes.forEach(group => {
    if (group.visible) selectablesList.push(group);
  });
  deps.imagePlaneMeshes.forEach(mesh => {
    if (mesh.visible) selectablesList.push(mesh);
  });
  deps.cameraVisuals.forEach(group => {
    if (group.visible) selectablesList.push(group);
  });
  deps.lightVisuals.forEach(group => {
    if (group.visible) selectablesList.push(group);
  });
  if (deps.groundGroup && project.showGrid && project.groundVisible !== false) {
    selectablesList.push(deps.groundGroup);
  }

  const intersects = raycaster.intersectObjects(selectablesList, true);
  if (intersects.length > 0) {
    let primaryHit = intersects[0];

    const hitFootRing = intersects.find(hit => hit.object.userData?.isFootRing);
    if (hitFootRing) {
      let topObj: THREE.Object3D | null = hitFootRing.object;
      while (topObj && !topObj.userData.id) topObj = topObj.parent;
      if (topObj && topObj.userData) {
        return { id: topObj.userData.id, type: topObj.userData.type };
      }
    }

    const hitRigController = intersects.find(hit => {
      let parent: THREE.Object3D | null = hit.object;
      while (parent) {
        if (parent.userData?.isRigController) return true;
        parent = parent.parent;
      }
      return false;
    });
    if (hitRigController) {
      primaryHit = hitRigController;
    }

    const jointsList = [
      'head', 'chest', 'pelvis', 'leftShoulder', 'leftElbow', 'leftWrist', 
      'leftHip', 'leftKnee', 'leftAnkle', 'rightShoulder', 'rightElbow', 
      'rightWrist', 'rightHip', 'rightKnee', 'rightAnkle'
    ];
    if (!selectionMode) {
      const foundJointHit = intersects.find(hit => {
        let parent: THREE.Object3D | null = hit.object;
        while (parent) {
          if (parent.userData?.isJoint || (parent.name && jointsList.includes(parent.name)) || (parent.name && parent.name.endsWith('_helper'))) {
            return true;
          }
          parent = parent.parent;
        }
        return false;
      });
      if (foundJointHit) {
        primaryHit = foundJointHit;
      }
    }

    let jointGroup: THREE.Object3D | null = primaryHit.object;
    while (jointGroup) {
      if (jointGroup.userData?.type === 'mannequin') break;
      if (jointGroup.name && jointsList.includes(jointGroup.name)) break;
      if (jointGroup.userData?.isRigController && jointGroup.userData.jointName) {
        const rigJointNode = jointGroup.parent;
        if (rigJointNode && rigJointNode.name) {
          jointGroup = rigJointNode;
          break;
        }
      }
      jointGroup = jointGroup.parent;
    }

    let topLevelObj: THREE.Object3D | null = primaryHit.object;
    while (topLevelObj && !topLevelObj.userData.id) {
      topLevelObj = topLevelObj.parent;
    }

    if (topLevelObj && topLevelObj.userData) {
      const id = topLevelObj.userData.id;
      const type = topLevelObj.userData.type;
      const jName = (type === 'mannequin' && jointGroup && jointGroup.name && jointGroup !== topLevelObj)
        ? jointGroup.name
        : undefined;
      return { id, type, jointName: jName };
    }
  }
  return null;
}
