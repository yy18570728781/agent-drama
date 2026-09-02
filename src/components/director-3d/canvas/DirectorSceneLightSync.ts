import * as THREE from 'three';
import type { DirectingProject, LightConfig } from '@/components/director-3d/director3D.types';

export interface LightSyncDeps {
  scene: THREE.Scene;
  lightVisuals: Map<string, THREE.Group>;
  detachFn: (obj: THREE.Object3D) => void;
}

export function createLightVisual(lightCfg: LightConfig): THREE.Group {
  const group = new THREE.Group();
  const color = new THREE.Color(lightCfg.color);

  if (lightCfg.type === 'ambient') {
    const torusGeo = new THREE.TorusGeometry(0.2, 0.04, 8, 16);
    const torusMat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    group.add(new THREE.Mesh(torusGeo, torusMat));
    const torus2Geo = new THREE.TorusGeometry(0.2, 0.04, 8, 16);
    const torus2Mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const torus2 = new THREE.Mesh(torus2Geo, torus2Mat);
    torus2.rotation.x = Math.PI / 2;
    group.add(torus2);
    const torus3Geo = new THREE.TorusGeometry(0.2, 0.04, 8, 16);
    const torus3Mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const torus3 = new THREE.Mesh(torus3Geo, torus3Mat);
    torus3.rotation.z = Math.PI / 2;
    group.add(torus3);
  } else if (lightCfg.type === 'directional') {
    const bodyGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.25, 8);
    const bodyMat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    group.add(new THREE.Mesh(bodyGeo, bodyMat));
    const arrowPts = [new THREE.Vector3(0, -0.125, 0), new THREE.Vector3(0, -0.55, 0)];
    const arrowGeo = new THREE.BufferGeometry().setFromPoints(arrowPts);
    const arrowMat = new THREE.LineBasicMaterial({ color });
    group.add(new THREE.Line(arrowGeo, arrowMat));
    const headPts = [
      new THREE.Vector3(-0.06, -0.45, 0), new THREE.Vector3(0, -0.55, 0), new THREE.Vector3(0.06, -0.45, 0),
    ];
    const headGeo = new THREE.BufferGeometry().setFromPoints(headPts);
    const headMat = new THREE.LineBasicMaterial({ color });
    group.add(new THREE.Line(headGeo, headMat));
    const raysPts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      raysPts.push(new THREE.Vector3(Math.cos(a) * 0.25, -0.55, Math.sin(a) * 0.25));
      raysPts.push(new THREE.Vector3(Math.cos(a) * 0.35, -0.65, Math.sin(a) * 0.35));
    }
    const raysGeo = new THREE.BufferGeometry().setFromPoints(raysPts);
    const raysMat = new THREE.LineBasicMaterial({ color });
    group.add(new THREE.LineSegments(raysGeo, raysMat));
  } else {
    const sphereGeo = new THREE.SphereGeometry(0.1, 10, 10);
    const sphereMat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    group.add(new THREE.Mesh(sphereGeo, sphereMat));
    const rayLen = 0.25;
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    const raysPts: THREE.Vector3[] = [];
    for (const d of dirs) {
      raysPts.push(new THREE.Vector3(d[0] * 0.1, d[1] * 0.1, d[2] * 0.1));
      raysPts.push(new THREE.Vector3(d[0] * rayLen, d[1] * rayLen, d[2] * rayLen));
    }
    const raysGeo = new THREE.BufferGeometry().setFromPoints(raysPts);
    const raysMat = new THREE.LineBasicMaterial({ color });
    group.add(new THREE.LineSegments(raysGeo, raysMat));
  }

  group.userData = { id: lightCfg.id, type: 'light', lightType: lightCfg.type };
  return group;
}

export function updateLightVisualColor(group: THREE.Group, color: string) {
  const threeColor = new THREE.Color(color);
  group.traverse(child => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.material.color.copy(threeColor);
    }
    if (child instanceof THREE.Line && child.material instanceof THREE.LineBasicMaterial) {
      child.material.color.copy(threeColor);
    }
    if (child instanceof THREE.LineSegments && child.material instanceof THREE.LineBasicMaterial) {
      child.material.color.copy(threeColor);
    }
  });
}

export function syncLights(project: DirectingProject, deps: LightSyncDeps): void {
  if (!deps.scene) return;

  const lightsToRemove: THREE.Object3D[] = [];
  deps.scene.children.forEach(child => {
    if (child instanceof THREE.Light && child.name !== '__defaultFloorLight__') {
      lightsToRemove.push(child);
    }
  });
  lightsToRemove.forEach(l => deps.scene.remove(l));

  project.lights.forEach((lightCfg) => {
    let threeLight: THREE.Light;
    if (lightCfg.type === 'ambient') {
      threeLight = new THREE.AmbientLight(lightCfg.color, lightCfg.intensity);
    } else if (lightCfg.type === 'directional') {
      const dirLight = new THREE.DirectionalLight(lightCfg.color, lightCfg.intensity);
      dirLight.position.set(lightCfg.position.x, lightCfg.position.y, lightCfg.position.z);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.001;
      threeLight = dirLight;
    } else {
      const ptLight = new THREE.PointLight(lightCfg.color, lightCfg.intensity, 20);
      ptLight.position.set(lightCfg.position.x, lightCfg.position.y, lightCfg.position.z);
      ptLight.castShadow = true;
      threeLight = ptLight;
    }

    threeLight.userData = { id: lightCfg.id, type: 'light' };
    threeLight.visible = lightCfg.visible !== false;
    deps.scene.add(threeLight);

    if (project.viewMode === '3D') {
      let visualGroup = deps.lightVisuals.get(lightCfg.id);
      const existingType = visualGroup?.userData?.lightType;
      if (!visualGroup || existingType !== lightCfg.type) {
        if (visualGroup) {
          deps.detachFn(visualGroup);
          deps.scene.remove(visualGroup);
        }
        visualGroup = createLightVisual(lightCfg);
        deps.lightVisuals.set(lightCfg.id, visualGroup);
      } else {
        updateLightVisualColor(visualGroup, lightCfg.color);
      }
      visualGroup.position.set(lightCfg.position.x, lightCfg.position.y, lightCfg.position.z);
      visualGroup.visible = lightCfg.visible !== false;
      deps.scene.add(visualGroup);
    }
  });

  deps.lightVisuals.forEach((group, id) => {
    if (!project.lights.some(l => l.id === id) || project.viewMode !== '3D') {
      deps.detachFn(group);
      deps.scene.remove(group);
      deps.lightVisuals.delete(id);
    }
  });
}
