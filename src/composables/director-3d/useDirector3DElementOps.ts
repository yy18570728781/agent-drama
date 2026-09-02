import { Ref } from 'vue';
import {
  DirectingProject,
  MannequinObject,
  ImagePlaneObject,
  CameraConfig,
  LightConfig,
  MannequinJoints
} from '@/components/director-3d/director3D.types';
import { POSE_PRESETS, TEMPLATE_IMAGES } from '@/components/director-3d/director3D.constants';

export function useElementOperations(
  project: Ref<DirectingProject>,
  selectedElementId: Ref<string | null>,
  commitHistorySnapshot: () => void,
  handleSelectElement: (
    id: string | null,
    type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null,
    isShift?: boolean,
    isCtrl?: boolean,
    forceMultiIds?: string[]
  ) => void,
  showToast: (message: string, type?: 'success' | 'info') => void
) {

  const handleUpdateMannequin = (id: string, data: Partial<MannequinObject>) => {
    project.value.mannequins = project.value.mannequins.map(m => {
      if (m.id !== id) return m;
      const patch = { ...data } as Record<string, unknown>;
      if ('scaleY' in patch) {
        const sy = patch.scaleY as number;
        patch.scale = { ...m.scale, ...(patch.scale as Partial<{ x: number; y: number; z: number }>), y: sy };
        delete patch.scaleY;
      }
      return { ...m, ...patch };
    });
  };

  const handleUpdateImage = (id: string, data: Partial<ImagePlaneObject>) => {
    project.value.imagePlanes = project.value.imagePlanes.map(p => p.id === id ? { ...p, ...data } : p);
  };

  const handleUpdateCamera = (id: string, data: Partial<CameraConfig>) => {
    project.value.cameras = project.value.cameras.map(c => c.id === id ? { ...c, ...data } : c);
  };

  const handleUpdateLight = (id: string, data: Partial<LightConfig>) => {
    project.value.lights = project.value.lights.map(l => l.id === id ? { ...l, ...data } : l);
  };

  const handleAddMannequin = (style: 'detailed' | 'simple' | 'glb', glbId?: string, glbUrl?: string, glbName?: string) => {
    commitHistorySnapshot();
    const newId = `mannequin_${Date.now()}`;
    const nameStr = style === 'glb' ? (glbName || '模型人') : (style === 'detailed' ? '关节模特' : '极简人偶');
    const defaultJoints: MannequinJoints = JSON.parse(
      JSON.stringify(POSE_PRESETS.find(p => p.id === 'a-pose')?.joints || POSE_PRESETS[0].joints)
    );

    const count = project.value.mannequins.length;
    const xOffset = (count * 1.0) - 2.0;
    const newMannequin: MannequinObject = {
      id: newId,
      name: `${nameStr} - ${count + 1}`,
      position: { x: xOffset, y: 0, z: 0 },
      rotation: { x: 0, y: 180, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: '#ffffff',
      visible: true,
      joints: defaultJoints,
      style,
      glbId,
      glbUrl
    };
    project.value.mannequins.push(newMannequin);

    handleSelectElement(newId, 'mannequin');
    showToast(`已在舞台添加: [${style === 'glb' ? 'GLB 模特' : nameStr}]`, 'success');
  };

  const handleAddCamera = (customEditorCamera: Ref<boolean>) => {
    commitHistorySnapshot();
    const id = `camera_${Date.now()}`;
    const key = project.value.cameras.length + 1;
    const newCam: CameraConfig = {
      id,
      name: `合成电影位 - ${key}`,
      position: { x: 0, y: 3, z: 8 },
      target: { x: 0, y: 1.2, z: 0 },
      fov: 42,
      aspect: 16 / 9,
      near: 0.1,
      far: 1000,
      visible: true,
      locked: false,
      focalLength: 50,
      cameraType: 'perspective',
      orthoSize: 5,
      exposure: 1.0,
      toneMapping: 'ACESFilmic',
    };
    project.value.cameras.push(newCam);
    project.value.activeCameraId = id;
    customEditorCamera.value = false;
    handleSelectElement(id, 'camera');
    showToast(`新增电影位 [机位 ${key}] 并切换画面监视`, 'success');
  };

  const handleAddImagePlane = (url?: string) => {
    commitHistorySnapshot();
    const id = `image_${Date.now()}`;
    const key = project.value.imagePlanes.length + 1;
    const defaultUrl = url || TEMPLATE_IMAGES[0].url;

    const newImg: ImagePlaneObject = {
      id,
      name: `外部投影底片 - ${key}`,
      url: defaultUrl,
      position: { x: 0, y: 2.2, z: -4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 7, y: 4.5, z: 1 },
      visible: true,
      opacity: 0.85,
      renderMode: '3D',
      blendMode: 'normal',
      zIndex: 0
    };
    project.value.imagePlanes.push(newImg);

    handleSelectElement(id, 'image');
    showToast('投影底片图层已生成', 'success');
  };

  const handleAddMannequinToGroup = (mannequinId: string, groupId: string) => {
    commitHistorySnapshot();
    const groupName = project.value.mannequins.find(m => m.groupId === groupId)?.groupName || '合唱队形';
    project.value.mannequins = project.value.mannequins.map(m => m.id === mannequinId ? { ...m, groupId, groupName } : m);
  };

  const handleRemoveMannequinFromGroup = (mannequinId: string) => {
    commitHistorySnapshot();
    project.value.mannequins = project.value.mannequins.map(m => m.id === mannequinId ? { ...m, groupId: undefined, groupName: undefined } : m);
  };

  const handleDeleteElement = (id: string, type: 'mannequin' | 'camera' | 'image' | 'light' | 'group') => {
    commitHistorySnapshot();
    if (type === 'mannequin') {
      project.value.mannequins = project.value.mannequins.filter(m => m.id !== id);
    } else if (type === 'group') {
      project.value.mannequins = project.value.mannequins.filter(m => m.groupId !== id);
      project.value.groups = (project.value.groups || []).filter(g => g.id !== id);
      project.value.cameras = project.value.cameras.filter(c => c.groupId !== id);
      project.value.lights = project.value.lights.filter(l => l.groupId !== id);
      project.value.imagePlanes = project.value.imagePlanes.filter(img => img.groupId !== id);
    } else if (type === 'image') {
      project.value.imagePlanes = project.value.imagePlanes.filter(p => p.id !== id);
    } else if (type === 'camera') {
      if (project.value.cameras.length <= 1) {
        showToast('场景内必须保留至少一个摄影机位', 'info');
        return;
      }
      project.value.cameras = project.value.cameras.filter(c => c.id !== id);
      if (project.value.activeCameraId === id) {
        project.value.activeCameraId = project.value.cameras[0].id;
      }
    } else if (type === 'light') {
      project.value.lights = project.value.lights.filter(l => l.id !== id);
    }

    if (selectedElementId.value === id) {
      handleSelectElement(null, null);
    }
    showToast('已删除选中元素', 'info');
  };

  const resolveElementType = (id: string): 'mannequin' | 'camera' | 'image' | 'light' | 'group' | null => {
    if (project.value.mannequins.some(m => m.id === id)) return 'mannequin';
    if (project.value.imagePlanes.some(p => p.id === id)) return 'image';
    if (project.value.cameras.some(c => c.id === id)) return 'camera';
    if (project.value.lights.some(l => l.id === id)) return 'light';
    if ((project.value.groups || []).some(g => g.id === id)) return 'group';
    if (project.value.mannequins.some(m => m.groupId === id)) return 'group';
    return null;
  };

  const handleDeleteMultipleElements = (ids: string[]) => {
    commitHistorySnapshot();
    const mannequinIds = new Set<string>();
    const imageIds = new Set<string>();
    const cameraIds = new Set<string>();
    const lightIds = new Set<string>();
    const groupIds = new Set<string>();

    ids.forEach(id => {
      const type = resolveElementType(id);
      if (type === 'mannequin') mannequinIds.add(id);
      else if (type === 'image') imageIds.add(id);
      else if (type === 'camera') cameraIds.add(id);
      else if (type === 'light') lightIds.add(id);
      else if (type === 'group') groupIds.add(id);
    });

    project.value.mannequins = project.value.mannequins.filter(
      m => !mannequinIds.has(m.id) && !groupIds.has(m.groupId || '')
    );
    project.value.imagePlanes = project.value.imagePlanes.filter(p => !imageIds.has(p.id));

    if (project.value.cameras.length > cameraIds.size) {
      project.value.cameras = project.value.cameras.filter(c => !cameraIds.has(c.id));
      if (cameraIds.has(project.value.activeCameraId)) {
        project.value.activeCameraId = project.value.cameras[0]?.id || '';
      }
    }

    project.value.lights = project.value.lights.filter(l => !lightIds.has(l.id));
    project.value.groups = (project.value.groups || []).filter(g => !groupIds.has(g.id));

    handleSelectElement(null, null);
    showToast(`已批量删除 ${ids.length} 个元素`, 'info');
  };

  const handleDistributionGenerate = (config: any) => {
    commitHistorySnapshot();
    const groupId = `group_${Date.now()}`;
    const groupName = config.groupName || '群体阵列';
    const numItems = Number(config.count);
    const newMannequins: MannequinObject[] = [];

    const defaultJoints: MannequinJoints = JSON.parse(
      JSON.stringify(POSE_PRESETS.find(p => p.id === 'a-pose')?.joints || POSE_PRESETS[0].joints)
    );

    const pattern = config.pattern;
    const spacing = Number(config.spacing);
    const colorVal = config.color || '#ebd8c2';
    const styleVal = config.style || 'simple';

    for (let i = 0; i < numItems; i++) {
      let x = 0;
      let z = 0;

      if (pattern === 'line') {
        x = (i - (numItems - 1) / 2) * spacing;
        z = 0;
      } else if (pattern === 'circle') {
        const radius = config.radius || (spacing * numItems / (Math.PI * 2));
        const angle = (i / numItems) * Math.PI * 2;
        x = Math.sin(angle) * radius;
        z = Math.cos(angle) * radius;
      } else {
        const cols = config.cols || Math.ceil(Math.sqrt(numItems));
        const rIndex = Math.floor(i / cols);
        const cIndex = i % cols;
        const totalRows = Math.ceil(numItems / cols);
        x = (cIndex - (cols - 1) / 2) * spacing;
        z = (rIndex - (totalRows - 1) / 2) * spacing;
      }

      newMannequins.push({
        id: `mannequin_${Date.now()}_dist_${i}`,
        name: `${groupName} #${i + 1}`,
        position: { x, y: 0, z },
        rotation: { x: 0, y: 180, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: colorVal,
        visible: true,
        joints: defaultJoints,
        style: styleVal,
        groupId,
        groupName
      });
    }

    project.value.mannequins = [...project.value.mannequins, ...newMannequins];
    handleSelectElement(groupId, 'group');
    showToast(`已在网格生成阵列群组: [${groupName}] (${numItems}人)`, 'success');
  };

  const handleApplyPresetPose = (poseJoints: MannequinJoints) => {
    if (!selectedElementId.value) return;
    commitHistorySnapshot();
    const targetJoints = JSON.parse(JSON.stringify(poseJoints));
    handleUpdateMannequin(selectedElementId.value, { joints: targetJoints });
    showToast('已装配骨骼体格姿势', 'success');
  };

  return {
    handleUpdateMannequin,
    handleUpdateImage,
    handleUpdateCamera,
    handleUpdateLight,
    handleAddMannequin,
    handleAddCamera,
    handleAddImagePlane,
    handleAddMannequinToGroup,
    handleRemoveMannequinFromGroup,
    handleDeleteElement,
    handleDeleteMultipleElements,
    resolveElementType,
    handleDistributionGenerate,
    handleApplyPresetPose,
  };
}

export const useDirector3DElementOps = useElementOperations
