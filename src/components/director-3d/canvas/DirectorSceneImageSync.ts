import * as THREE from 'three';
import type { DirectingProject } from '@/components/director-3d/director3D.types';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export interface ImageSyncDeps {
  scene: THREE.Scene;
  imagePlaneMeshes: Map<string, THREE.Mesh>;
  textureCache: Map<string, THREE.Texture>;
  detachFn: (obj: THREE.Object3D) => void;
}

function updateMeshTexture(
  mesh: THREE.Mesh,
  url: string,
  imgObjVisible: boolean,
  isPano: boolean,
  textureCache: Map<string, THREE.Texture>,
): void {
  if (!url) {
    mesh.visible = false;
    return;
  }
  const imageUrl = url;
  const cached = textureCache.get(imageUrl);
  if (cached) {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.map = cached;
      mesh.material.color.set('#ffffff');
      mesh.material.needsUpdate = true;
    }
    mesh.visible = imgObjVisible;
  } else {
    if (mesh.material instanceof THREE.MeshBasicMaterial) {
      mesh.material.color.set('#1a1f26');
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const loadedTex = new THREE.Texture(img);
      loadedTex.needsUpdate = true;
      if ('colorSpace' in loadedTex) {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
      }
      if (isPano) {
        loadedTex.wrapS = THREE.RepeatWrapping;
        loadedTex.wrapT = THREE.ClampToEdgeWrapping;
        loadedTex.minFilter = THREE.LinearFilter;
        loadedTex.magFilter = THREE.LinearFilter;
        loadedTex.generateMipmaps = false;
      }
      textureCache.set(imageUrl, loadedTex);
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.map = loadedTex;
        mesh.material.color.set('#ffffff');
        mesh.material.needsUpdate = true;
      }
      mesh.visible = imgObjVisible;
    };
    img.onerror = () => {
      console.warn('Failed to load image texture:', imageUrl);
      mesh.visible = false;
    };
  }
}

export function syncImagePlanes(project: DirectingProject, deps: ImageSyncDeps): void {
  if (!deps.scene) return;

  project.imagePlanes.forEach((imgObj) => {
    if (!imgObj.visible) {
      const existingMesh = deps.imagePlaneMeshes.get(imgObj.id);
      if (existingMesh) {
        deps.detachFn(existingMesh);
        deps.scene.remove(existingMesh);
      }
      return;
    }

    let imgMesh = deps.imagePlaneMeshes.get(imgObj.id);
    const isPano = imgObj.renderMode === '360-Panoramic';
    const targetGeomType = isPano ? 'sphere' : 'plane';

    if (imgMesh && imgMesh.userData.geomType !== targetGeomType) {
      deps.detachFn(imgMesh);
      deps.scene.remove(imgMesh);
      deps.imagePlaneMeshes.delete(imgObj.id);
      imgMesh = undefined;
    }

    if (!imgMesh) {
      const geo = isPano 
        ? new THREE.SphereGeometry(60, 32, 24)
        : new THREE.PlaneGeometry(1, 1);
      
      const side = isPano ? THREE.BackSide : THREE.DoubleSide;

      let blending: THREE.Blending = THREE.NormalBlending;
      let premultipliedAlpha = false;
      if (imgObj.blendMode === 'multiply') {
        blending = THREE.MultiplyBlending;
        premultipliedAlpha = true;
      }
      if (imgObj.blendMode === 'screen') blending = THREE.AdditiveBlending;

      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: imgObj.opacity,
        side,
        depthWrite: imgObj.blendMode === 'normal' && !isPano,
        blending,
        premultipliedAlpha,
        fog: !isPano,
      });

      imgMesh = new THREE.Mesh(geo, mat);
      imgMesh.userData = { id: imgObj.id, type: 'image', geomType: targetGeomType };
      deps.imagePlaneMeshes.set(imgObj.id, imgMesh);

      updateMeshTexture(imgMesh, imgObj.url, imgObj.visible, isPano, deps.textureCache);
    }

    if (imgMesh.material instanceof THREE.MeshBasicMaterial) {
      imgMesh.material.opacity = imgObj.opacity;
      let blending: THREE.Blending = THREE.NormalBlending;
      let premultipliedAlpha = false;
      if (imgObj.blendMode === 'multiply') {
        blending = THREE.MultiplyBlending;
        premultipliedAlpha = true;
      }
      if (imgObj.blendMode === 'screen') blending = THREE.AdditiveBlending;

      let needsUpdate = false;
      if (imgMesh.material.blending !== blending || imgMesh.material.premultipliedAlpha !== premultipliedAlpha) {
        imgMesh.material.blending = blending;
        imgMesh.material.premultipliedAlpha = premultipliedAlpha;
        needsUpdate = true;
      }
      if (imgMesh.material.fog !== !isPano) {
        imgMesh.material.fog = !isPano;
        needsUpdate = true;
      }
      const targetSide = isPano ? THREE.BackSide : THREE.DoubleSide;
      if (imgMesh.material.side !== targetSide) {
        imgMesh.material.side = targetSide;
        needsUpdate = true;
      }
      if (needsUpdate) {
        imgMesh.material.needsUpdate = true;
      }
      updateMeshTexture(imgMesh, imgObj.url, imgObj.visible, isPano, deps.textureCache);
    }

    if (isPano) {
      const s = imgObj.scale.x ?? 1;
      imgMesh.scale.set(-s, s, s);
    } else {
      imgMesh.scale.set(imgObj.scale.x, imgObj.scale.y, imgObj.scale.z);
    }

    if (isPano) {
      imgMesh.position.set(imgObj.position.x, imgObj.position.y, imgObj.position.z);
      imgMesh.rotation.set(
        deg2rad(imgObj.rotation.x),
        deg2rad(imgObj.rotation.y),
        deg2rad(imgObj.rotation.z)
      );
    } else if (imgObj.renderMode === '3D') {
      imgMesh.position.set(imgObj.position.x, imgObj.position.y, imgObj.position.z);
      imgMesh.rotation.set(
        deg2rad(imgObj.rotation.x),
        deg2rad(imgObj.rotation.y),
        deg2rad(imgObj.rotation.z)
      );
    } else {
      const currentActiveCamObj = project.cameras.find(c => c.id === project.activeCameraId);
      if (currentActiveCamObj) {
        const camPos = new THREE.Vector3(currentActiveCamObj.position.x, currentActiveCamObj.position.y, currentActiveCamObj.position.z);
        const camTar = new THREE.Vector3(currentActiveCamObj.target.x, currentActiveCamObj.target.y, currentActiveCamObj.target.z);
        const dir = new THREE.Vector3().subVectors(camTar, camPos).normalize();

        const distance = imgObj.renderMode === '2D-Background' ? 12.0 : 1.5;
        const targetPos = new THREE.Vector3().addVectors(camPos, dir.clone().multiplyScalar(distance));

        imgMesh.position.copy(targetPos);
        imgMesh.lookAt(camPos);

        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(right, dir).normalize();

        imgMesh.position.add(right.multiplyScalar(imgObj.position.x * (distance * 0.15)));
        imgMesh.position.add(up.multiplyScalar(imgObj.position.y * (distance * 0.15)));
      } else {
        imgMesh.position.set(imgObj.position.x, imgObj.position.y, imgObj.position.z);
      }
    }

    deps.scene.add(imgMesh);
  });

  deps.imagePlaneMeshes.forEach((mesh, id) => {
    if (!project.imagePlanes.some(img => img.id === id)) {
      deps.detachFn(mesh);
      deps.scene.remove(mesh);
      deps.imagePlaneMeshes.delete(id);
    }
  });
}
