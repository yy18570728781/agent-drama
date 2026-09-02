<script setup lang="ts">
import { onMounted } from 'vue'
import {
  AlertCircle, ArrowLeft, Check, Image, ImagePlus, Loader2,
  Star, Trash2, UserRound, X,
} from '@/components/common/icon/lucide'
import { useSubjectDetail } from '@/composables/subjects/useSubjectDetail'
import { useSubjectEditing } from '@/composables/subjects/useSubjectEditing'

const props = withDefaults(defineProps<{ subjectId: string; dialog?: boolean }>(), {
  dialog: false,
})
const emit = defineEmits<{ back: []; deleted: [] }>()
const {
  subject, loading, categoryName, uploading, uploadProgress,
  loadDetail, uploadFiles, setCover, removeMedia, removeSubject,
} = useSubjectDetail(props.subjectId)
const { nameDraft, descDraft, saveName, saveDesc } = useSubjectEditing(subject)

function onMediaSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  void uploadFiles(Array.from(input.files || []))
  input.value = ''
}

function onMediaDrop(event: DragEvent): void {
  void uploadFiles(Array.from(event.dataTransfer?.files || []))
}

async function handleDelete(): Promise<void> {
  if (await removeSubject()) emit('deleted')
}

function canClose(): boolean {
  return !uploading.value
}

defineExpose({ canClose })

onMounted(loadDetail)
</script>

<template>
  <main class="subject-detail-editor" :class="{ 'is-dialog': dialog }">
    <header v-if="!dialog" class="detail-toolbar">
      <button class="back-button" type="button" @click="emit('back')">
        <ArrowLeft :size="16" />返回主体库
      </button>
      <span v-if="subject" class="detail-context">主体详情 / {{ subject.name }}</span>
      <button v-if="subject" class="delete-button" type="button" @click="handleDelete">
        <Trash2 :size="15" />删除主体
      </button>
    </header>

    <div v-if="loading" class="state-panel">
      <Loader2 :size="28" class="spin" /><span>正在加载主体信息</span>
    </div>
    <div v-else-if="!subject" class="state-panel">
      <span class="state-icon"><AlertCircle :size="28" /></span>
      <h2>主体不存在或已被删除</h2>
      <button class="primary-button" type="button" @click="emit('back')">返回主体库</button>
    </div>

    <section v-else class="editor-shell">
      <header class="editor-header">
        <span class="editor-icon"><UserRound :size="21" /></span>
        <div><h1>编辑主体</h1><p>更新主体信息与参考媒体，修改后自动保存</p></div>
        <span class="subject-id">ID {{ subject.id }}</span>
        <button v-if="dialog" class="editor-close" type="button" aria-label="关闭" :disabled="uploading" @click="emit('back')">
          <X :size="18" />
        </button>
      </header>

      <div class="editor-body">
        <div class="form-grid">
          <label class="form-field">
            <span>主体名称 <em>*</em></span>
            <input v-model="nameDraft" maxlength="40" @blur="saveName" @keydown.enter.prevent="saveName" />
            <small>{{ nameDraft.length }}/40</small>
          </label>
          <label class="form-field">
            <span>所属分类</span>
            <input :value="categoryName" readonly class="readonly-input" />
          </label>
        </div>

        <label class="form-field">
          <span>描述 <i>选填</i></span>
          <textarea
            v-model="descDraft"
            maxlength="200"
            placeholder="补充外观、用途或使用场景，方便后续查找"
            @blur="saveDesc"
          />
          <small>{{ descDraft.length }}/200</small>
        </label>

        <div class="form-field media-field">
          <div class="upload-label">
            <span>参考媒体 <i>第一张始终作为封面</i></span>
            <small>{{ subject.media.length }}/12</small>
          </div>
          <label class="upload-dropzone" :class="{ disabled: uploading }" @dragover.prevent @drop.prevent="onMediaDrop">
            <input type="file" accept="image/*,video/*" multiple :disabled="uploading" @change="onMediaSelect" />
            <span class="upload-icon"><ImagePlus :size="22" /></span>
            <strong>{{ uploading ? uploadProgress : '点击或拖拽图片、视频到这里' }}</strong>
            <p>图片不超过 10MB，视频不超过 200MB</p>
          </label>

          <div v-if="subject.media.length" class="media-grid">
            <figure v-for="(item, index) in subject.media" :key="item.relation_id" class="media-item">
              <video v-if="item.type === 'video'" :src="item.source_url || item.thumb" :poster="item.thumb" muted playsinline />
              <img v-else-if="item.thumb" :src="item.thumb" :alt="item.name || subject.name" loading="lazy" />
              <span v-else class="media-placeholder"><Image :size="24" /></span>
              <figcaption v-if="index === 0"><Check :size="11" />封面</figcaption>
              <div class="media-actions">
                <button v-if="index > 0" type="button" @click="setCover(item.id)">
                  <Star :size="13" />设为封面
                </button>
                <button class="danger" type="button" aria-label="移除媒体" @click="removeMedia(item.id)">
                  <Trash2 :size="13" />
                </button>
              </div>
            </figure>
          </div>
          <p v-else class="empty-media">暂无参考媒体，上传的第一张会自动成为封面。</p>
        </div>
      </div>
      <footer v-if="dialog" class="editor-footer">
        <button class="delete-button" type="button" :disabled="uploading" @click="handleDelete">
          <Trash2 :size="14" />删除主体
        </button>
        <button class="primary-button" type="button" :disabled="uploading" @click="emit('back')">完成</button>
      </footer>
    </section>
  </main>
</template>

<style scoped src="./SubjectDetailEditor.scss"></style>
