<template>
  <Teleport to="body">
    <Transition name="subject-dialog-fade">
      <div v-if="visible" class="subject-dialog-overlay" @click.self="close">
        <section class="subject-dialog" role="dialog" aria-modal="true" aria-labelledby="subject-dialog-title">
          <header class="dialog-header">
            <div class="dialog-heading">
              <span class="dialog-icon"><UserRoundPlus :size="20" /></span>
              <div>
                <h2 id="subject-dialog-title">新建主体</h2>
                <p>创建可复用的角色、物体或场景资产</p>
              </div>
            </div>
            <button class="icon-button" aria-label="关闭" @click="close"><X :size="18" /></button>
          </header>

          <div class="dialog-body">
            <div class="form-grid">
              <label class="form-field">
                <span>主体名称 <em>*</em></span>
                <input v-model="form.name" maxlength="40" placeholder="例如：女主角、产品样机" autofocus />
                <small>{{ form.name.length }}/40</small>
              </label>
              <label class="form-field">
                <span>所属分类 <em>*</em></span>
                <select v-model="form.categoryId">
                  <option value="" disabled>选择一个分类</option>
                  <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
                    {{ option.name }}
                  </option>
                </select>
              </label>
            </div>

            <label class="form-field">
              <span>描述 <i>选填</i></span>
              <textarea v-model="form.description" maxlength="200" placeholder="补充外观、用途或使用场景，方便后续查找" />
              <small>{{ form.description.length }}/200</small>
            </label>

            <div class="form-field">
              <div class="upload-label">
                <span>参考媒体 <i>第一张自动设为封面</i></span>
                <small>{{ selectedFiles.length }}/12</small>
              </div>
              <label class="upload-dropzone" @dragover.prevent @drop.prevent="onDrop">
                <input type="file" accept="image/*,video/*" multiple @change="onMediaSelect" />
                <span class="upload-icon"><ImagePlus :size="22" /></span>
                <strong>点击或拖拽图片、视频到这里</strong>
                <p>图片不超过 10MB，视频不超过 200MB</p>
              </label>
              <div v-if="selectedFiles.length" class="upload-preview">
                <figure v-for="(file, index) in selectedFiles" :key="file.name + file.lastModified">
                  <video v-if="file.type.startsWith('video/')" :src="getFileUrl(file)" muted playsinline />
                  <img v-else :src="getFileUrl(file)" :alt="file.name" />
                  <figcaption v-if="index === 0">封面 · 第1张</figcaption>
                  <button aria-label="移除媒体" @click="removeFile(index)"><X :size="12" /></button>
                </figure>
              </div>
              <div v-if="uploading" class="upload-progress">
                <Loader2 :size="14" class="spin" /> {{ uploadProgress }}
              </div>
            </div>
          </div>

          <footer class="dialog-footer">
            <button class="secondary-button" :disabled="saving" @click="close">取消</button>
            <button class="primary-button" :disabled="!canSubmit" @click="submit">
              <Loader2 v-if="saving" :size="15" class="spin" />
              <Check v-else :size="15" />
              {{ saving ? '创建中' : '创建主体' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { Check, ImagePlus, Loader2, UserRoundPlus, X } from '@/components/common/icon/lucide'
import { useSubjectCreate } from '@/composables/subjects/useSubjectCreate'

const props = defineProps<{ visible: boolean; categoryId?: number | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()
const {
  form, categoryOptions, selectedFiles, saving, uploading, uploadProgress,
  canSubmit, reset, addFiles, removeFile, getFileUrl, save,
} = useSubjectCreate()

function close(): void {
  if (!saving.value) emit('update:visible', false)
}

function onMediaSelect(event: Event): void {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files || []))
  input.value = ''
}

function onDrop(event: DragEvent): void {
  addFiles(Array.from(event.dataTransfer?.files || []))
}

async function submit(): Promise<void> {
  if (!await save()) return
  emit('saved')
  close()
}

watch(() => props.visible, (visible) => {
  if (visible) reset(props.categoryId)
})
</script>

<style scoped src="./SubjectDialog.scss"></style>
