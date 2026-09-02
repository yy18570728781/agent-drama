import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { DirectingProject, MannequinObject, JointRotation, MannequinJoints } from '@/components/director-3d/director3D.types';
import { getGLBFromDB } from '@/utils/director3DGlbStorage';
import { processAndAddGlbScene, getDummyWorldQuaternion } from '@/utils/director3DSkeletalMapper';
import { createProceduralMannequin } from '@/utils/director3DMannequinFactory';
import { RigControllerManager } from './RigControllerManager';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export interface MannequinSyncDeps {
  scene: THREE.Scene;
  mannequinMeshes: Map<string, THREE.Group>;
  transformControls: { dragging: boolean; object?: THREE.Object3D; detach(): void } | null;
  loadedGlbTemplates: Map<string, any>;
  loadingUrls: Set<string>;
  glbLoadedCounter: { value: number };
  rigControllerManager: RigControllerManager;
  detachFn: (obj: THREE.Object3D) => void;
  onGlbLoaded?: () => void;
}

export function getRetargetDiffQ(item: THREE.Object3D, groupName: string): THREE.Quaternion {
  let diffQ = item.userData.retargetDiffQ;
  if (!diffQ) {
    const bindWorldQ = item.userData.bindWorldQuaternion;
    if (bindWorldQ) {
      const dummyWorldQ = getDummyWorldQuaternion(groupName);
      diffQ = bindWorldQ.clone().invert().multiply(dummyWorldQ);
      item.userData.retargetDiffQ = diffQ;
    } else {
      diffQ = new THREE.Quaternion();
    }
  }
  return diffQ;
}

function applyRot(
  mannequinObj: MannequinObject,
  parent: THREE.Object3D,
  groupName: string,
  rot: JointRotation | undefined,
  transformControls: MannequinSyncDeps['transformControls'],
): void {
  const item = parent.name === groupName ? parent : parent.getObjectByName(groupName);
  if (item && rot) {
    const isDraggingJoint = transformControls?.dragging && transformControls.object === item;
    if (!isDraggingJoint) {
      const rx = rot.x ?? 0;
      const ry = rot.y ?? 0;
      let rz = rot.z ?? 0;

      let bindQ = item.userData.bindQuaternion;
      if (!bindQ) {
        bindQ = item.quaternion.clone();
        item.userData.bindQuaternion = bindQ;
      }

      const isGlb = mannequinObj.style === 'glb';
      if (isGlb) {
        if (groupName === 'leftShoulder') {
          rz = rz + 35;
        } else if (groupName === 'rightShoulder') {
          rz = rz - 35;
        }
      }

      const dummyEuler = new THREE.Euler(deg2rad(rx), deg2rad(ry), deg2rad(rz), 'XYZ');
      const q_dummy = new THREE.Quaternion().setFromEuler(dummyEuler);

      if (isGlb) {
        const diffQ = getRetargetDiffQ(item, groupName);
        const theta_glb = diffQ.clone().multiply(q_dummy).multiply(diffQ.clone().invert());
        item.quaternion.copy(bindQ).multiply(theta_glb);
      } else {
        item.quaternion.copy(bindQ).multiply(q_dummy);
      }

      let initPos = item.userData.initPosition;
      if (!initPos) {
        initPos = item.position.clone();
        item.userData.initPosition = initPos;
      }
      if (mannequinObj.jointTranslations && mannequinObj.jointTranslations[groupName]) {
        const offset = mannequinObj.jointTranslations[groupName];
        item.position.set(initPos.x + offset.x, initPos.y + offset.y, initPos.z + offset.z);
      } else {
        item.position.copy(initPos);
      }

      if (mannequinObj.jointScales && mannequinObj.jointScales[groupName]) {
        const sc = mannequinObj.jointScales[groupName];
        item.scale.set(sc.x, sc.y, sc.z);
      } else {
        item.scale.set(1, 1, 1);
      }
    }
  }
}

function replaceGlbPlaceholders(glbKey: string, gltf: any, mannequinMeshes: Map<string, THREE.Group>): void {
  mannequinMeshes.forEach((mainGroup) => {
    if (mainGroup.userData.style !== 'glb') return;
    const placeholder = mainGroup.getObjectByName('glb_placeholder');
    if (!placeholder) return;
    const cachedGlbKey = mainGroup.userData.glbKey;
    if (cachedGlbKey !== glbKey) return;
    mainGroup.remove(placeholder);
    const clonedScene = SkeletonUtils.clone(gltf.scene);
    processAndAddGlbScene(clonedScene, mainGroup);
  });
}

function ensureFootRing(
  mainGroup: THREE.Group,
  isSelected: boolean,
  mannequinObj: MannequinObject,
  selectedElementId: string | null,
  selectedElementType: string | null,
): void {
  let ringContainer = mainGroup.getObjectByName('global_controller_ring_container') as THREE.Group;
  if (!ringContainer) {
    ringContainer = new THREE.Group();
    ringContainer.name = 'global_controller_ring_container';
    ringContainer.position.set(0, 0.012, 0);

    const outerGeo = new THREE.RingGeometry(0.44, 0.47, 32);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.name = 'outer';
    ringContainer.add(outerMesh);

    const innerGeo = new THREE.RingGeometry(0.36, 0.38, 32);
    innerGeo.rotateX(-Math.PI / 2);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.name = 'inner';
    ringContainer.add(innerMesh);

    const tickGeo = new THREE.BoxGeometry(0.015, 0.005, 0.08);
    const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

    const frontTick = new THREE.Mesh(tickGeo, tickMat);
    frontTick.position.set(0, 0, 0.42); frontTick.name = 'tick_f';
    ringContainer.add(frontTick);

    const backTick = new THREE.Mesh(tickGeo, tickMat);
    backTick.position.set(0, 0, -0.42); backTick.name = 'tick_b';
    ringContainer.add(backTick);

    const leftTick = new THREE.Mesh(tickGeo, tickMat);
    leftTick.rotation.y = Math.PI / 2; leftTick.position.set(0.42, 0, 0); leftTick.name = 'tick_l';
    ringContainer.add(leftTick);

    const rightTick = new THREE.Mesh(tickGeo, tickMat);
    rightTick.rotation.y = Math.PI / 2; rightTick.position.set(-0.42, 0, 0); rightTick.name = 'tick_r';
    ringContainer.add(rightTick);

    mainGroup.add(ringContainer);

    ringContainer.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.isFootRing = true;
      }
    });
  }

  const isGroupSelected = selectedElementId === mannequinObj.groupId && selectedElementType === 'group';
  const isRingHighlighted = isSelected || isGroupSelected;
  const activeColor = 0x3b82f6;
  const inactiveColor = 0x8a9fb4;

  ringContainer.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      if (isRingHighlighted) {
        child.material.color.set(activeColor);
        if (child.name === 'outer') child.material.opacity = 0.85;
        else if (child.name === 'inner') child.material.opacity = 0.6;
        else child.material.opacity = 0.9;
      } else {
        child.material.color.set(inactiveColor);
        if (child.name === 'outer') child.material.opacity = 0.35;
        else if (child.name === 'inner') child.material.opacity = 0.15;
        else child.material.opacity = 0.3;
      }
    }
  });

  ringContainer.scale.set(isRingHighlighted ? 1.08 : 1.0, 1.0, isRingHighlighted ? 1.08 : 1.0);
}

function colorParts(mainGroup: THREE.Group, isSelected: boolean, targetStyle: string, mannequinObj: MannequinObject): void {
  mainGroup.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      if (node.material instanceof THREE.MeshStandardMaterial) {
        if (node.name === 'visor' || node.userData.isVisor) {
          node.material.color.set(targetStyle === 'detailed' ? '#00f0ff' : '#74b9ff');
        } else if (node.userData.isJoint) {
          node.material.color.set(isSelected ? '#3ae374' : (targetStyle === 'detailed' ? '#2c3e50' : '#ffffff'));
        } else if (node.userData.isBootsOrHands) {
          node.material.color.set(targetStyle === 'detailed' ? '#1e272e' : '#f1f2f6');
        } else if (node.userData.isBodyPart) {
          node.material.color.set(mannequinObj.color);
        } else {
          if (node.geometry instanceof THREE.SphereGeometry && (node.geometry.parameters?.radius ?? 0) < 0.12) {
            node.material.color.set(isSelected ? '#3ae374' : (targetStyle === 'detailed' ? '#2c3e50' : '#ffffff'));
          } else if (node.geometry instanceof THREE.BoxGeometry && (node.geometry.parameters?.width ?? 0) <= 0.08) {
            node.material.color.set(targetStyle === 'detailed' ? '#1e272e' : '#f1f2f6');
          } else {
            node.material.color.set(mannequinObj.color);
          }
        }
      }
    }
  });
}

function startGlbLoading(mannequinObj: MannequinObject, deps: MannequinSyncDeps): void {
  const glbUrl = mannequinObj.glbUrl;
  if (!glbUrl || deps.loadingUrls.has(glbUrl)) return;

  const glbKey = mannequinObj.glbId || mannequinObj.glbUrl || '';
  deps.loadingUrls.add(glbUrl);

  const startLoading = (urlToLoad: string) => {
    const loader = new GLTFLoader();
    loader.load(
      urlToLoad,
      (gltf) => {
        deps.loadedGlbTemplates.set(glbKey, gltf);
        deps.loadingUrls.delete(glbUrl);
        deps.glbLoadedCounter.value += 1;
        replaceGlbPlaceholders(glbKey, gltf, deps.mannequinMeshes);
        deps.onGlbLoaded?.();
      },
      undefined,
      (err) => {
        console.error('Failed to load GLB bone model:', err);
        deps.loadingUrls.delete(glbUrl);
      }
    );
  };

  getGLBFromDB(mannequinObj.glbId || '').then((arrayBuffer) => {
    if (arrayBuffer) {
      const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
      const blobUrl = URL.createObjectURL(blob);
      startLoading(blobUrl);
    } else if (mannequinObj.glbUrl) {
      startLoading(mannequinObj.glbUrl);
    }
  }).catch(() => {
    if (mannequinObj.glbUrl) {
      startLoading(mannequinObj.glbUrl);
    }
  });
}

function applyAllJoints(mannequinObj: MannequinObject, pelvisBone: THREE.Object3D, tc: MannequinSyncDeps['transformControls']): void {
  const joints = mannequinObj.joints;
  applyRot(mannequinObj, pelvisBone, 'chest', joints.chest, tc);
  applyRot(mannequinObj, pelvisBone, 'head', joints.head, tc);
  applyRot(mannequinObj, pelvisBone, 'pelvis', joints.pelvis, tc);
  applyRot(mannequinObj, pelvisBone, 'leftShoulder', joints.leftShoulder, tc);
  applyRot(mannequinObj, pelvisBone, 'leftElbow', joints.leftElbow, tc);
  applyRot(mannequinObj, pelvisBone, 'leftWrist', joints.leftWrist, tc);
  applyRot(mannequinObj, pelvisBone, 'rightShoulder', joints.rightShoulder, tc);
  applyRot(mannequinObj, pelvisBone, 'rightElbow', joints.rightElbow, tc);
  applyRot(mannequinObj, pelvisBone, 'rightWrist', joints.rightWrist, tc);
  applyRot(mannequinObj, pelvisBone, 'leftHip', joints.leftHip, tc);
  applyRot(mannequinObj, pelvisBone, 'leftKnee', joints.leftKnee, tc);
  applyRot(mannequinObj, pelvisBone, 'leftAnkle', joints.leftAnkle, tc);
  applyRot(mannequinObj, pelvisBone, 'rightHip', joints.rightHip, tc);
  applyRot(mannequinObj, pelvisBone, 'rightKnee', joints.rightKnee, tc);
  applyRot(mannequinObj, pelvisBone, 'rightAnkle', joints.rightAnkle, tc);
}

export function syncMannequins(
  project: DirectingProject,
  selectedElementId: string | null,
  selectedElementType: string | null,
  selectedJointKey: keyof MannequinJoints | null,
  hideHelpers: boolean,
  deps: MannequinSyncDeps,
): void {
  if (!deps.scene) return;

  project.mannequins.forEach((mannequinObj) => {
    let mainGroup = deps.mannequinMeshes.get(mannequinObj.id);

    if (!mannequinObj.visible) {
      if (mainGroup) {
        mainGroup.visible = false;
        if (deps.transformControls && (deps.transformControls.object === mainGroup || mainGroup.getObjectByName(deps.transformControls.object?.name || ''))) {
          deps.transformControls.detach();
        }
      }
      return;
    }

    const targetStyle = mannequinObj.style || 'detailed';

    if (mainGroup && mainGroup.userData.style !== targetStyle) {
      deps.detachFn(mainGroup);
      deps.scene.remove(mainGroup);
      deps.mannequinMeshes.delete(mannequinObj.id);
      mainGroup = undefined;
    }

    if (mainGroup && targetStyle === 'glb') {
      const placeholder = mainGroup.getObjectByName('glb_placeholder');
      if (placeholder) {
        const glbKey = mannequinObj.glbId || mannequinObj.glbUrl;
        if (glbKey) {
          const cachedTemplate = deps.loadedGlbTemplates.get(glbKey);
          if (cachedTemplate) {
            mainGroup.remove(placeholder);
            const clonedScene = SkeletonUtils.clone(cachedTemplate.scene);
            processAndAddGlbScene(clonedScene, mainGroup);
          }
        }
      }
    }

    const isSelected = selectedElementId === mannequinObj.id;

    if (!mainGroup) {
      mainGroup = createNewMannequinGroup(mannequinObj, isSelected, targetStyle, deps);
      deps.scene.add(mainGroup);
      deps.mannequinMeshes.set(mannequinObj.id, mainGroup);
    }

    if (mainGroup.parent !== deps.scene) {
      deps.scene.add(mainGroup);
    }
    mainGroup.visible = true;

    const isDraggingThis = deps.transformControls?.dragging && deps.transformControls.object === mainGroup;
    if (!isDraggingThis) {
      mainGroup.position.set(mannequinObj.position.x, mannequinObj.position.y, mannequinObj.position.z);
      mainGroup.scale.set(mannequinObj.scale.x, mannequinObj.scale.y, mannequinObj.scale.z);
      mainGroup.rotation.set(
        deg2rad(mannequinObj.rotation.x),
        deg2rad(mannequinObj.rotation.y),
        deg2rad(mannequinObj.rotation.z)
      );
    }

    const pelvisBone = mainGroup.getObjectByName('pelvis');
    if (pelvisBone) {
      applyAllJoints(mannequinObj, pelvisBone, deps.transformControls);
    }

    ensureFootRing(mainGroup, isSelected, mannequinObj, selectedElementId, selectedElementType);
    deps.rigControllerManager.syncRigControllers(mainGroup, isSelected, selectedJointKey, hideHelpers, mannequinObj.controllerScale ?? 1);
    colorParts(mainGroup, isSelected, targetStyle, mannequinObj);
  });

  deps.mannequinMeshes.forEach((group, id) => {
    if (!project.mannequins.some(m => m.id === id)) {
      deps.scene.remove(group);
      deps.mannequinMeshes.delete(id);
    }
  });
}

function createNewMannequinGroup(
  mannequinObj: MannequinObject,
  isSelected: boolean,
  targetStyle: string,
  deps: MannequinSyncDeps,
): THREE.Group {
  const mainGroup = new THREE.Group();
  mainGroup.userData = { id: mannequinObj.id, type: 'mannequin', style: targetStyle };

  if (targetStyle === 'glb') {
    const glbKey = mannequinObj.glbId || mannequinObj.glbUrl;
    mainGroup.userData.glbKey = glbKey || '';
    if (glbKey) {
      const cachedTemplate = deps.loadedGlbTemplates.get(glbKey);
      if (cachedTemplate) {
        const clonedScene = SkeletonUtils.clone(cachedTemplate.scene);
        processAndAddGlbScene(clonedScene, mainGroup);
      } else {
        addGlbPlaceholder(mainGroup, mannequinObj, deps);
      }
    }
  } else {
    const procGroup = createProceduralMannequin(mannequinObj, isSelected);
    while (procGroup.children.length > 0) {
      mainGroup.add(procGroup.children[0]);
    }
  }

  return mainGroup;
}

function addGlbPlaceholder(mainGroup: THREE.Group, mannequinObj: MannequinObject, deps: MannequinSyncDeps): void {
  const placeholderGeo = new THREE.BoxGeometry(0.35, 1.8, 0.35);
  const placeholderMat = new THREE.MeshBasicMaterial({
    color: '#10ac84',
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });
  const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
  placeholderMesh.position.y = 0.9;
  placeholderMesh.name = 'glb_placeholder';
  mainGroup.add(placeholderMesh);

  startGlbLoading(mannequinObj, deps);
}
