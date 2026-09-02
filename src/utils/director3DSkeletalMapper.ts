/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const helperSizes: Record<string, number> = {
  pelvis: 0.18,
  chest: 0.16,
  head: 0.14,
  leftShoulder: 0.12,
  leftElbow: 0.10,
  leftWrist: 0.08,
  rightShoulder: 0.12,
  rightElbow: 0.10,
  rightWrist: 0.08,
  leftHip: 0.14,
  leftKnee: 0.11,
  leftAnkle: 0.08,
  rightHip: 0.14,
  rightKnee: 0.11,
  rightAnkle: 0.08
};

export function getDummyWorldQuaternion(jointName: string): THREE.Quaternion {
  const q = new THREE.Quaternion();
  if (jointName === 'leftShoulder' || jointName === 'leftElbow' || jointName === 'leftWrist') {
    q.setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
  } else if (jointName === 'rightShoulder' || jointName === 'rightElbow' || jointName === 'rightWrist') {
    q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  } else if (jointName.includes('Hip') || jointName.includes('Knee') || jointName.includes('Ankle')) {
    q.setFromEuler(new THREE.Euler(0, 0, Math.PI));
  } else {
    q.set(0, 0, 0, 1);
  }
  return q;
}

export function mapGLBBones(glbScene: THREE.Object3D) {
  const bones: THREE.Object3D[] = [];
  glbScene.traverse((node) => {
    if (node instanceof THREE.Bone) {
      bones.push(node);
    }
  });

  const candidateBones = bones.length > 0 ? bones : (() => {
    const arr: THREE.Object3D[] = [];
    glbScene.traverse(node => {
      const name = node.name ? node.name.toLowerCase() : '';
      if (name && (
        name.includes('joint') || name.includes('bone') || name.includes('rig') ||
        name.includes('spine') || name.includes('shoulder') || name.includes('arm') ||
        name.includes('hand') || name.includes('hip') || name.includes('thigh') ||
        name.includes('calf') || name.includes('foot') || name.includes('head') ||
        name.includes('pelvis') || name.includes('clavicle') || name.includes('elbow') || name.includes('wrist') || name.includes('knee') || name.includes('ankle') || name.includes('neck')
      )) {
        arr.push(node);
      }
    });
    return arr;
  })();

  const matched = new Set<string>();

  const findAndAlias = (jointKey: string, patterns: string[], excludes: string[] = []) => {
    const bestMatch = candidateBones.find(bone => {
      const name = bone.name.toLowerCase();
      const matchesPattern = patterns.some(p => name.includes(p));
      if (!matchesPattern) return false;
      const matchesExclude = excludes.some(e => name.includes(e));
      if (matchesExclude) return false;
      return true;
    });

    if (bestMatch) {
      bestMatch.name = jointKey;
      matched.add(jointKey);
    }
  };

  findAndAlias('pelvis', ['pelvis', 'hips', 'hip_root', 'root_hip'], []);
  findAndAlias('head', ['head', 'neck_02', 'neck'], ['shoulder', 'spine', 'clavicle']);
  findAndAlias('chest', ['spine_03', 'spine_02', 'chest', 'spine'], ['pelvis', 'hips', 'shoulder', 'neck', 'head', 'clavicle']);
  findAndAlias('leftShoulder', ['clavicle_l', 'upperarm_l', 'shoulder_l', 'arm_l', 'l_upperarm', 'l_shoulder', 'left_shoulder', 'left_arm', 'left_upperarm', 'shoulder.l'], ['lower', 'fore', 'hand', 'wrist', 'finger', 'clavicle']);
  findAndAlias('leftElbow', ['lowerarm_l', 'forearm_l', 'elbow_l', 'l_lowerarm', 'l_forearm', 'l_elbow', 'left_elbow', 'left_forearm', 'left_lowerarm', 'forearm.l'], ['hand', 'wrist', 'upper', 'shoulder', 'finger']);
  findAndAlias('leftWrist', ['hand_l', 'wrist_l', 'l_hand', 'l_wrist', 'left_hand', 'left_wrist', 'hand.l'], ['finger', 'thumb', 'index', 'middle', 'ring', 'pinky']);
  findAndAlias('rightShoulder', ['clavicle_r', 'upperarm_r', 'shoulder_r', 'arm_r', 'r_upperarm', 'r_shoulder', 'right_shoulder', 'right_arm', 'right_upperarm', 'shoulder.r'], ['lower', 'fore', 'hand', 'wrist', 'finger', 'clavicle']);
  findAndAlias('rightElbow', ['lowerarm_r', 'forearm_r', 'elbow_r', 'r_lowerarm', 'r_forearm', 'r_elbow', 'right_elbow', 'right_forearm', 'right_lowerarm', 'forearm.r'], ['hand', 'wrist', 'upper', 'shoulder', 'finger']);
  findAndAlias('rightWrist', ['hand_r', 'wrist_r', 'r_hand', 'r_wrist', 'right_hand', 'right_wrist', 'hand.r'], ['finger', 'thumb', 'index', 'middle', 'ring', 'pinky']);
  findAndAlias('leftHip', ['thigh_l', 'hip_l', 'l_thigh', 'l_hip', 'left_thigh', 'left_hip', 'thigh.l'], ['calf', 'knee', 'shin', 'foot', 'ankle', 'pelvis']);
  findAndAlias('leftKnee', ['calf_l', 'knee_l', 'shin_l', 'l_calf', 'l_knee', 'l_shin', 'left_knee', 'left_calf', 'left_shin', 'calf.l'], ['foot', 'ankle', 'thigh', 'hip']);
  findAndAlias('leftAnkle', ['foot_l', 'ankle_l', 'l_foot', 'l_ankle', 'left_foot', 'left_ankle', 'foot.l'], ['toe', 'ball']);
  findAndAlias('rightHip', ['thigh_r', 'hip_r', 'r_thigh', 'r_hip', 'right_thigh', 'right_hip', 'thigh.r'], ['calf', 'knee', 'shin', 'foot', 'ankle', 'pelvis']);
  findAndAlias('rightKnee', ['calf_r', 'knee_r', 'shin_r', 'r_calf', 'r_knee', 'r_shin', 'right_knee', 'right_calf', 'right_shin', 'calf.r'], ['foot', 'ankle', 'thigh', 'hip']);
  findAndAlias('rightAnkle', ['foot_r', 'ankle_r', 'r_foot', 'r_ankle', 'right_foot', 'right_ankle', 'foot.r'], ['toe', 'ball']);

  const allKeys = ['pelvis', 'chest', 'head', 'leftShoulder', 'leftElbow', 'leftWrist', 'rightShoulder', 'rightElbow', 'rightWrist', 'leftHip', 'leftKnee', 'leftAnkle', 'rightHip', 'rightKnee', 'rightAnkle'];
  for (const key of allKeys) {
    if (matched.has(key)) continue;
    const lowerKey = key.toLowerCase();
    const candidate = candidateBones.find(bone => bone.name.toLowerCase().includes(lowerKey));
    if (candidate) {
      candidate.name = key;
      matched.add(key);
    }
  }

  allKeys.forEach((key) => {
    const bone = glbScene.getObjectByName(key);
    if (bone) {
      const existing = bone.children.filter(c => c.userData?.type === 'jointHelper' || c.userData?.isJoint);
      existing.forEach(e => bone.remove(e));

      const size = helperSizes[key] || 0.10;
      const helperGeo = new THREE.SphereGeometry(size, 8, 8);
      const helperMat = new THREE.MeshBasicMaterial({
        color: 0x3ae374,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const jointHelper = new THREE.Mesh(helperGeo, helperMat);
      jointHelper.name = `${key}_helper`;
      jointHelper.userData = { isJoint: true, type: 'jointHelper', jointKey: key };
      bone.add(jointHelper);
    }
  });
}

export function processAndAddGlbScene(clonedScene: THREE.Object3D, mainGroup: THREE.Group) {
  clonedScene.traverse((node: any) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if ((node as any).isSkinnedMesh) {
        node.frustumCulled = false;
      }
    }
  });
  
  clonedScene.scale.set(1.15, 1.15, 1.15);
  
  mapGLBBones(clonedScene);

  clonedScene.updateMatrixWorld(true);

  clonedScene.traverse((node: any) => {
    if (node.isBone || node.userData?.isJoint || node.name) {
      if (!node.userData) node.userData = {};
      node.userData.bindQuaternion = node.quaternion.clone();

      const worldQ = new THREE.Quaternion();
      node.getWorldQuaternion(worldQ);
      node.userData.bindWorldQuaternion = worldQ;
    }
  });

  mainGroup.add(clonedScene);
}
