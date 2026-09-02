import { type Ref, onUnmounted } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createProceduralMannequin } from '@/utils/director3DMannequinFactory';
import {
  computePosition,
  inferPreset,
  type HorizontalKey,
  type VerticalKey,
  type ShotSizeKey,
} from '@/composables/director-3d/canvas/useCameraPresets';

const DEFAULT_TARGET = { x: 0, y: 1.2, z: 0 };

export interface CameraPreviewOptions {
  onInferred?: (h: HorizontalKey, v: VerticalKey, shot: ShotSizeKey) => void;
}

export function useCameraPreview(
  containerRef: Ref<HTMLElement | null>,
  opts: CameraPreviewOptions = {},
) {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let previewCamera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let animId = 0;
  let initialized = false;

  function init() {
    if (initialized) return;
    const el = containerRef.value;
    if (!el) return;
    initialized = true;

    const w = el.clientWidth || 340;
    const h = el.clientHeight || 400;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0f12');

    previewCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500);
    previewCamera.position.set(0, 2.2, 7.5);
    previewCamera.lookAt(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);

    controls = new OrbitControls(previewCamera, renderer.domElement);
    controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minDistance = 1;
    controls.maxDistance = 25;
    controls.addEventListener('end', onControlsEnd);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 8, 5);
    scene.add(dir);

    scene.add(new THREE.GridHelper(20, 20, '#3b4252', '#2e3440'));
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    const mannequin = createProceduralMannequin(
      {
        id: 'preview_dummy', name: '', position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
        color: '#74b9ff', visible: true, joints: {} as any, style: 'simple',
      },
      false,
    );
    scene.add(mannequin);

    animate();
  }

  function animate() {
    if (!renderer || !scene || !previewCamera || !controls) return;
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, previewCamera);
  }

  function updateViewpoint(h: HorizontalKey, v: VerticalKey, shot: ShotSizeKey) {
    if (!previewCamera || !controls) return;
    const result = computePosition(h, v, shot, DEFAULT_TARGET);
    previewCamera.position.set(result.position.x, result.position.y, result.position.z);
    controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
    previewCamera.lookAt(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
    previewCamera.fov = result.fov;
    previewCamera.updateProjectionMatrix();
    controls.update();
  }

  function onControlsEnd() {
    if (!previewCamera || !opts.onInferred) return;
    const pos = {
      x: previewCamera.position.x,
      y: previewCamera.position.y,
      z: previewCamera.position.z,
    };
    const { hKey, vKey, shotKey } = inferPreset(pos, DEFAULT_TARGET);
    opts.onInferred(hKey, vKey, shotKey);
  }

  function updateFov(fov: number) {
    if (!previewCamera) return;
    previewCamera.fov = fov;
    previewCamera.updateProjectionMatrix();
  }

  function resize() {
    const el = containerRef.value;
    if (!el || !renderer || !previewCamera) return;
    const w = el.clientWidth || 340;
    const h = el.clientHeight || 400;
    renderer.setSize(w, h);
    previewCamera.aspect = w / h;
    previewCamera.updateProjectionMatrix();
  }

  function dispose() {
    cancelAnimationFrame(animId);
    initialized = false;
    if (controls) {
      controls.removeEventListener('end', onControlsEnd);
      controls.dispose();
    }
    renderer?.dispose();
    if (renderer?.domElement && containerRef.value) {
      try { containerRef.value.removeChild(renderer.domElement); } catch {}
    }
    scene?.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      if ((obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    });
    renderer = null;
    scene = null;
    previewCamera = null;
    controls = null;
  }

  onUnmounted(dispose);

  return { init, updateViewpoint, updateFov, resize, dispose };
}
