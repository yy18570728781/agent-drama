import { ref, Ref } from 'vue';
import { DirectingProject, MannequinJoints, MannequinObject } from '@/components/director-3d/director3D.types';
import { PosePreset } from '@/components/director-3d/director3D.constants';
import { saveGLBToDB, getGLBFromDB } from '@/utils/director3DGlbStorage';
import { uploadFileToCosUrl } from '@/api/uploadHelpers';

export function useCustomPresets(
  project: Ref<DirectingProject>,
  selectedElementId: Ref<string | null>,
  selectedElementType: Ref<'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null>,
  commitHistorySnapshot: () => void,
  showToast: (message: string, type?: 'success' | 'info') => void,
  addMannequin: (style: 'detailed' | 'simple' | 'glb', glbId?: string, glbUrl?: string, glbName?: string) => void
) {
  const getImportedGlbs = (): Array<{ id: string; name: string; url: string }> => {
    try {
      const saved = localStorage.getItem('director_imported_glb_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const importedGlbs = ref<Array<{ id: string; name: string; url: string }>>(getImportedGlbs());

  const getCustomPresets = (): PosePreset[] => {
    try {
      const saved = localStorage.getItem('director_custom_pose_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  const customPresets = ref<PosePreset[]>(getCustomPresets());
  const isUploadingGlb = ref<boolean>(false);

  const handleRegisterUploadedGlb = (id: string, name: string, url: string) => {
    const newItem = { id, name, url };
    const currentList = importedGlbs.value;
    const filtered = currentList.filter(item => item.id !== id);
    const next = [newItem, ...filtered];
    importedGlbs.value = next;
    localStorage.setItem('director_imported_glb_list', JSON.stringify(next));
  };

  const handleSaveCustomPreset = (nameInput: string, joints: MannequinJoints) => {
    const trimmed = nameInput.trim();
    const name = trimmed || `自定义动作 ${customPresets.value.length + 1}`;
    const newPreset: PosePreset = {
      id: 'custom-' + Date.now(),
      name,
      joints: JSON.parse(JSON.stringify(joints)),
    };
    const updated = [...customPresets.value, newPreset];
    customPresets.value = updated;
    localStorage.setItem('director_custom_pose_presets', JSON.stringify(updated));
    showToast(`💾 动作 [${name}] 已成功保存到自定义预设库！`, 'success');
  };

  const handleDeleteCustomPreset = (id: string) => {
    const presetToDelete = customPresets.value.find(p => p.id === id);
    const updated = customPresets.value.filter(p => p.id !== id);
    customPresets.value = updated;
    localStorage.setItem('director_custom_pose_presets', JSON.stringify(updated));
    showToast(`🗑️ 已从自定义预设库中删除: [${presetToDelete?.name || ''}]`, 'info');
  };

  const handleUploadGlbFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'glb' && ext !== 'gltf') {
      showToast('⚠️ 只支持标准的 .glb 或 .gltf 人偶模型！', 'info');
      return;
    }

    isUploadingGlb.value = true;
    try {
      const glbId = `glb_${Date.now()}`;
      const glbName = file.name.replace(/\.[^/.]+$/, "") || "标准导入3D人偶";
      let glbUrl: string;

      try {
        glbUrl = await uploadFileToCosUrl(file, `${glbId}.glb`);
        showToast('📥 GLB 模型已上传云端', 'success');
      } catch {
        const arrayBuffer = await file.arrayBuffer();
        await saveGLBToDB(glbId, arrayBuffer);
        const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
        glbUrl = URL.createObjectURL(blob);
        showToast('⚠️ 云端上传失败，已存储到本地', 'info');
      }

      handleRegisterUploadedGlb(glbId, glbName, glbUrl);
      addMannequin('glb', glbId, glbUrl, glbName);
    } catch (err) {
      console.error(err);
      showToast('❌ GLB 文件解析错误，请确保文件装配规范。', 'info');
    } finally {
      isUploadingGlb.value = false;
    }
  };

  const resolveGlbUrl = async (glbId: string, glbUrl: string): Promise<string> => {
    if (!glbUrl.startsWith('blob:')) return glbUrl;

    const stored = await getGLBFromDB(glbId);
    if (!stored) return glbUrl;

    try {
      const blob = new Blob([stored], { type: 'model/gltf-binary' });
      const file = new File([blob], `${glbId}.glb`, { type: 'model/gltf-binary' });
      const cosUrl = await uploadFileToCosUrl(file, `${glbId}.glb`);
      handleRegisterUploadedGlb(glbId, glbId, cosUrl);
      return cosUrl;
    } catch {
      return glbUrl;
    }
  };

  const handleSelectGlb = async (glbId: string, glbUrl: string) => {
    if (selectedElementType.value !== 'mannequin' || !selectedElementId.value) return;
    commitHistorySnapshot();
    const resolvedUrl = await resolveGlbUrl(glbId, glbUrl);
    project.value.mannequins = project.value.mannequins.map(m =>
      m.id === selectedElementId.value ? { ...m, style: 'glb' as const, glbId, glbUrl: resolvedUrl } : m
    );
    showToast('✨ 成功将当前人偶装配底层骨骼换装为指定 GLB 模型！', 'success');
  };

  return {
    importedGlbs: importedGlbs as Ref<Array<{ id: string; name: string; url: string }>>,
    customPresets: customPresets as Ref<PosePreset[]>,
    isUploadingGlb,
    handleSaveCustomPreset,
    handleDeleteCustomPreset,
    handleUploadGlbFile,
    handleSelectGlb,
  };
}

export const useDirector3DCustomPresets = useCustomPresets
