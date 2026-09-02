<script setup lang="ts">
import type { Subject } from '@/api/subjects'
import { ref } from 'vue'
import {
  Image, MoreHorizontal, Pencil, Plus, SquarePen, Trash2, UserRound, Video,
} from '@/components/common/icon/lucide'
import '@/styles/cardActionPopover.scss'
import './SubjectCardPopover.scss'

const props = defineProps<{ subject: Subject }>()
const emit = defineEmits<{
  addToCanvas: [subject: Subject]
  delete: [subject: Subject]
  edit: [subject: Subject]
  rename: [subject: Subject]
}>()
const coverFailed = ref(false)
const menuOpen = ref(false)

function handleAction(action: 'edit' | 'add' | 'rename' | 'delete'): void {
  if (action === 'edit') emit('edit', props.subject)
  if (action === 'add') emit('addToCanvas', props.subject)
  if (action === 'rename') emit('rename', props.subject)
  if (action === 'delete') emit('delete', props.subject)
}
</script>

<template>
  <article
    class="subject-card"
    :class="{ 'is-menu-open': menuOpen }"
    role="button"
    tabindex="0"
    @click="emit('edit', subject)"
    @keydown.enter="emit('edit', subject)"
    @keydown.space.prevent="emit('edit', subject)"
  >
    <span class="subject-cover">
      <span class="subject-cover-placeholder" aria-hidden="true">
        <span class="subject-cover-placeholder__graphic"><UserRound :size="30" /></span>
      </span>
      <img
        v-if="subject.thumb && !coverFailed"
        :src="subject.thumb"
        :alt="subject.name"
        loading="lazy"
        @error="coverFailed = true"
      />
      <el-popover
        placement="bottom-end"
        trigger="hover"
        popper-class="card-action-popover"
        :offset="4"
        :show-arrow="false"
        :width="136"
        @show="menuOpen = true"
        @hide="menuOpen = false"
      >
        <template #reference>
          <button
            class="subject-card__more"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            aria-label="更多主体操作"
            title="更多操作"
            @click.stop
            @keydown.stop
          >
            <MoreHorizontal :size="17" />
          </button>
        </template>
        <div class="card-action-menu" role="menu" @click.stop>
          <button class="card-action-menu__item" type="button" role="menuitem" @click="handleAction('edit')"><SquarePen :size="14" /><span>编辑主体</span></button>
          <button class="card-action-menu__item" type="button" role="menuitem" @click="handleAction('add')"><Plus :size="14" /><span>添加到画布</span></button>
          <div class="card-action-menu__separator" role="separator" />
          <button class="card-action-menu__item" type="button" role="menuitem" @click="handleAction('rename')"><Pencil :size="14" /><span>重命名</span></button>
          <button class="card-action-menu__item is-danger" type="button" role="menuitem" @click="handleAction('delete')"><Trash2 :size="14" /><span>删除</span></button>
        </div>
      </el-popover>
    </span>
    <span class="subject-info">
      <strong :title="subject.name">{{ subject.name }}</strong>
      <button
        class="subject-card__add"
        type="button"
        title="添加到画布"
        aria-label="添加到画布"
        @click.stop="emit('addToCanvas', subject)"
        @keydown.stop
      ><Plus :size="16" /></button>
      <small v-if="subject.media_type === 'video'"><Video :size="12" />视频</small>
      <small v-else><Image :size="12" />图片</small>
    </span>
  </article>
</template>

<style scoped src="./SubjectCard.scss"></style>
