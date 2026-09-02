import { ref, Ref } from 'vue';
import { DirectingProject, MannequinJoints } from '@/components/director-3d/director3D.types';

export function useSelection(project: Ref<DirectingProject>) {
  const selectedElementId = ref<string | null>('mannequin_alice');
  const selectedElementType = ref<'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null>('mannequin');
  const selectedJointKey = ref<keyof MannequinJoints | null>(null);
  const selectedElementIds = ref<string[]>(['mannequin_alice']);
  const customEditorCamera = ref<boolean>(true);

  const handleSelectElement = (
    id: string | null,
    type: 'mannequin' | 'camera' | 'image' | 'light' | 'ground' | 'group' | null,
    isShift?: boolean,
    isCtrl?: boolean,
    forceMultiIds?: string[]
  ) => {
    if (!id) {
      selectedElementId.value = null;
      selectedElementType.value = null;
      selectedElementIds.value = [];
      selectedJointKey.value = null;
      return;
    }

    if (forceMultiIds) {
      selectedElementIds.value = forceMultiIds;
      selectedElementId.value = id;
      selectedElementType.value = type;
      selectedJointKey.value = null;
      return;
    }

    if (isShift || isCtrl) {
      let nextSelection: string[] = [];

      if (isShift) {
        const flatItems: string[] = [
          ...project.value.cameras.map(c => c.id),
          ...project.value.mannequins.map(m => m.id),
          ...project.value.imagePlanes.map(img => img.id),
          ...project.value.lights.map(l => l.id),
        ];
        if (project.value.showGrid !== false) {
          flatItems.push('ground');
        }

        const lastClickedId = selectedElementId.value;
        const lastIdx = lastClickedId ? flatItems.indexOf(lastClickedId) : -1;
        const curIdx = flatItems.indexOf(id);

        if (lastIdx !== -1 && curIdx !== -1) {
          const start = Math.min(lastIdx, curIdx);
          const end = Math.max(lastIdx, curIdx);
          nextSelection = flatItems.slice(start, end + 1);
        } else {
          nextSelection = [id];
        }
      } else {
        if (selectedElementIds.value.includes(id)) {
          nextSelection = selectedElementIds.value.filter(item => item !== id);
        } else {
          nextSelection = [...selectedElementIds.value, id];
        }
      }

      selectedElementIds.value = nextSelection;

      if (nextSelection.length > 0) {
        if (nextSelection.includes(id)) {
          selectedElementId.value = id;
          selectedElementType.value = type;
        } else {
          const lastId = nextSelection[nextSelection.length - 1];
          selectedElementId.value = lastId;
          let lastType: any = 'mannequin';
          if (project.value.cameras.some(c => c.id === lastId)) lastType = 'camera';
          else if (project.value.imagePlanes.some(img => img.id === lastId)) lastType = 'image';
          else if (project.value.lights.some(l => l.id === lastId)) lastType = 'light';
          else if (lastId === 'ground') lastType = 'ground';
          else if (project.value.groups?.some(g => g.id === lastId)) lastType = 'group';
          selectedElementType.value = lastType;
        }
        selectedJointKey.value = null;
      } else {
        selectedElementId.value = null;
        selectedElementType.value = null;
        selectedJointKey.value = null;
      }
    } else {
      selectedElementId.value = id;
      selectedElementType.value = type;
      selectedElementIds.value = [id];
      selectedJointKey.value = null;
    }
  };

  const resetSelection = () => {
    selectedElementId.value = 'mannequin_alice';
    selectedElementType.value = 'mannequin';
    selectedElementIds.value = ['mannequin_alice'];
    selectedJointKey.value = null;
    customEditorCamera.value = true;
  };

  return {
    selectedElementId,
    selectedElementType,
    selectedJointKey,
    selectedElementIds,
    customEditorCamera,
    handleSelectElement,
    resetSelection,
  };
}

export const useDirector3DSelection = useSelection
