import { ref, watch } from 'vue';
import { DirectingProject, JointRotation } from '@/components/director-3d/director3D.types';
import { createDefaultProject } from '@/components/director-3d/director3D.constants';
import { saveProjectToDB, loadProjectFromDB, clearProjectDB } from '@/utils/director3DProjectStorage';

const V1_PROCEDURAL_OFFSET: Record<string, JointRotation> = {
  leftShoulder: { x: 0, y: 0, z: -35 },
  rightShoulder: { x: 0, y: 0, z: 35 },
  leftElbow: { x: 15, y: 0, z: 0 },
  rightElbow: { x: 15, y: 0, z: 0 },
};

export function migrateLegacyJoints(project: any) {
  if (project._jointVersion >= 3) return;

  if (project._jointVersion < 2) {
    for (const m of project.mannequins) {
      if (!m.joints) continue;
      if (m.style === 'glb') {
        for (const jn of ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip']) {
          const j = m.joints[jn as keyof typeof m.joints];
          if (j) { j.x = -j.x; j.z = -j.z; }
        }
      } else {
        for (const [jointName, offset] of Object.entries(V1_PROCEDURAL_OFFSET)) {
          const j = m.joints[jointName as keyof typeof m.joints];
          if (j) { j.x -= offset.x; j.y -= offset.y; j.z -= offset.z; }
        }
      }
    }
  }

  if (project._jointVersion < 3) {
    for (const m of project.mannequins) {
      if (!m.joints || m.style === 'glb') continue;
      for (const [jointName, offset] of Object.entries(V1_PROCEDURAL_OFFSET)) {
        const j = m.joints[jointName as keyof typeof m.joints];
        if (j) { j.x += offset.x; j.y += offset.y; j.z += offset.z; }
      }
    }
  }

  project._jointVersion = 3;
}

export function useProject(
  showToast: (message: string, type?: 'success' | 'info') => void,
  nodeId: () => string
) {
  const project = ref<DirectingProject>(createDefaultProject());

  const loadSavedProject = async () => {
    const id = nodeId();
    if (!id) return;
    const saved = await loadProjectFromDB(id);
    if (saved) {
      migrateLegacyJoints(saved);
      project.value = saved;
    }
  };

  watch(project, (newVal) => {
    const id = nodeId();
    if (!id) return;
    saveProjectToDB(id, newVal);
  }, { deep: true });

  const handleSaveProject = () => {
    const id = nodeId();
    if (!id) return;
    saveProjectToDB(id, project.value);
    showToast('导演预制作大底工程已本地同步！', 'success');
  };

  const handleResetProject = (onResetCallback?: () => void) => {
    const id = nodeId();
    if (id) clearProjectDB(id);
    const defProj = createDefaultProject();
    project.value = defProj;
    if (onResetCallback) {
      onResetCallback();
    }
    showToast('已清除浏览器高速缓存并载入全新模板', 'info');
  };

  const handleExportProjectJson = () => {
    try {
      const dataStr = JSON.stringify(project.value, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataUri);
      downloadAnchor.setAttribute('download', 'directing_project_solver.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('工程文件导出成功，请妥善保管。', 'success');
    } catch {
      showToast('JSON 序列化失败', 'info');
    }
  };

  const handleImportProjectJson = (e: Event, commitHistorySnapshot: () => void, selectElement: (id: string | null, type: any) => void) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.mannequins) && Array.isArray(parsed.cameras)) {
          migrateLegacyJoints(parsed);
          commitHistorySnapshot();
          project.value = parsed;
          selectElement(null, null);
          showToast('成功载入外部工程，已完美重构所有图层和几何关系', 'success');
        } else {
          showToast('JSON 解析成功，但包含无效的导演台项目文件骨架', 'info');
        }
      } catch {
        showToast('JSON 姿势流和层模型解析异常', 'info');
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  return {
    project,
    loadSavedProject,
    handleSaveProject,
    handleResetProject,
    handleExportProjectJson,
    handleImportProjectJson,
  };
}

export const useDirector3DProject = useProject
