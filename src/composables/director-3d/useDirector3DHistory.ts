import { ref, Ref } from 'vue';
import { DirectingProject } from '@/components/director-3d/director3D.types';
import { safeJsonStringify } from '@/utils/director3DSerialization';

export function useHistory(
  project: Ref<DirectingProject>,
  showToast: (message: string, type?: 'success' | 'info') => void
) {
  const past = ref<DirectingProject[]>([]);
  const future = ref<DirectingProject[]>([]);

  const commitHistorySnapshot = () => {
    const currentFrame = JSON.parse(safeJsonStringify(project.value));
    past.value.push(currentFrame);
    if (past.value.length > 50) {
      past.value.shift();
    }
    future.value = [];
  };

  const handleUndo = () => {
    if (past.value.length > 0) {
      const prevList = [...past.value];
      const previousState = prevList.pop();
      if (previousState) {
        const currentCopy = JSON.parse(safeJsonStringify(project.value));
        future.value.push(currentCopy);
        past.value = prevList;
        project.value = previousState;
        showToast('↩️ 成功撤销上一次操作', 'info');
      }
    } else {
      showToast('↩️ 没有可撤销的历史记录了', 'info');
    }
  };

  const handleRedo = () => {
    if (future.value.length > 0) {
      const nextList = [...future.value];
      const nextState = nextList.pop();
      if (nextState) {
        const currentCopy = JSON.parse(safeJsonStringify(project.value));
        past.value.push(currentCopy);
        future.value = nextList;
        project.value = nextState;
        showToast('↪️ 成功重做上一次操作', 'info');
      }
    } else {
      showToast('↪️ 没有可重做的历史记录了', 'info');
    }
  };

  const clearHistory = () => {
    past.value = [];
    future.value = [];
  };

  return {
    past,
    future,
    commitHistorySnapshot,
    handleUndo,
    handleRedo,
    clearHistory,
  };
}

export const useDirector3DHistory = useHistory
