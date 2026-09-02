/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { MannequinObject } from '@/components/director-3d/director3D.types';

export function createProceduralMannequin(mannequinObj: MannequinObject, isSelected: boolean): THREE.Group {
  const mainGroup = new THREE.Group();
  mainGroup.userData = { id: mannequinObj.id, type: 'mannequin', style: mannequinObj.style || 'detailed' };

  const isBasic = mannequinObj.style === 'simple';

  const baseMat = new THREE.MeshStandardMaterial({
    color: mannequinObj.color,
    roughness: isBasic ? 0.6 : 0.12,
    metalness: isBasic ? 0.1 : 0.08,
  });
  
  const jointMat = new THREE.MeshStandardMaterial({
    color: '#1b1b1f',
    roughness: 0.15,
    metalness: 0.95
  });

  const muscleHighlightMat = new THREE.MeshStandardMaterial({
    color: mannequinObj.color,
    roughness: isBasic ? 0.6 : 0.15,
    metalness: isBasic ? 0.1 : 0.08,
  });

  function createBone(name: string, isEndEffector: boolean = false): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    
    if (!isBasic) {
      if (!isEndEffector) {
        let sphereSize = 0.026;
        if (name.includes('pelvis') || name.includes('chest')) {
          sphereSize = 0.045;
        } else if (name.includes('Hip') || name.includes('Shoulder')) {
          sphereSize = 0.035;
        }
        
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(sphereSize, 24, 24), jointMat);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        group.add(sphere);
      }
    } else {
      if (!isEndEffector) {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), jointMat);
        group.add(sphere);
      }
    }
    
    group.userData.bindQuaternion = new THREE.Quaternion();
    return group;
  }

  function addLink(parent: THREE.Group, length: number, radiusTop: number, radiusBottom: number) {
    if (isBasic) {
      radiusTop *= 0.6;
      radiusBottom *= 0.6;
    }
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, Math.abs(length), 24);
    geo.translate(0, length / 2, 0);
    geo.scale(1.0, 1.0, 0.88);

    const mesh = new THREE.Mesh(geo, baseMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  // 1. Pelvis
  const pelvis = createBone('pelvis');
  pelvis.position.set(0, 0.95, 0); 
  mainGroup.add(pelvis);

  if (!isBasic) {
    const pelvisGirdleGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.12, 24);
    pelvisGirdleGeo.scale(1.0, 1.0, 0.85);
    pelvisGirdleGeo.translate(0, -0.04, 0);
    const pelvisGirdle = new THREE.Mesh(pelvisGirdleGeo, baseMat);
    pelvisGirdle.castShadow = true;
    pelvisGirdle.receiveShadow = true;
    pelvis.add(pelvisGirdle);

    const groinGeo = new THREE.SphereGeometry(0.095, 24, 16);
    groinGeo.scale(1.0, 0.65, 0.8);
    groinGeo.translate(0, -0.09, 0);
    const groinMesh = new THREE.Mesh(groinGeo, baseMat);
    groinMesh.castShadow = true;
    groinMesh.receiveShadow = true;
    pelvis.add(groinMesh);

    const buttGeo = new THREE.SphereGeometry(0.07, 16, 16);
    buttGeo.scale(1.0, 1.2, 0.9);
    
    const leftButt = new THREE.Mesh(buttGeo, baseMat);
    leftButt.position.set(0.042, -0.05, -0.035);
    pelvis.add(leftButt);

    const rightButt = new THREE.Mesh(buttGeo, baseMat);
    rightButt.position.set(-0.042, -0.05, -0.035);
    pelvis.add(rightButt);
  } else {
    const pelvisGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.11, 16);
    pelvisGeo.translate(0, -0.05, 0);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, baseMat);
    pelvis.add(pelvisMesh);
  }

  // 2. Spine / Chest
  const chest = createBone('chest');
  chest.position.set(0, 0.38, 0); 
  pelvis.add(chest);
  
  if (!isBasic) {
    const spineDiskGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 12);
    for (let i = 1; i <= 4; i++) {
      const disk = new THREE.Mesh(spineDiskGeo, jointMat);
      disk.position.set(0, 0.07 * i, -0.015);
      pelvis.add(disk);
    }

    const ribcageGeo = new THREE.CylinderGeometry(0.13, 0.10, 0.20, 24);
    ribcageGeo.scale(1.15, 1.0, 0.82);
    ribcageGeo.translate(0, 0.10, 0.0);
    const ribcageMesh = new THREE.Mesh(ribcageGeo, baseMat);
    ribcageMesh.castShadow = true;
    ribcageMesh.receiveShadow = true;
    chest.add(ribcageMesh);

    const waistGeo = new THREE.CylinderGeometry(0.082, 0.10, 0.10, 24);
    waistGeo.scale(1.0, 1.0, 0.80);
    waistGeo.translate(0, 0.03, -0.01);
    const waistMesh = new THREE.Mesh(waistGeo, baseMat);
    waistMesh.castShadow = true;
    waistMesh.receiveShadow = true;
    chest.add(waistMesh);

    const pecGeo = new THREE.SphereGeometry(0.062, 16, 16);
    pecGeo.scale(1.0, 0.75, 0.45);

    const leftPec = new THREE.Mesh(pecGeo, muscleHighlightMat);
    leftPec.position.set(0.05, 0.13, 0.065);
    leftPec.rotation.set(0.1, -0.1, 0);
    chest.add(leftPec);

    const rightPec = new THREE.Mesh(pecGeo, muscleHighlightMat);
    rightPec.position.set(-0.05, 0.13, 0.065);
    rightPec.rotation.set(0.1, 0.1, 0);
    chest.add(rightPec);

    const trapGeo = new THREE.CylinderGeometry(0.042, 0.065, 0.045, 16);
    trapGeo.scale(1.1, 1.0, 0.9);
    trapGeo.translate(0, 0.19, -0.01);
    const trapMesh = new THREE.Mesh(trapGeo, baseMat);
    chest.add(trapMesh);

    const clavicleGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.26, 12);
    clavicleGeo.rotateZ(Math.PI / 2);
    clavicleGeo.translate(0, 0.18, 0.05);
    const clavicleMesh = new THREE.Mesh(clavicleGeo, jointMat);
    chest.add(clavicleMesh);

    const socketGeo = new THREE.SphereGeometry(0.046, 24, 24);
    
    const leftSocket = new THREE.Mesh(socketGeo, jointMat);
    leftSocket.position.set(0.18, 0.20, 0);
    chest.add(leftSocket);

    const rightSocket = new THREE.Mesh(socketGeo, jointMat);
    rightSocket.position.set(-0.18, 0.20, 0);
    chest.add(rightSocket);
    
  } else {
    addLink(pelvis, 0.38, 0.11, 0.09);
  }

  // 3. Head
  const head = createBone('head', true);
  head.position.set(0, 0.34, 0); 
  chest.add(head);
  
  if (!isBasic) {
    const neckRingGeo = new THREE.CylinderGeometry(0.030, 0.034, 0.015, 24);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(neckRingGeo, jointMat);
      ring.position.set(0, 0.205 + i * 0.034, 0);
      ring.castShadow = true;
      ring.receiveShadow = true;
      chest.add(ring);
    }
  } else {
    addLink(chest, 0.34, 0.04, 0.05);
  }

  const headGeo = new THREE.SphereGeometry(0.088, 24, 24);
  headGeo.scale(0.95, 1.15, 1.05); 
  headGeo.translate(0, 0.085, 0.005); 
  const headMesh = new THREE.Mesh(headGeo, baseMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);
  
  if (!isBasic) {
    const visorGeo = new THREE.SphereGeometry(0.076, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    visorGeo.scale(1.0, 0.82, 1.15);
    visorGeo.rotateX(Math.PI / 2.2); 
    const visorMesh = new THREE.Mesh(visorGeo, jointMat);
    visorMesh.position.set(0, 0.095, 0.034);
    visorMesh.userData.isVisor = true;
    head.add(visorMesh);

    const jawGeo = new THREE.ConeGeometry(0.065, 0.075, 4);
    jawGeo.rotateY(Math.PI / 4);
    jawGeo.rotateX(Math.PI);
    jawGeo.scale(1.1, 1.0, 1.25);
    jawGeo.translate(0, 0.045, 0.012);
    const jawMesh = new THREE.Mesh(jawGeo, baseMat);
    jawMesh.castShadow = true;
    head.add(jawMesh);
  }

  // --- ARMS ---
  const leftShoulder = createBone('leftShoulder');
  leftShoulder.position.set(0.18, 0.20, 0); 
  leftShoulder.rotation.z = -Math.PI / 2;
  chest.add(leftShoulder);
  
  const leftElbow = createBone('leftElbow');
  leftElbow.position.set(0, 0.26, 0); 
  leftShoulder.add(leftElbow);
  addLink(leftShoulder, 0.26, 0.044, 0.036);
  
  if (!isBasic) {
    const capGeo = new THREE.SphereGeometry(0.055, 24, 24);
    capGeo.scale(1.15, 1.25, 0.95);
    const leftCap = new THREE.Mesh(capGeo, baseMat);
    leftCap.position.set(0, 0.015, 0); 
    leftCap.castShadow = true;
    leftShoulder.add(leftCap);

    const bicepGeo = new THREE.SphereGeometry(0.042, 16, 16);
    bicepGeo.scale(1.0, 1.5, 0.9);
    bicepGeo.translate(0, 0.12, 0);
    const leftBicep = new THREE.Mesh(bicepGeo, muscleHighlightMat);
    leftBicep.castShadow = true;
    leftShoulder.add(leftBicep);
  }
  
  const leftWrist = createBone('leftWrist', true);
  leftWrist.position.set(0, 0.25, 0);
  leftElbow.add(leftWrist);
  addLink(leftElbow, 0.25, 0.036, 0.028);

  if (!isBasic) {
    const forearmBulgeGeo = new THREE.SphereGeometry(0.035, 16, 16);
    forearmBulgeGeo.scale(1.1, 1.4, 0.85);
    forearmBulgeGeo.translate(0, 0.08, 0);
    const leftForearmBulge = new THREE.Mesh(forearmBulgeGeo, muscleHighlightMat);
    leftForearmBulge.castShadow = true;
    leftElbow.add(leftForearmBulge);
  }
  
  const lHandGeo = new THREE.BoxGeometry(0.052, 0.08, 0.035);
  lHandGeo.translate(0, 0.04, 0);
  const leftHand = new THREE.Mesh(lHandGeo, baseMat);
  leftWrist.add(leftHand);

  if (!isBasic) {
    const thumbGeo = new THREE.BoxGeometry(0.015, 0.032, 0.015);
    thumbGeo.translate(0.015, 0.015, 0.008);
    const leftThumb = new THREE.Mesh(thumbGeo, jointMat);
    leftThumb.position.set(0.022, 0.015, 0);
    leftHand.add(leftThumb);
  }

  const rightShoulder = createBone('rightShoulder');
  rightShoulder.position.set(-0.18, 0.20, 0);
  rightShoulder.rotation.z = Math.PI / 2;
  chest.add(rightShoulder);
  
  const rightElbow = createBone('rightElbow');
  rightElbow.position.set(0, 0.26, 0);
  rightShoulder.add(rightElbow);
  addLink(rightShoulder, 0.26, 0.044, 0.036);
  
  if (!isBasic) {
    const capGeo = new THREE.SphereGeometry(0.055, 24, 24);
    capGeo.scale(1.15, 1.25, 0.95);
    const rightCap = new THREE.Mesh(capGeo, baseMat);
    rightCap.position.set(0, 0.015, 0);
    rightCap.castShadow = true;
    rightShoulder.add(rightCap);

    const bicepGeo = new THREE.SphereGeometry(0.042, 16, 16);
    bicepGeo.scale(1.0, 1.5, 0.9);
    bicepGeo.translate(0, 0.12, 0);
    const rightBicep = new THREE.Mesh(bicepGeo, muscleHighlightMat);
    rightBicep.castShadow = true;
    rightShoulder.add(rightBicep);
  }
  
  const rightWrist = createBone('rightWrist', true);
  rightWrist.position.set(0, 0.25, 0);
  rightElbow.add(rightWrist);
  addLink(rightElbow, 0.25, 0.036, 0.028);

  if (!isBasic) {
    const forearmBulgeGeo = new THREE.SphereGeometry(0.035, 16, 16);
    forearmBulgeGeo.scale(1.1, 1.4, 0.85);
    forearmBulgeGeo.translate(0, 0.08, 0);
    const rightForearmBulge = new THREE.Mesh(forearmBulgeGeo, muscleHighlightMat);
    rightForearmBulge.castShadow = true;
    rightElbow.add(rightForearmBulge);
  }

  const rHandGeo = new THREE.BoxGeometry(0.052, 0.08, 0.035);
  rHandGeo.translate(0, 0.04, 0);
  const rightHand = new THREE.Mesh(rHandGeo, baseMat);
  rightWrist.add(rightHand);

  if (!isBasic) {
    const thumbGeo = new THREE.BoxGeometry(0.015, 0.032, 0.015);
    thumbGeo.translate(-0.015, 0.015, 0.008);
    const rightThumb = new THREE.Mesh(thumbGeo, jointMat);
    rightThumb.position.set(-0.022, 0.015, 0);
    rightHand.add(rightThumb);
  }


  // --- LEGS ---
  const leftHip = createBone('leftHip');
  leftHip.position.set(0.10, -0.05, 0);
  leftHip.rotation.z = Math.PI;
  pelvis.add(leftHip);
  
  if (!isBasic) {
    const hipJoinPad = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), jointMat);
    hipJoinPad.position.set(0.10, -0.05, 0);
    pelvis.add(hipJoinPad);
  }

  const leftKnee = createBone('leftKnee');
  leftKnee.position.set(0, 0.43, 0); 
  leftHip.add(leftKnee);
  addLink(leftHip, 0.43, 0.068, 0.054);
  
  if (!isBasic) {
    const quadGeo = new THREE.SphereGeometry(0.064, 16, 16);
    quadGeo.scale(1.05, 1.7, 1.2);
    quadGeo.translate(0, 0.20, 0.025); 
    const leftQuad = new THREE.Mesh(quadGeo, muscleHighlightMat);
    leftQuad.castShadow = true;
    leftHip.add(leftQuad);

    const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.02), baseMat);
    kneeCap.position.set(0, 0, 0.03);
    leftKnee.add(kneeCap);
  }
  
  const leftAnkle = createBone('leftAnkle', true);
  leftAnkle.position.set(0, 0.41, 0);
  leftKnee.add(leftAnkle);
  addLink(leftKnee, 0.41, 0.054, 0.035);

  if (!isBasic) {
    const calfMuscleGeo = new THREE.SphereGeometry(0.048, 16, 16);
    calfMuscleGeo.scale(0.95, 1.4, 1.15);
    calfMuscleGeo.translate(0, 0.13, -0.018); 
    const leftCalfMuscle = new THREE.Mesh(calfMuscleGeo, muscleHighlightMat);
    leftCalfMuscle.castShadow = true;
    leftKnee.add(leftCalfMuscle);
  }

  const lFootGeo = new THREE.BoxGeometry(0.076, 0.06, 0.19);
  lFootGeo.translate(0, 0.03, 0.045); 
  const leftFoot = new THREE.Mesh(lFootGeo, baseMat);
  leftAnkle.add(leftFoot);

  if (!isBasic) {
    const maleolarGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.082, 8);
    maleolarGeo.rotateZ(Math.PI / 2);
    const maleolar = new THREE.Mesh(maleolarGeo, jointMat);
    leftAnkle.add(maleolar);

    const toeCapGeo = new THREE.ConeGeometry(0.038, 0.05, 4);
    toeCapGeo.rotateX(Math.PI / 2);
    toeCapGeo.scale(1.0, 0.6, 1.3);
    toeCapGeo.translate(0, 0.012, 0.15);
    const leftToe = new THREE.Mesh(toeCapGeo, baseMat);
    leftFoot.add(leftToe);
  }

  const rightHip = createBone('rightHip');
  rightHip.position.set(-0.10, -0.05, 0);
  rightHip.rotation.z = Math.PI; 
  pelvis.add(rightHip);
  
  if (!isBasic) {
    const hipJoinPad = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), jointMat);
    hipJoinPad.position.set(-0.10, -0.05, 0);
    pelvis.add(hipJoinPad);
  }

  const rightKnee = createBone('rightKnee');
  rightKnee.position.set(0, 0.43, 0);
  rightHip.add(rightKnee);
  addLink(rightHip, 0.43, 0.068, 0.054);
  
  if (!isBasic) {
    const quadGeo = new THREE.SphereGeometry(0.064, 16, 16);
    quadGeo.scale(1.05, 1.7, 1.2);
    quadGeo.translate(0, 0.20, 0.025);
    const rightQuad = new THREE.Mesh(quadGeo, muscleHighlightMat);
    rightQuad.castShadow = true;
    rightHip.add(rightQuad);

    const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.02), baseMat);
    kneeCap.position.set(0, 0, 0.03);
    rightKnee.add(kneeCap);
  }
  
  const rightAnkle = createBone('rightAnkle', true);
  rightAnkle.position.set(0, 0.41, 0);
  rightKnee.add(rightAnkle);
  addLink(rightKnee, 0.41, 0.054, 0.035);

  if (!isBasic) {
    const calfMuscleGeo = new THREE.SphereGeometry(0.048, 16, 16);
    calfMuscleGeo.scale(0.95, 1.4, 1.15);
    calfMuscleGeo.translate(0, 0.13, -0.018);
    const rightCalfMuscle = new THREE.Mesh(calfMuscleGeo, muscleHighlightMat);
    rightCalfMuscle.castShadow = true;
    rightKnee.add(rightCalfMuscle);
  }

  const rFootGeo = new THREE.BoxGeometry(0.076, 0.06, 0.19);
  rFootGeo.translate(0, 0.03, 0.045);
  const rightFoot = new THREE.Mesh(rFootGeo, baseMat);
  rightAnkle.add(rightFoot);

  if (!isBasic) {
    const maleolarGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.082, 8);
    maleolarGeo.rotateZ(Math.PI / 2);
    const maleolar = new THREE.Mesh(maleolarGeo, jointMat);
    rightAnkle.add(maleolar);

    const toeCapGeo = new THREE.ConeGeometry(0.038, 0.05, 4);
    toeCapGeo.rotateX(Math.PI / 2);
    toeCapGeo.scale(1.0, 0.6, 1.3);
    toeCapGeo.translate(0, 0.012, 0.15);
    const rightToe = new THREE.Mesh(toeCapGeo, baseMat);
    rightFoot.add(rightToe);
  }

  mainGroup.updateMatrixWorld(true);
  mainGroup.traverse((child) => {
    if (child.name && child.userData.bindQuaternion) {
      child.userData.bindQuaternion.copy(child.quaternion);
    }
  });

  return mainGroup;
}
