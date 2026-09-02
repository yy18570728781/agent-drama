import { ref, type Ref } from 'vue'
import { detachSubjectMedia, changeSubjectCover } from '@/api/subjects'
import { ElMessage } from 'element-plus'
import { uploadSubjectMedia } from '@/services/subjects/subjectMedia.service'

interface UseSubjectMediaReturn {
  uploading: Ref<boolean>
  uploadProgress: Ref<string>
  uploadMedia: (subjectId: string, files: File[], hasCover: boolean) => Promise<void>
  removeMedia: (subjectId: string, mediaId: string) => Promise<void>
  setCover: (subjectId: string, mediaId: string) => Promise<void>
}

/**
 * 主体媒体管理：COS 上传、关联/取消关联、设封面。
 */
export function useSubjectMedia(): UseSubjectMediaReturn {
  const uploading = ref(false)
  const uploadProgress = ref('')

  async function uploadMedia(
    subjectId: string,
    files: File[],
    hasCover: boolean,
  ): Promise<void> {
    if (!files.length) return

    uploading.value = true
    try {
      await uploadSubjectMedia({
        subjectId,
        files,
        hasCover,
        onProgress: message => { uploadProgress.value = message },
      })
      uploadProgress.value = ''
    } finally {
      uploading.value = false
    }
  }

  async function removeMedia(subjectId: string, mediaId: string): Promise<void> {
    await detachSubjectMedia(subjectId, mediaId)
  }

  async function setCover(subjectId: string, mediaId: string): Promise<void> {
    await changeSubjectCover(subjectId, mediaId)
    ElMessage.success('已设为封面并移到第一位')
  }

  return {
    uploading,
    uploadProgress,
    uploadMedia,
    removeMedia,
    setCover,
  }
}
