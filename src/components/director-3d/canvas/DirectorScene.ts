import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DirectingProject, JointRotation, MannequinObject, ImagePlaneObject, CameraConfig, LightConfig, MannequinJoints } from '@/components/director-3d/director3D.types';

import { clampJointRotation } from '@/utils/director3DAnatomy';
import { RigControllerManager } from './RigControllerManager';
import { generateSnapshot as generateSnapshotFn, generateThumbnail as generateThumbnailFn, type SnapshotDeps } from './DirectorSceneSnapshot';
import { syncNameTags as syncNameTagsFn, disposeNameTags as disposeNameTagsFn, type NameTagDeps } from './DirectorSceneNameTag';
import { syncLights as syncLightsFn, type LightSyncDeps } from './DirectorSceneLightSync';
import { syncCameras as syncCamerasFn, type CameraSyncDeps } from './DirectorSceneCameraSync';
import { syncImagePlanes as syncImagePlanesFn, type ImageSyncDeps } from './DirectorSceneImageSync';
import { syncMannequins as syncMannequinsFn, type MannequinSyncDeps, getRetargetDiffQ as getRetargetDiffQFn } from './DirectorSceneMannequinSync';
import { selectElementAtMouse as selectElementAtMouseFn, type SelectionDeps } from './DirectorSceneSelection';
import { stepAnimations as stepAnimationsFn, type AnimationDeps } from './DirectorSceneAnimation';
import { getGLBFromDB } from '@/utils/director3DGlbStorage';
import { safeJsonStringify } from '@/utils/director3DSerialization';
import { processAndAddGlbScene, getDummyWorldQuaternion } from '@/utils/director3DSkeletalMapper';
import { createProceduralMannequin } from '@/utils/director3DMannequinFactory';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export class DirectorScene {
  // WebGL & core ThreeJS elements
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public editorCamera!: THREE.Camera;
  public controls!: OrbitControls;
  public transformControls!: TransformControls;
  public pipRenderer: THREE.WebGLRenderer | null = null;

  // Cache and scene collections
  public mannequinMeshes = new Map<string, THREE.Group>();
  public imagePlaneMeshes = new Map<string, THREE.Mesh>();
  public cameraVisuals = new Map<string, THREE.Group>();
  public lightVisuals = new Map<string, THREE.Group>();
  private nameTagSprites = new Map<string, THREE.Sprite>();
  public gridHelper: THREE.GridHelper | null = null;
  public floorMesh: THREE.Mesh | null = null;
  public groundGroup: THREE.Group | null = null;
  public groupGizmo: THREE.Group | null = null;

  private rigControllerManager = new RigControllerManager();

  // Intermediary transform metrics
  public groupInitialPositions = new Map<string, THREE.Vector3>();
  public groupInitialRotations = new Map<string, THREE.Vector3>();
  public groupInitialScales = new Map<string, THREE.Vector3>();
  public groupGizmoInitialPos = new THREE.Vector3();
  public groupGizmoInitialRot = new THREE.Euler();
  public groupGizmoInitialScale = new THREE.Vector3(1, 1, 1);

  // Loading and texture cache pools
  private textureLoader = new THREE.TextureLoader();
  private textureCache = new Map<string, THREE.Texture>();
  private loadedGlbTemplates = new Map<string, any>();
  private loadingUrls = new Set<string>();

  // State markers
  private glbLoadedCounter = 0;
  private lastThrottleUpdate = 0;
  public isDragging = false;
  public justFinishedDraggingGizmo = false;
  public previouslyAttachedObject: THREE.Object3D | null = null;
  public onGlbLoaded?: () => void;

  constructor() {}

  /**
   * Initialize ThreeJS scene, lights, orbit rules, and transformation gizmo attachments
   */
  public initialize(container: HTMLDivElement, canvas: HTMLCanvasElement, onObjectChanged: (event: any) => void, onObjectDrag: (dragged: boolean) => void) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101216');
    this.scene.fog = new THREE.FogExp2('#101216', 0.0005);

    const width = container.clientWidth;
    const height = container.clientHeight;
    this.editorCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.editorCamera.position.set(0, 3, 8);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.editorCamera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
    this.controls.minDistance = 0.01;
    this.controls.maxDistance = 100000;
    this.controls.target.set(0, 1.5, 0);

    this.transformControls = new TransformControls(this.editorCamera, this.renderer.domElement);
    this.scene.add(this.transformControls.getHelper());

    this.groupGizmo = new THREE.Group();
    this.groupGizmo.userData = { id: '', type: 'groupGizmo' };
    this.scene.add(this.groupGizmo);

    this.transformControls.translationSnap = null;
    this.transformControls.rotationSnap = null;
    this.transformControls.scaleSnap = null;

    // Gizmo Event Handlers
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
      if (event.value === true) {
        this.isDragging = true;
        onObjectDrag(true);
      } else {
        this.isDragging = false;
        onObjectChanged({ force: true });
        this.justFinishedDraggingGizmo = true;
        setTimeout(() => {
          this.justFinishedDraggingGizmo = false;
        }, 150);
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      const now = performance.now();
      if (now - this.lastThrottleUpdate < 60) {
        return;
      }
      this.lastThrottleUpdate = now;
      onObjectChanged({ force: false });
    });

    // Default Scene Ground setup
    this.groundGroup = new THREE.Group();
    this.groundGroup.userData = { id: 'ground', type: 'ground' };
    this.scene.add(this.groundGroup);

    this.gridHelper = new THREE.GridHelper(80, 80, '#4b6584', '#2c3e50');
    this.gridHelper.position.y = 0;
    this.groundGroup.add(this.gridHelper);

    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#080a0d',
      roughness: 0.9,
      metalness: 0.1,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.groundGroup.add(this.floorMesh);
  }

  /**
   * Resizes viewport rendering buffers
   */
  public resize(width: number, height: number) {
    if (width === 0 || height === 0) return;
    if (this.editorCamera instanceof THREE.PerspectiveCamera) {
      this.editorCamera.aspect = width / height;
    } else if (this.editorCamera instanceof THREE.OrthographicCamera) {
      const size = (this.editorCamera.top - this.editorCamera.bottom) / 2;
      this.editorCamera.left = -size * (width / height);
      this.editorCamera.right = size * (width / height);
      this.editorCamera.top = size;
      this.editorCamera.bottom = -size;
    }
    (this.editorCamera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Sets visible states on all gizmos, indicators and wireframe guides
   */
  public setGizmosAndHelpersVisible(visible: boolean, project: DirectingProject, customEditorCamera: boolean, forceHideGizmo: boolean = false, selectionMode: boolean = false) {
    const effectiveHide = forceHideGizmo || selectionMode;
    if (this.transformControls) {
      const helper = typeof (this.transformControls as any).getHelper === 'function'
        ? (this.transformControls as any).getHelper()
        : null;

      if (effectiveHide) {
        (this.transformControls as any).visible = false;
        if (helper) {
          helper.visible = false;
        }
      } else {
        (this.transformControls as any).visible = true;
        if (helper) {
          helper.visible = true;
        }
      }
    }

    if (this.gridHelper) {
      this.gridHelper.visible = visible && project.showGrid;
    }

    this.cameraVisuals.forEach((camGroup, id) => {
      if (!visible) {
        camGroup.visible = false;
      } else {
        const isViewingThis = !customEditorCamera && project.activeCameraId === id;
        const activeCam = project.cameras.find(c => c.id === id);
        camGroup.visible = project.viewMode === '3D' && !isViewingThis && (activeCam ? activeCam.visible : true);
      }
    });

    this.lightVisuals.forEach((litGroup) => {
      litGroup.visible = visible;
    });

    if (this.groupGizmo) {
      this.groupGizmo.visible = true;
    }

    this.mannequinMeshes.forEach((group) => {
      group.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (node.userData.isJoint || (node.name && node.name.endsWith('_helper'))) {
            node.visible = !selectionMode;
          }
        }
        if (node instanceof THREE.Group && node.name === 'global_controller_ring_container') {
          node.visible = visible;
        }
      });
    });
  }

  /**
   * Synchronizes scene lights with reactive project configs
   */
  public syncLights(project: DirectingProject) {
    const deps: LightSyncDeps = {
      scene: this.scene,
      lightVisuals: this.lightVisuals,
      detachFn: (obj) => this.detachIfAttached(obj),
    };
    syncLightsFn(project, deps);
  }

  public syncCameras(project: DirectingProject, selectedElementId: string | null, customEditorCamera: boolean) {
    const deps: CameraSyncDeps = {
      scene: this.scene,
      renderer: this.renderer,
      editorCamera: this.editorCamera,
      controls: this.controls,
      cameraVisuals: this.cameraVisuals,
      transformControls: this.transformControls,
    };
    syncCamerasFn(project, selectedElementId, customEditorCamera, deps);
    this.editorCamera = deps.editorCamera;
    this.controls.object = deps.controls.object;
  }

  public syncImagePlanes(project: DirectingProject) {
    const deps: ImageSyncDeps = {
      scene: this.scene,
      imagePlaneMeshes: this.imagePlaneMeshes,
      textureCache: this.textureCache,
      detachFn: (obj) => this.detachIfAttached(obj),
    };
    syncImagePlanesFn(project, deps);
  }

  /**
   * Synchronizes the custom 3D playground floor mesh position/scale
   */
  public syncGround(project: DirectingProject) {
    if (!this.groundGroup) return;

    if (project.groundVisible === false) {
      this.groundGroup.visible = false;
    } else {
      this.groundGroup.visible = true;
    }

    if (this.gridHelper) {
      this.gridHelper.visible = project.showGrid !== false;
    }

    const isDraggingThis = this.transformControls?.dragging && this.transformControls.object === this.groundGroup;
    if (isDraggingThis) return;

    if (project.ground) {
      this.groundGroup.position.set(project.ground.position.x, project.ground.position.y, project.ground.position.z);
      this.groundGroup.rotation.set(
        deg2rad(project.ground.rotation.x),
        deg2rad(project.ground.rotation.y),
        deg2rad(project.ground.rotation.z)
      );
      this.groundGroup.scale.set(project.ground.scale.x, project.ground.scale.y, project.ground.scale.z);
    } else {
      this.groundGroup.position.set(0, 0, 0);
      this.groundGroup.rotation.set(0, 0, 0);
      this.groundGroup.scale.set(1, 1, 1);
    }
  }

  public getRetargetDiffQ(item: THREE.Object3D, groupName: string): THREE.Quaternion {
    return getRetargetDiffQFn(item, groupName);
  }

  public syncMannequins(
    project: DirectingProject,
    selectedElementId: string | null,
    selectedElementType: string | null = null,
    selectedJointKey: keyof MannequinJoints | null = null,
    hideHelpers: boolean = false
  ) {
    const deps: MannequinSyncDeps = {
      scene: this.scene,
      mannequinMeshes: this.mannequinMeshes,
      transformControls: this.transformControls,
      loadedGlbTemplates: this.loadedGlbTemplates,
      loadingUrls: this.loadingUrls,
      glbLoadedCounter: { value: this.glbLoadedCounter },
      rigControllerManager: this.rigControllerManager,
      detachFn: (obj) => this.detachIfAttached(obj),
      onGlbLoaded: this.onGlbLoaded,
    };
    syncMannequinsFn(project, selectedElementId, selectedElementType, selectedJointKey, hideHelpers, deps);
    this.glbLoadedCounter = deps.glbLoadedCounter.value;
  }

  /**
   * Refreshes transform controls attaches based on selections
   */
  private detachIfAttached(obj: THREE.Object3D) {
    if (this.transformControls?.object === obj) {
      this.transformControls.detach();
    }
  }

  private safeAttach(obj: THREE.Object3D) {
    if (!obj || !this.isObjectInScene(obj)) return;
    try {
      this.transformControls.attach(obj);
    } catch { /* object may have been removed between check and attach */ }
  }

  public syncTransformGizmoAttachment(
    project: DirectingProject,
    selectedElementId: string | null,
    selectedElementType: string | null,
    selectedJointKey: keyof MannequinJoints | null,
    hideHelpers: boolean,
    customEditorCamera: boolean
  ) {
    if (!this.scene || !this.transformControls) return;
    if (this.isDragging) return;

    this.transformControls.detach();

    if (!selectedElementId || !customEditorCamera) return;

    if (selectedElementType === 'group') {
      const gId = selectedElementId;
      const groupMannequins = project.mannequins.filter(m => m.groupId === gId);
      if (groupMannequins.length > 0 && this.groupGizmo) {
        let sumX = 0, sumY = 0, sumZ = 0;
        groupMannequins.forEach(m => {
          sumX += m.position.x;
          sumY += m.position.y;
          sumZ += m.position.z;
        });
        const avgX = sumX / groupMannequins.length;
        const avgY = sumY / groupMannequins.length + 0.85;
        const avgZ = sumZ / groupMannequins.length;
        
        this.groupGizmo.position.set(avgX, avgY, avgZ);
        this.groupGizmo.rotation.set(0, 0, 0);
        this.groupGizmo.scale.set(1, 1, 1);
        this.groupGizmo.updateMatrixWorld(true);

        if (this.isObjectInScene(this.groupGizmo)) {
          this.safeAttach(this.groupGizmo);
        }
      }
      return;
    }

    const elementType = selectedElementId === 'ground' ? 'ground' :
      (this.mannequinMeshes.has(selectedElementId) ? 'mannequin'
        : (this.imagePlaneMeshes.has(selectedElementId) ? 'image'
          : (this.cameraVisuals.has(selectedElementId) ? 'camera'
            : 'light')));

    this.transformControls.space = 'world';

    if (elementType === 'mannequin') {
      const mainGroup = this.mannequinMeshes.get(selectedElementId);
      if (mainGroup) {
        if (selectedJointKey) {
          const jointNode = mainGroup.getObjectByName(selectedJointKey);
          if (jointNode && this.isObjectInScene(jointNode)) {
            this.safeAttach(jointNode);
            this.transformControls.setMode('rotate');
            this.transformControls.space = 'local';
          }
        } else if (this.isObjectInScene(mainGroup)) {
          this.safeAttach(mainGroup);
        }
      }
    } else if (elementType === 'image') {
      const imgMesh = this.imagePlaneMeshes.get(selectedElementId);
      if (imgMesh && this.isObjectInScene(imgMesh)) {
        this.safeAttach(imgMesh);
      }
    } else if (elementType === 'camera') {
      const currCam = project.cameras.find(c => c.id === selectedElementId);
      if (currCam && currCam.locked) {
        this.transformControls.detach();
      } else {
        const camGroup = this.cameraVisuals.get(selectedElementId);
        if (camGroup && this.isObjectInScene(camGroup)) {
          this.safeAttach(camGroup);
        }
      }
    } else if (elementType === 'ground') {
      if (this.groundGroup && this.isObjectInScene(this.groundGroup)) {
        this.safeAttach(this.groundGroup);
      }
    } else if (elementType === 'light') {
      const litGroup = this.lightVisuals.get(selectedElementId);
      if (litGroup && this.isObjectInScene(litGroup)) {
        this.safeAttach(litGroup);
      }
    }
  }

  private isObjectInScene(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current === this.scene) return true;
      current = current.parent;
    }
    return false;
  }

  public stepAnimations(project: DirectingProject) {
    const deps: AnimationDeps = {
      mannequinMeshes: this.mannequinMeshes,
      transformControls: this.transformControls,
    };
    stepAnimationsFn(project, deps);
  }

  public syncNameTags(project: DirectingProject) {
    const deps: NameTagDeps = { scene: this.scene, mannequinMeshes: this.mannequinMeshes };
    syncNameTagsFn(project, this.nameTagSprites, deps);
  }

  private disposeNameTags() {
    disposeNameTagsFn(this.nameTagSprites);
  }

  public selectElementAtMouse(
    mouseX: number,
    mouseY: number,
    canvasWidth: number,
    canvasHeight: number,
    project: DirectingProject,
    customEditorCamera: boolean,
    selectionMode: boolean = false
  ): { id: string; type: any; jointName?: string } | null {
    const deps: SelectionDeps = {
      editorCamera: this.editorCamera,
      scene: this.scene,
      mannequinMeshes: this.mannequinMeshes,
      imagePlaneMeshes: this.imagePlaneMeshes,
      cameraVisuals: this.cameraVisuals,
      lightVisuals: this.lightVisuals,
      groundGroup: this.groundGroup,
      buildSceneCamera: (camObj, aspect) => this.buildSceneCamera(camObj, aspect),
    };
    return selectElementAtMouseFn(mouseX, mouseY, canvasWidth, canvasHeight, project, customEditorCamera, selectionMode, deps);
  }

  /**
   * Generates screenshot frames from selected active cameras boundaries
   */
  public parseAspectRatio(ratio: string | undefined): number {
    if (!ratio || ratio === 'auto') return 16 / 9;
    const parts = ratio.split(':');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) return w / h;
    }
    return 16 / 9;
  }

  public buildSceneCamera(camObj: CameraConfig, aspect: number): THREE.Camera {
    const near = Math.max(0.001, camObj.near ?? 0.1);
    const far = camObj.far ?? 5000;
    if (camObj.cameraType === 'orthographic') {
      const size = camObj.orthoSize ?? 5;
      const halfH = size;
      const halfW = size * aspect;
      const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
      cam.position.set(camObj.position.x, camObj.position.y, camObj.position.z);
      cam.lookAt(camObj.target.x, camObj.target.y, camObj.target.z);
      cam.updateProjectionMatrix();
      return cam;
    }
    const cam = new THREE.PerspectiveCamera(camObj.fov, aspect, near, far);
    const fl = camObj.focalLength ?? 50;
    cam.setFocalLength(fl);
    cam.position.set(camObj.position.x, camObj.position.y, camObj.position.z);
    cam.lookAt(camObj.target.x, camObj.target.y, camObj.target.z);
    cam.updateProjectionMatrix();
    return cam;
  }

  private buildSnapshotDeps(): SnapshotDeps {
    return {
      scene: this.scene,
      imagePlaneMeshes: this.imagePlaneMeshes,
      textureCache: this.textureCache,
      groundGroup: this.groundGroup,
      setGizmosAndHelpersVisible: this.setGizmosAndHelpersVisible.bind(this),
      buildSceneCamera: this.buildSceneCamera.bind(this),
      parseAspectRatio: this.parseAspectRatio.bind(this),
    };
  }

  public async generateSnapshot(project: DirectingProject): Promise<string | null> {
    return generateSnapshotFn(project, this.buildSnapshotDeps());
  }

  public generateThumbnail(project: DirectingProject): string {
    return generateThumbnailFn(project, this.buildSnapshotDeps());
  }

  /**
   * Safe destructor unloading buffer maps and control loops
   */
  public dispose() {
    if (this.transformControls) this.transformControls.dispose();
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    if (this.pipRenderer) {
      this.pipRenderer.dispose();
      this.pipRenderer.forceContextLoss();
    }
    
    this.mannequinMeshes.clear();
    this.imagePlaneMeshes.clear();
    this.cameraVisuals.clear();
    this.lightVisuals.clear();
    this.disposeNameTags();
    this.textureCache.forEach(t => t.dispose());
    this.textureCache.clear();
  }
}
