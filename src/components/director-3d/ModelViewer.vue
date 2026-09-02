<template>
  <div ref="container" class="w-full h-full relative bg-zinc-950">
    <!-- Loading State -->
    <div v-if="isLoading" class="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/80 backdrop-blur-md">
      <div class="flex flex-col items-center justify-center p-6 rounded-2xl border border-white/10 shadow-2xl">
        <svg class="w-10 h-10 text-emerald-400 animate-spin mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div class="text-white font-medium tracking-wide">Loading Model...</div>
        <div class="text-zinc-400 text-sm mt-2">{{ progress.toFixed(0) }}%</div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl backdrop-blur-md max-w-md text-center pointer-events-auto">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const props = defineProps<{
  url: string;
  fileMap?: Map<string, File>;
  renderMode?: string;
  wireframeColor?: string | null;
  singleSided?: boolean;
  backgroundColor?: string;
  lightIntensity?: number;
}>();

const createChannelMaterial = (map: THREE.Texture | null | undefined, channel: 'r' | 'g' | 'b', fallbackValue: number, side: THREE.Side) => {
  if (!map) {
    const val = Math.floor(fallbackValue * 255);
    return new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(`rgb(${val},${val},${val})`),
      side: side
    });
  }
  
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: map }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec4 texColor = texture2D(tDiffuse, vUv);
        float val = texColor.${channel};
        gl_FragColor = vec4(val, val, val, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: side
  });
};

const createCheckerboardTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1024, 1024);
    context.fillStyle = '#cccccc';
    const numSquares = 16;
    const squareSize = 1024 / numSquares;
    for (let i = 0; i < numSquares; i++) {
      for (let j = 0; j < numSquares; j++) {
        if ((i + j) % 2 === 0) {
          context.fillRect(i * squareSize, j * squareSize, squareSize, squareSize);
        }
      }
    }
    context.fillStyle = '#ff0000';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let i = 0; i < numSquares; i++) {
      for (let j = 0; j < numSquares; j++) {
        context.fillText(`${i},${j}`, i * squareSize + squareSize / 2, j * squareSize + squareSize / 2);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createMatcapTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#888888');
    gradient.addColorStop(1, '#222222');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const checkerTexture = createCheckerboardTexture();
const matcapTexture = createMatcapTexture();

const container = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const progress = ref(0);
const error = ref<string | null>(null);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let currentModel: THREE.Group | null = null;
let objectURLs: string[] = [];

let lightGroup: THREE.Group;
let mainLight: THREE.DirectionalLight;
let fillLight: THREE.DirectionalLight;
let ambientLight: THREE.AmbientLight;
let pmremGenerator: THREE.PMREMGenerator;
let envMapTexture: THREE.Texture;

let isDraggingLight = false;
let previousMousePosition = { x: 0, y: 0 };

const onPointerDown = (e: PointerEvent) => {
  if (e.altKey && e.button === 0) {
    isDraggingLight = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    if (controls) controls.enabled = false;
  }
};

const onPointerMove = (e: PointerEvent) => {
  if (isDraggingLight && lightGroup) {
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;
    
    lightGroup.rotation.y += deltaX * 0.01;
    lightGroup.rotation.x += deltaY * 0.01;
    
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
};

const onPointerUp = () => {
  if (isDraggingLight) {
    isDraggingLight = false;
    if (controls) controls.enabled = true;
  }
};

const initThree = () => {
  if (!container.value) return;

  scene = new THREE.Scene();
  const bgColor = props.backgroundColor || '#1c1c1c';
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, 10, 30);

  camera = new THREE.PerspectiveCamera(50, container.value.clientWidth / container.value.clientHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  
  // Hunyuan 3D style environment
  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  envMapTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMapTexture;
  scene.environmentIntensity = props.lightIntensity !== undefined ? props.lightIntensity : 1.0;
  
  container.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  const intensity = props.lightIntensity !== undefined ? props.lightIntensity : 1.0;

  ambientLight = new THREE.AmbientLight(0xffffff, intensity * 0.5);
  scene.add(ambientLight);

  lightGroup = new THREE.Group();
  scene.add(lightGroup);

  mainLight = new THREE.DirectionalLight(0xffffff, intensity);
  mainLight.position.set(10, 10, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.1;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -10;
  mainLight.shadow.camera.right = 10;
  mainLight.shadow.camera.top = 10;
  mainLight.shadow.camera.bottom = -10;
  mainLight.shadow.bias = -0.0005; // Fix shadow acne
  mainLight.shadow.normalBias = 0.02; // Fix shadow acne
  lightGroup.add(mainLight);

  fillLight = new THREE.DirectionalLight(0xffffff, intensity * 0.2);
  fillLight.position.set(-10, -10, -5);
  lightGroup.add(fillLight);

  const planeGeometry = new THREE.PlaneGeometry(20, 20);
  const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.4 });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1.5;
  plane.receiveShadow = true;
  scene.add(plane);

  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  animate();
};

const loadModel = (modelUrl: string) => {
  if (!modelUrl) return;
  
  isLoading.value = true;
  error.value = null;
  progress.value = 0;

  objectURLs.forEach(URL.revokeObjectURL);
  objectURLs = [];

  const manager = new THREE.LoadingManager();
  
  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    progress.value = (itemsLoaded / itemsTotal) * 100;
  };

  manager.setURLModifier((url) => {
    if (url === modelUrl) return url;
    if (url.startsWith('data:')) return url;
    
    const urlWithoutQuery = url.split('?')[0].split('#')[0];
    const filename = decodeURIComponent(urlWithoutQuery.split('/').pop() || '');
    
    if (props.fileMap && filename && props.fileMap.has(filename)) {
      const file = props.fileMap.get(filename)!;
      const blobUrl = URL.createObjectURL(file);
      objectURLs.push(blobUrl);
      return blobUrl;
    }
    
    return url;
  });

  const loader = new GLTFLoader(manager);
  
  loader.load(
    modelUrl,
    (gltf) => {
      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        });
      }

      currentModel = gltf.scene;
      
      currentModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      const box = new THREE.Box3().setFromObject(currentModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim;
      
      currentModel.scale.setScalar(scale);
      currentModel.position.sub(center.multiplyScalar(scale));
      
      scene.add(currentModel);
      isLoading.value = false;
      
      applyDisplayMode();
      
      if (controls) {
        controls.autoRotate = false;
      }
    },
    (xhr) => {
      if (xhr.total > 0) {
        progress.value = (xhr.loaded / xhr.total) * 100;
      }
    },
    (err) => {
      console.error('Error loading model:', err);
      const errorRecord = typeof err === 'object' && err !== null
        ? err as { message?: unknown; target?: { statusText?: unknown; responseURL?: unknown } }
        : {};
      const detail =
        (typeof errorRecord.message === 'string' ? errorRecord.message : '')
        || (typeof errorRecord.target?.statusText === 'string' ? errorRecord.target.statusText : '')
        || (typeof errorRecord.target?.responseURL === 'string' ? errorRecord.target.responseURL : '')
        || '';
      error.value = detail
        ? `Failed to load model: ${detail}`
        : 'Failed to load model. The URL may be blocked by CORS, require authentication, or not actually return a .glb/.gltf file.';
      isLoading.value = false;
    }
  );
};

const updateWireframeOverlay = () => {
  if (!currentModel) return;
  currentModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (props.wireframeColor) {
        if (!mesh.userData.wireframeLine) {
          const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
          const wireframeMaterial = new THREE.LineBasicMaterial({ 
            color: props.wireframeColor, 
            depthTest: true, 
            opacity: 0.5, 
            transparent: true 
          });
          const line = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
          mesh.add(line);
          mesh.userData.wireframeLine = line;
        } else {
          mesh.userData.wireframeLine.material.color.set(props.wireframeColor);
          mesh.userData.wireframeLine.visible = true;
        }
      } else {
        if (mesh.userData.wireframeLine) {
          mesh.userData.wireframeLine.visible = false;
        }
      }
    }
  });
};

const updateVertexNormals = () => {
  if (!currentModel) return;
  const show = props.renderMode === 'vertexNormals';
  currentModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (show) {
        if (!mesh.userData.normalsHelper) {
          const helper = new VertexNormalsHelper(mesh, 0.1, 0x00ff00);
          mesh.add(helper);
          mesh.userData.normalsHelper = helper;
        } else {
          mesh.userData.normalsHelper.visible = true;
          mesh.userData.normalsHelper.update();
        }
      } else {
        if (mesh.userData.normalsHelper) {
          mesh.userData.normalsHelper.visible = false;
        }
      }
    }
  });
};

const applyDisplayMode = () => {
  if (!currentModel) return;
  
  const side = props.singleSided ? THREE.FrontSide : THREE.DoubleSide;

  currentModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material;
      }
      
      const originalMaterial = mesh.userData.originalMaterial as THREE.MeshStandardMaterial;

      let newMaterial;

      switch (props.renderMode) {
        case 'baseColor':
          newMaterial = new THREE.MeshBasicMaterial({
            map: originalMaterial.map || null,
            color: originalMaterial.map ? 0xffffff : (originalMaterial.color || 0xffffff),
            side: side,
            transparent: originalMaterial.transparent,
            opacity: originalMaterial.opacity,
            alphaTest: originalMaterial.alphaTest
          });
          break;
        case 'normal':
          newMaterial = new THREE.MeshBasicMaterial({
            map: originalMaterial.normalMap || null,
            color: originalMaterial.normalMap ? 0xffffff : 0x8080ff,
            side: side,
          });
          break;
        case 'metalness':
          newMaterial = createChannelMaterial(
            originalMaterial.metalnessMap, 
            'b', 
            originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.0,
            side
          );
          break;
        case 'roughness':
          newMaterial = createChannelMaterial(
            originalMaterial.roughnessMap, 
            'g', 
            originalMaterial.roughness !== undefined ? originalMaterial.roughness : 1.0,
            side
          );
          break;
        case 'emissive':
          newMaterial = new THREE.MeshBasicMaterial({
            map: originalMaterial.emissiveMap || null,
            color: originalMaterial.emissiveMap ? 0xffffff : (originalMaterial.emissive || 0x000000),
            side: side,
          });
          break;
        case 'specular':
          newMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222,
            side: side,
          });
          break;
        case 'matcap':
          newMaterial = new THREE.MeshMatcapMaterial({
            matcap: matcapTexture,
            side: side,
          });
          break;
        case 'matcapSurface':
          newMaterial = new THREE.MeshMatcapMaterial({
            matcap: matcapTexture,
            normalMap: originalMaterial.normalMap || null,
            side: side,
          });
          break;
        case 'clay':
          newMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.8,
            metalness: 0.1,
            side: side,
          });
          break;
        case 'wireframe':
          newMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            side: side,
          });
          break;
        case 'vertexNormals':
          newMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222,
            side: side,
          });
          break;
        case 'uvChecker':
          newMaterial = new THREE.MeshBasicMaterial({
            map: checkerTexture,
            side: side,
          });
          break;
        case 'final':
        default:
          if (originalMaterial.side !== side) {
             newMaterial = originalMaterial.clone();
             newMaterial.side = side;
          } else {
             newMaterial = originalMaterial;
          }
          break;
      }
      
      mesh.material = newMaterial;
    }
  });
  
  updateWireframeOverlay();
  updateVertexNormals();
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
};

const onWindowResize = () => {
  if (!container.value || !camera || !renderer) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
};

watch(() => props.url, (newUrl) => {
  loadModel(newUrl);
});

watch([() => props.renderMode, () => props.singleSided, () => props.wireframeColor], () => {
  applyDisplayMode();
});

watch(() => props.backgroundColor, (newColor) => {
  if (scene && newColor) {
    scene.background = new THREE.Color(newColor);
    scene.fog = new THREE.Fog(newColor, 10, 30);
  }
});

watch(() => props.lightIntensity, (newIntensity) => {
  if (newIntensity !== undefined) {
    if (mainLight) mainLight.intensity = newIntensity;
    if (fillLight) fillLight.intensity = newIntensity * 0.2;
    if (ambientLight) ambientLight.intensity = newIntensity * 0.5;
    if (scene) scene.environmentIntensity = newIntensity;
  }
});

onMounted(() => {
  initThree();
  if (props.url) {
    loadModel(props.url);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  if (animationId) cancelAnimationFrame(animationId);
  if (renderer) {
    renderer.dispose();
    if (container.value && renderer.domElement) {
      container.value.removeChild(renderer.domElement);
    }
  }
  objectURLs.forEach(URL.revokeObjectURL);
});
</script>
