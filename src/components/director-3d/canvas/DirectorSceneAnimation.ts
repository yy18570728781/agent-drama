import * as THREE from 'three';
import type { DirectingProject, JointRotation, MannequinJoints } from '@/components/director-3d/director3D.types';
import { getRetargetDiffQ } from './DirectorSceneMannequinSync';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export interface AnimationDeps {
  mannequinMeshes: Map<string, THREE.Group>;
  transformControls: { dragging: boolean; object?: THREE.Object3D } | null;
}

function getAnimOffset(animType: string, jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (animType === 'none') return 0;
  
  if (animType === 'idle') {
    return getIdleOffset(jointName, axis, timeSec);
  }
  
  if (animType === 'walk') {
    return getWalkOffset(jointName, axis, timeSec);
  }
  
  if (animType === 'run') {
    return getRunOffset(jointName, axis, timeSec);
  }
  
  if (animType === 'dance') {
    return getDanceOffset(jointName, axis, timeSec);
  }
  
  if (animType === 'wave') {
    return getWaveOffset(jointName, axis, timeSec);
  }
  
  return 0;
}

function getIdleOffset(jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (jointName === 'chest' && axis === 'x') return Math.sin(timeSec * 2.5) * 4;
  if (jointName === 'head' && axis === 'x') return Math.sin(timeSec * 2.5 - 0.7) * 2;
  if (jointName === 'leftShoulder' && axis === 'z') return Math.sin(timeSec * 2.5) * 2;
  if (jointName === 'rightShoulder' && axis === 'z') return Math.sin(timeSec * 2.5) * 2;
  return 0;
}

function getWalkOffset(jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (jointName === 'leftHip' && axis === 'x') return Math.sin(timeSec * 5) * 25;
  if (jointName === 'rightHip' && axis === 'x') return -Math.sin(timeSec * 5) * 25;
  if (jointName === 'leftKnee' && axis === 'x') {
    const val = Math.sin(timeSec * 5 + Math.PI / 2);
    return val > 0 ? val * 25 : 0;
  }
  if (jointName === 'rightKnee' && axis === 'x') {
    const val = Math.sin(timeSec * 5 - Math.PI / 2);
    return val > 0 ? val * 25 : 0;
  }
  if (jointName === 'leftShoulder' && axis === 'x') return -Math.sin(timeSec * 5) * 20;
  if (jointName === 'rightShoulder' && axis === 'x') return Math.sin(timeSec * 5) * 20;
  if (jointName === 'leftElbow' && axis === 'x') return 15 + Math.sin(timeSec * 5) * 10;
  if (jointName === 'rightElbow' && axis === 'x') return 15 - Math.sin(timeSec * 5) * 10;
  if (jointName === 'chest' && axis === 'y') return Math.sin(timeSec * 5) * 5;
  return 0;
}

function getRunOffset(jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (jointName === 'leftHip' && axis === 'x') return Math.sin(timeSec * 8) * 35;
  if (jointName === 'rightHip' && axis === 'x') return -Math.sin(timeSec * 8) * 35;
  if (jointName === 'leftKnee' && axis === 'x') {
    const val = Math.sin(timeSec * 8 + Math.PI / 3);
    return val > 0 ? val * 45 : 0;
  }
  if (jointName === 'rightKnee' && axis === 'x') {
    const val = Math.sin(timeSec * 8 - Math.PI / 3);
    return val > 0 ? val * 45 : 0;
  }
  if (jointName === 'leftShoulder' && axis === 'x') return -Math.sin(timeSec * 8) * 35;
  if (jointName === 'rightShoulder' && axis === 'x') return Math.sin(timeSec * 8) * 35;
  if (jointName === 'leftElbow' && axis === 'x') return 30 + Math.sin(timeSec * 8) * 15;
  if (jointName === 'rightElbow' && axis === 'x') return 30 - Math.sin(timeSec * 8) * 15;
  if (jointName === 'chest' && axis === 'y') return Math.sin(timeSec * 8) * 10;
  if (jointName === 'chest' && axis === 'z') return Math.sin(timeSec * 8) * 5;
  return 0;
}

function getDanceOffset(jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (jointName === 'pelvis' && axis === 'y') return Math.sin(timeSec * 3) * 15;
  if (jointName === 'chest' && axis === 'z') return Math.sin(timeSec * 3) * 12;
  if (jointName === 'leftShoulder' && axis === 'z') return -65 + Math.sin(timeSec * 4) * 25;
  if (jointName === 'rightShoulder' && axis === 'z') return -65 + Math.cos(timeSec * 4) * 25;
  if (jointName === 'leftElbow' && axis === 'x') return 45 + Math.sin(timeSec * 4) * 20;
  if (jointName === 'rightElbow' && axis === 'x') return 45 + Math.cos(timeSec * 4) * 20;
  if (jointName === 'leftHip' && axis === 'z') return Math.sin(timeSec * 3) * 10;
  if (jointName === 'rightHip' && axis === 'z') return -Math.sin(timeSec * 3) * 10;
  return 0;
}

function getWaveOffset(jointName: string, axis: 'x' | 'y' | 'z', timeSec: number): number {
  if (jointName === 'rightShoulder' && axis === 'z') return -75;
  if (jointName === 'rightShoulder' && axis === 'x') return -25;
  if (jointName === 'rightElbow' && axis === 'x') return 55;
  if (jointName === 'rightWrist' && axis === 'y') return Math.sin(timeSec * 11) * 35;
  if (jointName === 'chest' && axis === 'y') return Math.sin(timeSec * 2.5) * 3;
  return 0;
}

function applyRotWithAnimation(
  parentGroup: THREE.Object3D,
  groupName: string,
  baseRot: JointRotation | undefined,
  animType: string,
  timeSec: number,
  isGlb: boolean,
  tc: AnimationDeps['transformControls'],
): void {
  const item = parentGroup.name === groupName ? parentGroup : parentGroup.getObjectByName(groupName);
  if (item && baseRot) {
    const isDraggingJoint = tc?.dragging && tc.object === item;
    if (!isDraggingJoint) {
      const rx = (baseRot.x ?? 0) + getAnimOffset(animType, groupName, 'x', timeSec);
      const ry = (baseRot.y ?? 0) + getAnimOffset(animType, groupName, 'y', timeSec);
      let rz = (baseRot.z ?? 0) + getAnimOffset(animType, groupName, 'z', timeSec);

      let bindQ = item.userData.bindQuaternion;
      if (!bindQ) {
        bindQ = item.quaternion.clone();
        item.userData.bindQuaternion = bindQ;
      }

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
    }
  }
}

function applyAllAnimatedJoints(
  pelvisBone: THREE.Object3D,
  joints: MannequinJoints,
  animType: string,
  timeSec: number,
  isGlb: boolean,
  tc: AnimationDeps['transformControls'],
): void {
  applyRotWithAnimation(pelvisBone, 'chest', joints.chest, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'head', joints.head, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'pelvis', joints.pelvis, animType, timeSec, isGlb, tc);
  
  applyRotWithAnimation(pelvisBone, 'leftShoulder', joints.leftShoulder, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'leftElbow', joints.leftElbow, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'leftWrist', joints.leftWrist, animType, timeSec, isGlb, tc);

  applyRotWithAnimation(pelvisBone, 'rightShoulder', joints.rightShoulder, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'rightElbow', joints.rightElbow, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'rightWrist', joints.rightWrist, animType, timeSec, isGlb, tc);

  applyRotWithAnimation(pelvisBone, 'leftHip', joints.leftHip, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'leftKnee', joints.leftKnee, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'leftAnkle', joints.leftAnkle, animType, timeSec, isGlb, tc);

  applyRotWithAnimation(pelvisBone, 'rightHip', joints.rightHip, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'rightKnee', joints.rightKnee, animType, timeSec, isGlb, tc);
  applyRotWithAnimation(pelvisBone, 'rightAnkle', joints.rightAnkle, animType, timeSec, isGlb, tc);
}

export function stepAnimations(project: DirectingProject, deps: AnimationDeps): void {
  if (!project || !project.mannequins) return;

  project.mannequins.forEach((mannequinObj) => {
    if (!mannequinObj.visible) return;
    const mainGroup = deps.mannequinMeshes.get(mannequinObj.id);
    if (!mainGroup) return;

    const pelvisBone = mainGroup.getObjectByName('pelvis');
    if (pelvisBone) {
      const joints = mannequinObj.joints;
      const animType = (mannequinObj as any).animation || 'none';
      const animSpeed = (mannequinObj as any).animationSpeed !== undefined ? (mannequinObj as any).animationSpeed : 1.0;
      const timeSec = (Date.now() * 0.001) * animSpeed;
      const isGlb = mannequinObj.style === 'glb';

      applyAllAnimatedJoints(pelvisBone, joints, animType, timeSec, isGlb, deps.transformControls);
    }
  });
}
