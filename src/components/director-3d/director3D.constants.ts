/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MannequinJoints, DirectingProject, Vector3D } from '@/components/director-3d/director3D.types';

// Zero rotation helper
export const initJointRotation = () => ({ x: 0, y: 0, z: 0 });

export const createDefaultJoints = (): MannequinJoints => ({
  head: initJointRotation(),
  chest: initJointRotation(),
  pelvis: initJointRotation(),
  leftShoulder: { x: 0, y: 0, z: -35 },
  leftElbow: { x: 15, y: 0, z: 0 },
  leftWrist: initJointRotation(),
  rightShoulder: { x: 0, y: 0, z: 35 },
  rightElbow: { x: 15, y: 0, z: 0 },
  rightWrist: initJointRotation(),
  leftHip: initJointRotation(),
  leftKnee: initJointRotation(),
  leftAnkle: initJointRotation(),
  rightHip: initJointRotation(),
  rightKnee: initJointRotation(),
  rightAnkle: initJointRotation(),
});

export interface PosePreset {
  name: string;
  id: string;
  joints: MannequinJoints;
}

export const POSE_PRESETS: PosePreset[] = [
  {
    name: 'A-pose',
    id: 'a-pose',
    joints: {
      head: initJointRotation(), chest: initJointRotation(), pelvis: initJointRotation(),
      leftShoulder: { x: 0, y: 0, z: -35 }, leftElbow: { x: 0, y: 0, z: 0 }, leftWrist: initJointRotation(),
      rightShoulder: { x: 0, y: 0, z: 35 }, rightElbow: { x: 0, y: 0, z: 0 }, rightWrist: initJointRotation(),
      leftHip: initJointRotation(), leftKnee: initJointRotation(), leftAnkle: initJointRotation(),
      rightHip: initJointRotation(), rightKnee: initJointRotation(), rightAnkle: initJointRotation(),
    },
  },
  {
    name: 'T-pose',
    id: 't-pose',
    joints: {
      head: initJointRotation(), chest: initJointRotation(), pelvis: initJointRotation(),
      leftShoulder: { x: 0, y: 0, z: 0 }, leftElbow: { x: 0, y: 0, z: 0 }, leftWrist: initJointRotation(),
      rightShoulder: { x: 0, y: 0, z: 0 }, rightElbow: { x: 0, y: 0, z: 0 }, rightWrist: initJointRotation(),
      leftHip: initJointRotation(), leftKnee: initJointRotation(), leftAnkle: initJointRotation(),
      rightHip: initJointRotation(), rightKnee: initJointRotation(), rightAnkle: initJointRotation(),
    },
  },
];

export interface PresetGlbModel {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
}

export const PRESET_GLB_MODELS: PresetGlbModel[] = [
  {
    id: 'glb_ue_manny',
    name: '小白人',
    url: 'https://aigc-cos.teamones.cn/sm_ai_server/file/glb/e1a465960a086b25.glb',
  },
];

// Placeholder SVG DataURL patterns for templates
export const TEMPLATE_IMAGES = [
  {
    name: '赛博深渊',
    id: 'cyber_abyss',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%230b0214"/><stop offset="50%" stop-color="%231a052e"/><stop offset="100%" stop-color="%23020005"/></linearGradient><linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="%23ff007f" stop-opacity="0.1"/><stop offset="100%" stop-color="%2300f0ff" stop-opacity="0.1"/></linearGradient></defs><rect width="1080" height="720" fill="url(%23bg)"/><path d="M0,720 L300,450 L350,450 L100,720 Z" fill="url(%23g1)"/><path d="M1080,720 L780,450 L730,450 L980,720 Z" fill="url(%23g1)"/><circle cx="540" cy="360" r="150" stroke="%23ff00ff" stroke-width="2" fill="none" opacity="0.3"/><line x1="540" y1="0" x2="540" y2="720" stroke="%2300ffff" stroke-width="1" opacity="0.15"/><line x1="0" y1="360" x2="1080" y2="360" stroke="%2300ffff" stroke-width="1" opacity="0.15"/><text x="540" y="680" fill="%23fff" font-family="sans-serif" font-size="12" letter-spacing="4" text-anchor="middle" opacity="0.4">画 面 合 成 投 影 模 板</text></svg>'
  },
  {
    name: '黄金比例二分构图',
    id: 'golden_composition',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720"><defs><linearGradient id="gridBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23141e30"/><stop offset="100%" stop-color="%23243b55"/></linearGradient></defs><rect width="1080" height="720" fill="url(%23gridBg)"/><line x1="360" y1="0" x2="360" y2="720" stroke="%23fbb03b" stroke-width="1.5" stroke-dasharray="8,8" opacity="0.5"/><line x1="720" y1="0" x2="720" y2="720" stroke="%23fbb03b" stroke-width="1.5" stroke-dasharray="8,8" opacity="0.5"/><line x1="0" y1="240" x2="1080" y2="240" stroke="%23fbb03b" stroke-width="1.5" stroke-dasharray="8,8" opacity="0.5"/><line x1="0" y1="480" x2="1080" y2="480" stroke="%23fbb03b" stroke-width="1.5" stroke-dasharray="8,8" opacity="0.5"/><circle cx="360" cy="240" r="10" fill="%23fbb03b" opacity="0.8"/><circle cx="720" cy="240" r="10" fill="%23fbb03b" opacity="0.8"/><circle cx="360" cy="480" r="10" fill="%23fbb03b" opacity="0.8"/><circle cx="720" cy="480" r="10" fill="%23fbb03b" opacity="0.8"/><text x="50" y="50" fill="%23fff" font-family="sans-serif" font-weight="bold" font-size="20" opacity="0.7">黄 金 比 例 构 图 相 机 模 板</text></svg>'
  },
  {
    name: '前景粒子',
    id: 'anime_dust',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720"><rect width="1080" height="720" fill="none"/><circle cx="100" cy="150" r="5" fill="%2300ffea" opacity="0.9"/><circle cx="250" cy="480" r="8" fill="%2300ffea" opacity="0.6"/><circle cx="850" cy="200" r="12" fill="%23ff0055" opacity="0.8"/><circle cx="920" cy="550" r="6" fill="%23ffb700" opacity="0.9"/><path d="M50,600 Q150,500 300,550 T600,500 T1000,550" fill="none" stroke="%23ff00aa" stroke-width="3" stroke-dasharray="10,5" opacity="0.7"/><polygon points="200,80 205,95 220,95 208,105 212,120 200,110 188,120 192,105 180,95 195,95" fill="%23fff" opacity="0.8"/></svg>'
  },
  {
    name: '绿幕抠像背景',
    id: 'chroma_green',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720"><rect width="1080" height="720" fill="%2300b140"/><circle cx="540" cy="360" r="10" fill="%23fff" opacity="0.5"/><line x1="530" y1="360" x2="550" y2="360" stroke="%23fff" stroke-width="2" opacity="0.5"/><line x1="540" y1="350" x2="540" y2="370" stroke="%23fff" stroke-width="2" opacity="0.5"/><circle cx="140" cy="160" r="8" fill="%23fff" opacity="0.4"/><circle cx="940" cy="560" r="8" fill="%23fff" opacity="0.4"/></svg>'
  }
];

// Helper to formulate a default template project
export const createDefaultProject = (): DirectingProject => {
  return {
    id: 'default_director_project',
    name: '未命名拍摄大底',
    createdAt: new Date().toISOString(),
    mannequins: [
      {
        id: 'mannequin_alice',
        name: '模特甲',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '#ffffff',
        visible: true,
        joints: POSE_PRESETS.find(p => p.id === 'a-pose')?.joints || POSE_PRESETS[0].joints, // Default to A-Pose
      }
    ],
    imagePlanes: [
      {
        id: 'image_cyber',
        name: '赛博都市合成底板',
        url: TEMPLATE_IMAGES[0].url,
        position: { x: 0, y: 2, z: -5 },
        rotation: { x: 0, y: 180, z: 0 }, // Face forward towards main camera
        scale: { x: 10, y: 6.6, z: 1 },
        opacity: 0.8,
        blendMode: 'normal',
        renderMode: '3D',
        visible: true,
        zIndex: 1,
      },
      {
        id: 'image_sparks',
        name: '前景光效粒子',
        url: TEMPLATE_IMAGES[2].url,
        position: { x: 0, y: 2, z: 3 },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 10, y: 6.6, z: 1 },
        opacity: 1.0,
        blendMode: 'screen',
        renderMode: '2D-Overlay',
        visible: true,
        zIndex: 5,
      }
    ],
    cameras: [
      {
        id: 'cam_director_main',
        name: '电影主摄影机',
        position: { x: 0, y: 2.2, z: 7.5 },
        target: { x: 0, y: 1.8, z: 0 },
        fov: 42,
        aspect: 16 / 9,
        near: 0.1,
        far: 5000,
        visible: true,
        focalLength: 50,
        cameraType: 'perspective',
        orthoSize: 5,
        exposure: 1.0,
        toneMapping: 'ACESFilmic',
      },
      {
        id: 'cam_director_portrait',
        name: '特写辅助机',
        position: { x: 2.5, y: 2.8, z: 4.0 },
        target: { x: 0, y: 2.2, z: 0 },
        fov: 30,
        aspect: 16 / 9,
        near: 0.1,
        far: 5000,
        visible: true,
        focalLength: 50,
        cameraType: 'perspective',
        orthoSize: 5,
        exposure: 1.0,
        toneMapping: 'ACESFilmic',
      },
      {
        id: 'cam_top_down',
        name: '俯瞰吊机位',
        position: { x: 0.1, y: 8.5, z: 0.1 },
        target: { x: 0, y: 0.8, z: 0 },
        fov: 45,
        aspect: 16 / 9,
        near: 0.1,
        far: 5000,
        visible: true,
        focalLength: 50,
        cameraType: 'perspective',
        orthoSize: 5,
        exposure: 1.0,
        toneMapping: 'ACESFilmic',
      }
    ],
    lights: [
      {
        id: 'light_ambient',
        name: '漫反射环境光',
        type: 'ambient',
        color: '#4b6584',
        intensity: 0.6,
        position: { x: 0, y: 10, z: 0 }
      },
      {
        id: 'light_directional',
        name: '电影轮廓边缘光',
        type: 'directional',
        color: '#ffb8b8',
        intensity: 0.8,
        position: { x: -6, y: 6, z: -5 }
      },
      {
        id: 'light_fill',
        name: '正面填充柔和光',
        type: 'point',
        color: '#81ecec',
        intensity: 0.7,
        position: { x: 4, y: 3, z: 5 }
      }
    ],
    activeCameraId: 'cam_director_main',
    viewMode: '3D',
    showGrid: true,
    showSubViewer: true,
    showCrowdLabels: false,
  };
};
