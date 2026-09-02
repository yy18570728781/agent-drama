import * as THREE from 'three';
import type { DirectingProject, MannequinJoints, JointRotation } from '@/components/director-3d/director3D.types';
import { clampJointRotation } from '@/utils/director3DAnatomy';
import type { DirectorScene } from '@/components/director-3d/canvas/DirectorScene';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export interface TransformSyncDeps {
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
  };
}

export function useCanvasTransformSync(deps: TransformSyncDeps) {
  const triggerObjectChangeUpdate = (forceSync?: boolean) => {
    const targetObj = deps.dScene.transformControls?.object;
    if (!targetObj) return;
    const props = deps.getProps();

    if (targetObj === deps.dScene.groupGizmo && props.selectedElementType === 'group' && props.selectedElementId) {
      syncGroupTransform(targetObj, props);
      return;
    }

    let topGroup: THREE.Object3D | null = targetObj;
    let isJoint = false;
    let jointName = '';

    const jointsList = ['head', 'chest', 'pelvis', 'leftShoulder', 'leftElbow', 'leftWrist', 'leftHip', 'leftKnee', 'leftAnkle', 'rightShoulder', 'rightElbow', 'rightWrist', 'rightHip', 'rightKnee', 'rightAnkle'];
    if (jointsList.includes(targetObj.name)) { isJoint = true; jointName = targetObj.name; }

    while (topGroup && !topGroup.userData.id) topGroup = topGroup.parent;
    if (!topGroup || !topGroup.userData.id) return;

    const objId = topGroup.userData.id;
    const objType = topGroup.userData.type;

    if (objType === 'mannequin') {
      if (isJoint) {
        syncMannequinJointTransform(targetObj, objId, jointName, props);
      } else {
        syncMannequinBodyTransform(targetObj, objId, props);
      }
    } else if (objType === 'image') {
      syncImageTransform(targetObj, objId, props);
    } else if (objType === 'camera') {
      syncCameraTransform(targetObj, objId, props);
    } else if (objType === 'light') {
      syncLightTransform(targetObj, objId, props);
    } else if (objType === 'ground') {
      syncGroundTransform(targetObj, props);
    }
  };

  const syncGroupTransform = (targetObj: THREE.Object3D, props: ReturnType<typeof deps.getProps>) => {
    const gId = props.selectedElementId!;
    const gizmo = deps.dScene.groupGizmo!;
    const deltaPos = new THREE.Vector3().subVectors(gizmo.position, deps.dScene.groupGizmoInitialPos);
    const currentQ = gizmo.quaternion;
    const initialQ = new THREE.Quaternion().setFromEuler(deps.dScene.groupGizmoInitialRot);
    const deltaQ = new THREE.Quaternion().multiplyQuaternions(currentQ, initialQ.clone().invert());
    const dsx = deps.dScene.groupGizmoInitialScale.x !== 0 ? gizmo.scale.x / deps.dScene.groupGizmoInitialScale.x : 1;
    const dsy = deps.dScene.groupGizmoInitialScale.y !== 0 ? gizmo.scale.y / deps.dScene.groupGizmoInitialScale.y : 1;
    const dsz = deps.dScene.groupGizmoInitialScale.z !== 0 ? gizmo.scale.z / deps.dScene.groupGizmoInitialScale.z : 1;

    const updatedMannequins = props.project.mannequins.map(m => {
      if (m.groupId === gId) {
        const ip = deps.dScene.groupInitialPositions.get(m.id) || new THREE.Vector3(m.position.x, m.position.y, m.position.z);
        const ir = deps.dScene.groupInitialRotations.get(m.id) || new THREE.Vector3(m.rotation.x, m.rotation.y, m.rotation.z);
        const is2 = deps.dScene.groupInitialScales.get(m.id) || new THREE.Vector3(m.scale.x, m.scale.y, m.scale.z);

        const rp = new THREE.Vector3().subVectors(ip, deps.dScene.groupGizmoInitialPos);
        rp.x *= dsx; rp.y *= dsy; rp.z *= dsz;
        rp.applyQuaternion(deltaQ);
        const newPos = new THREE.Vector3().addVectors(gizmo.position, rp);

        const imq = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg2rad(ir.x), deg2rad(ir.y), deg2rad(ir.z), 'XYZ'));
        const nmq = new THREE.Quaternion().multiplyQuaternions(deltaQ, imq);
        const fe = new THREE.Euler().setFromQuaternion(nmq, 'XYZ');

        const ns = new THREE.Vector3(is2.x * dsx, is2.y * dsy, is2.z * dsz);
        return { ...m, position: { x: Number(newPos.x.toFixed(4)), y: Number(newPos.y.toFixed(4)), z: Number(newPos.z.toFixed(4)) }, rotation: { x: Number((fe.x * 180 / Math.PI).toFixed(2)), y: Number((fe.y * 180 / Math.PI).toFixed(2)), z: Number((fe.z * 180 / Math.PI).toFixed(2)) }, scale: { x: Number(ns.x.toFixed(4)), y: Number(ns.y.toFixed(4)), z: Number(ns.z.toFixed(4)) } };
      }
      return m;
    });
    deps.emit('updateProject', { ...props.project, mannequins: updatedMannequins });
  };

  const syncMannequinJointTransform = (targetObj: THREE.Object3D, objId: string, jointName: string, props: ReturnType<typeof deps.getProps>) => {
    const updatedMannequins = props.project.mannequins.map(m => {
      if (m.id === objId) {
        const currentJoints = { ...m.joints };
        let bindQ = targetObj.userData.bindQuaternion;
        if (!bindQ) { bindQ = targetObj.quaternion.clone(); targetObj.userData.bindQuaternion = bindQ; }
        const currentQ = targetObj.quaternion.clone();
        const theta_glb = bindQ.clone().invert().multiply(currentQ);

        let q_dummy = theta_glb;
        if (m.style === 'glb') {
          const diffQ = deps.dScene.getRetargetDiffQ(targetObj, jointName);
          q_dummy = diffQ.clone().invert().multiply(theta_glb).multiply(diffQ);
        }

        const deltaEuler = new THREE.Euler().setFromQuaternion(q_dummy, 'XYZ');
        let rawX = deltaEuler.x * 180 / Math.PI;
        let rawY = deltaEuler.y * 180 / Math.PI;
        let rawZ = deltaEuler.z * 180 / Math.PI;

        if (m.style === 'glb') {
          if (jointName === 'leftShoulder') rawZ = rawZ - 35;
          else if (jointName === 'rightShoulder') rawZ = rawZ + 35;
        }

        const clamped = clampJointRotation(jointName as keyof MannequinJoints, { x: rawX, y: rawY, z: rawZ });
        currentJoints[jointName as keyof MannequinJoints] = clamped;

        const jointTranslations = computeJointTranslation(targetObj, m, jointName);
        const jointScales = computeJointScale(targetObj, m, jointName);

        return { ...m, joints: currentJoints, jointTranslations, jointScales };
      }
      return m;
    });
    deps.emit('updateProject', { ...props.project, mannequins: updatedMannequins });
  };

  const syncMannequinBodyTransform = (targetObj: THREE.Object3D, objId: string, props: ReturnType<typeof deps.getProps>) => {
    const updatedMannequins = props.project.mannequins.map(m => {
      if (m.id === objId) {
        return { ...m, position: { x: targetObj.position.x, y: targetObj.position.y, z: targetObj.position.z }, rotation: { x: targetObj.rotation.x * 180 / Math.PI, y: targetObj.rotation.y * 180 / Math.PI, z: targetObj.rotation.z * 180 / Math.PI }, scale: { x: targetObj.scale.x, y: targetObj.scale.y, z: targetObj.scale.z } };
      }
      return m;
    });
    deps.emit('updateProject', { ...props.project, mannequins: updatedMannequins });
  };

  const syncImageTransform = (targetObj: THREE.Object3D, objId: string, props: ReturnType<typeof deps.getProps>) => {
    const updatedImages = props.project.imagePlanes.map(img => {
      if (img.id === objId) {
        return { ...img, position: { x: targetObj.position.x, y: targetObj.position.y, z: targetObj.position.z }, rotation: { x: targetObj.rotation.x * 180 / Math.PI, y: targetObj.rotation.y * 180 / Math.PI, z: targetObj.rotation.z * 180 / Math.PI }, scale: { x: targetObj.scale.x, y: targetObj.scale.y, z: targetObj.scale.z } };
      }
      return img;
    });
    deps.emit('updateProject', { ...props.project, imagePlanes: updatedImages });
  };

  const syncCameraTransform = (targetObj: THREE.Object3D, objId: string, props: ReturnType<typeof deps.getProps>) => {
    const camObj = props.project.cameras.find(c => c.id === objId);
    if (camObj && camObj.locked) return;
    const updatedCameras = props.project.cameras.map(cam => {
      if (cam.id === objId) {
        const rotEuler = new THREE.Euler(targetObj.rotation.x, targetObj.rotation.y, targetObj.rotation.z, 'XYZ');
        const direction = new THREE.Vector3(0, 0, -1).applyEuler(rotEuler);
        const newTarget = new THREE.Vector3(targetObj.position.x, targetObj.position.y, targetObj.position.z).add(direction.multiplyScalar(5));
        return { ...cam, position: { x: targetObj.position.x, y: targetObj.position.y, z: targetObj.position.z }, target: { x: newTarget.x, y: newTarget.y, z: newTarget.z } };
      }
      return cam;
    });
    deps.emit('updateProject', { ...props.project, cameras: updatedCameras });
  };

  const syncLightTransform = (targetObj: THREE.Object3D, objId: string, props: ReturnType<typeof deps.getProps>) => {
    const updatedLights = props.project.lights.map(l => {
      if (l.id === objId) { return { ...l, position: { x: targetObj.position.x, y: targetObj.position.y, z: targetObj.position.z } }; }
      return l;
    });
    deps.emit('updateProject', { ...props.project, lights: updatedLights });
  };

  const syncGroundTransform = (targetObj: THREE.Object3D, props: ReturnType<typeof deps.getProps>) => {
    deps.emit('updateProject', { ...props.project, ground: { ...props.project.ground, position: { x: targetObj.position.x, y: targetObj.position.y, z: targetObj.position.z }, rotation: { x: targetObj.rotation.x * 180 / Math.PI, y: targetObj.rotation.y * 180 / Math.PI, z: targetObj.rotation.z * 180 / Math.PI }, scale: { x: targetObj.scale.x, y: targetObj.scale.y, z: targetObj.scale.z } } });
  };

  return { triggerObjectChangeUpdate };
}

function computeJointTranslation(targetObj: THREE.Object3D, m: any, jointName: string): Record<string, any> {
  const jointTranslations = m.jointTranslations ? { ...m.jointTranslations } : {};
  let initPos = targetObj.userData.initPosition;
  if (!initPos) { initPos = targetObj.position.clone(); targetObj.userData.initPosition = initPos; }
  const dx = targetObj.position.x - initPos.x;
  const dy = targetObj.position.y - initPos.y;
  const dz = targetObj.position.z - initPos.z;
  if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001 || Math.abs(dz) > 0.0001) {
    jointTranslations[jointName] = { x: Number(dx.toFixed(4)), y: Number(dy.toFixed(4)), z: Number(dz.toFixed(4)) };
  } else { delete jointTranslations[jointName]; }
  return jointTranslations;
}

function computeJointScale(targetObj: THREE.Object3D, m: any, jointName: string): Record<string, any> {
  const jointScales = m.jointScales ? { ...m.jointScales } : {};
  const sx = targetObj.scale.x, sy = targetObj.scale.y, sz = targetObj.scale.z;
  if (Math.abs(sx - 1) > 0.0001 || Math.abs(sy - 1) > 0.0001 || Math.abs(sz - 1) > 0.0001) {
    jointScales[jointName] = { x: Number(sx.toFixed(4)), y: Number(sy.toFixed(4)), z: Number(sz.toFixed(4)) };
  } else { delete jointScales[jointName]; }
  return jointScales;
}
