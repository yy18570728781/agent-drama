/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface JointRotation {
  x: number; // Pitch
  y: number; // Yaw
  z: number; // Roll
}

export interface MannequinJoints {
  head: JointRotation;
  chest: JointRotation;
  pelvis: JointRotation;
  
  // Left arm
  leftShoulder: JointRotation;
  leftElbow: JointRotation;
  leftWrist: JointRotation;
  
  // Right arm
  rightShoulder: JointRotation;
  rightElbow: JointRotation;
  rightWrist: JointRotation;
  
  // Left leg
  leftHip: JointRotation;
  leftKnee: JointRotation;
  leftAnkle: JointRotation;
  
  // Right leg
  rightHip: JointRotation;
  rightKnee: JointRotation;
  rightAnkle: JointRotation;
}

export interface MannequinObject {
  id: string;
  name: string;
  position: Vector3D;
  rotation: Vector3D;
  scale: Vector3D;
  color: string;
  visible: boolean;
  joints: MannequinJoints;
  style?: 'detailed' | 'simple' | 'cube' | 'cone' | 'sphere' | 'glb';
  glbId?: string;
  glbUrl?: string;
  showLabel?: boolean;
  groupId?: string;
  groupName?: string;
  isGeneratedByArray?: boolean;
  jointTranslations?: Record<string, Vector3D>;
  jointScales?: Record<string, Vector3D>;
  animation?: 'none' | 'idle' | 'walk' | 'run' | 'dance' | 'wave';
  animationSpeed?: number;
  upstreamNodeId?: string;
  controllerScale?: number;
}

export interface ImagePlaneObject {
  id: string;
  name: string;
  url: string; // dataUrl or public url
  position: Vector3D;
  rotation: Vector3D; // absolute orientation in 3D
  scale: Vector3D;
  opacity: number;
  blendMode: BlendMode;
  renderMode: '3D' | '2D-Overlay' | '2D-Background' | '360-Panoramic';
  visible: boolean;
  zIndex: number; // For 2D layering standard
  groupId?: string;
  groupName?: string;
  upstreamNodeId?: string;
}

export interface CameraConfig {
  id: string;
  name: string;
  position: Vector3D;
  target: Vector3D;
  fov: number;
  aspect: number;
  near: number;
  far: number;
  visible: boolean;
  locked?: boolean;
  groupId?: string;
  groupName?: string;
  lookAtTargetId?: string;
  focalLength?: number;
  cameraType?: 'perspective' | 'orthographic';
  orthoSize?: number;
  exposure?: number;
  toneMapping?: 'ACESFilmic' | 'Linear' | 'Reinhard' | 'Cineon' | 'AgX';
}

export interface LightConfig {
  id: string;
  name: string;
  type: 'ambient' | 'directional' | 'point';
  color: string;
  intensity: number;
  position: Vector3D;
  rotation?: Vector3D;
  scale?: Vector3D;
  visible?: boolean;
  groupId?: string;
  groupName?: string;
}

export interface GroupItem {
  id: string;
  name: string;
}

export interface DirectingProject {
  id: string;
  name: string;
  createdAt: string;
  mannequins: MannequinObject[];
  imagePlanes: ImagePlaneObject[];
  cameras: CameraConfig[];
  lights: LightConfig[];
  groups?: GroupItem[];
  ground?: {
    position: Vector3D;
    rotation: Vector3D;
    scale: Vector3D;
  };
  activeCameraId: string; // The camera we are looking through or editing
  viewMode: '3D' | '2D'; // '3D' mode shows grid, scene controls. '2D' is Nuke final composite.
  showGrid: boolean;
  showSubViewer: boolean;
  showCrowdLabels?: boolean;
  hideHelpers?: boolean;
  selectionMode?: boolean;
  aspectRatio?: string;
  groundVisible?: boolean;
}
