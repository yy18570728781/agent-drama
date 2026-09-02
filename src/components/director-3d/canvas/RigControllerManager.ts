import * as THREE from 'three';
import type { MannequinJoints } from '@/components/director-3d/director3D.types';

const JOINTS_LIST = [
  'head', 'chest', 'pelvis', 'leftShoulder', 'leftElbow', 'leftWrist',
  'leftHip', 'leftKnee', 'leftAnkle', 'rightShoulder', 'rightElbow',
  'rightWrist', 'rightHip', 'rightKnee', 'rightAnkle'
];

const COLOR_LEFT = 0xff3838;
const COLOR_RIGHT = 0x1e90ff;
const COLOR_CENTER = 0xffd23f;
const COLOR_ACTIVE = 0xffa500;

function getBaseColor(jointName: string): number {
  if (jointName.startsWith('left')) return COLOR_LEFT;
  if (jointName.startsWith('right')) return COLOR_RIGHT;
  return COLOR_CENTER;
}

function createRingLineGeo(radius: number, segments: number = 32): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  points.push(points[0].clone());
  return new THREE.BufferGeometry().setFromPoints(points);
}

function addLineControl(rigGroup: THREE.Group, geo: THREE.BufferGeometry, color: number, opacity: number = 0.75) {
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 999;
  rigGroup.add(line);
}

function addBoxOutlineControl(rigGroup: THREE.Group, w: number, h: number, d: number, color: number, opacity: number = 0.80) {
  const boxGeo = new THREE.BoxGeometry(w, h, d);
  const edgesGeo = new THREE.EdgesGeometry(boxGeo);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
  const lineSegments = new THREE.LineSegments(edgesGeo, mat);
  lineSegments.renderOrder = 999;
  rigGroup.add(lineSegments);
}

function buildControllerShape(rigGroup: THREE.Group, jointName: string, baseColor: number, scaleFactor: number = 1): THREE.Vector3 {
  const v_model = new THREE.Vector3(0, 0, 0);
  const s = scaleFactor;

  if (jointName === 'head') {
    addLineControl(rigGroup, createRingLineGeo(0.15 * s), baseColor, 0.70);
    v_model.set(0, 0.26 * s, 0);
  } else if (jointName === 'chest') {
    const geo = createRingLineGeo(0.22 * s);
    geo.scale(1.2, 1.0, 0.85);
    addLineControl(rigGroup, geo, baseColor, 0.70);
    v_model.set(0, 0.12 * s, 0);
  } else if (jointName === 'pelvis') {
    const geo = createRingLineGeo(0.20 * s);
    geo.scale(1.25, 1.0, 1.05);
    addLineControl(rigGroup, geo, baseColor, 0.70);
    v_model.set(0, 0.08 * s, 0);
  } else if (jointName.includes('Wrist')) {
    addBoxOutlineControl(rigGroup, 0.08 * s, 0.08 * s, 0.08 * s, baseColor, 0.80);
  } else if (jointName.includes('Ankle')) {
    addBoxOutlineControl(rigGroup, 0.10 * s, 0.10 * s, 0.10 * s, baseColor, 0.80);
  } else if (jointName.includes('Elbow')) {
    addLineControl(rigGroup, createRingLineGeo(0.08 * s), baseColor, 0.70);
  } else if (jointName.includes('Knee')) {
    addLineControl(rigGroup, createRingLineGeo(0.09 * s), baseColor, 0.70);
  } else if (jointName.includes('Hip')) {
    addLineControl(rigGroup, createRingLineGeo(0.11 * s), baseColor, 0.70);
    v_model.set(0, -0.10 * s, 0);
  } else {
    addLineControl(rigGroup, createRingLineGeo(0.10 * s), baseColor, 0.70);
  }

  return v_model;
}

function computeTargetOrientation(jointName: string): THREE.Quaternion {
  const q = new THREE.Quaternion();
  if (jointName === 'head' || jointName === 'chest' || jointName === 'pelvis' || jointName.includes('Hip') || jointName.includes('Knee')) {
    q.set(0, 0, 0, 1);
  } else if (jointName.includes('Shoulder')) {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  } else if (jointName.includes('Elbow')) {
    const angle = jointName.includes('right') ? -Math.PI / 4 : Math.PI / 4;
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
  } else {
    q.set(0, 0, 0, 1);
  }
  return q;
}

export class RigControllerManager {
  syncRigControllers(
    mainGroup: THREE.Group,
    isSelected: boolean,
    selectedJointKey: keyof MannequinJoints | null,
    hideHelpers: boolean,
    controllerScale: number = 1,
  ) {
    JOINTS_LIST.forEach((jointName) => {
      const jointNode = mainGroup.getObjectByName(jointName);
      if (!jointNode) return;

      const baseColor = getBaseColor(jointName);
      let rigGroup = jointNode.getObjectByName(jointName + '_rig_controller') as THREE.Group | null;

      if (rigGroup && rigGroup.userData.controllerScale !== controllerScale) {
        jointNode.remove(rigGroup);
        rigGroup = null;
      }

      if (!rigGroup) {
        rigGroup = new THREE.Group();
        rigGroup.name = jointName + '_rig_controller';
        rigGroup.userData = { isRigController: true, jointName, controllerScale };

        const v_model = buildControllerShape(rigGroup, jointName, baseColor, controllerScale);
        const q_target = computeTargetOrientation(jointName);

        const chain: THREE.Object3D[] = [];
        let curr: THREE.Object3D | null = jointNode;
        while (curr && curr !== mainGroup) {
          chain.push(curr);
          curr = curr.parent;
        }

        const q_cum = new THREE.Quaternion();
        for (let i = chain.length - 1; i >= 0; i--) {
          const b = chain[i];
          const bindQ = b.userData.bindQuaternion || b.quaternion.clone();
          q_cum.multiply(bindQ);
        }

        const v_local = v_model.clone().applyQuaternion(q_cum.clone().invert());
        rigGroup.position.copy(v_local);

        const q_offset = q_cum.clone().invert().multiply(q_target);
        rigGroup.quaternion.copy(q_offset);

        jointNode.add(rigGroup);
      }

      rigGroup.visible = isSelected && !hideHelpers;

      if (isSelected && !hideHelpers) {
        const isCurrentJoint = selectedJointKey === jointName;

        rigGroup.traverse((child) => {
          if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
            if (isCurrentJoint) {
              child.material.color.set(COLOR_ACTIVE);
              child.material.opacity = 1.0;
            } else {
              child.material.color.set(baseColor);
              child.material.opacity = 0.75;
            }
          }
        });

        rigGroup.scale.set(isCurrentJoint ? 1.15 : 1.0, isCurrentJoint ? 1.15 : 1.0, isCurrentJoint ? 1.15 : 1.0);
      }
    });
  }
}
