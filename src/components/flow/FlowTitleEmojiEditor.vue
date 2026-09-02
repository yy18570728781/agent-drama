<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  FLOW_CANVAS_NAME_MAX_LENGTH,
  normalizeFlowCanvasName,
} from '@/composables/flow/flowNameValidation'
import {
  composeFlowTitleEmoji,
  FLOW_TITLE_EMOJIS,
  splitFlowTitleEmoji,
} from './flowTitleEmoji'

defineOptions({ name: 'FlowTitleEmojiEditor' })

interface FlowTitleEmojiEditorProps {
  maxLength?: number
  modelValue: string
}

const props = withDefaults(defineProps<FlowTitleEmojiEditorProps>(), {
  maxLength: FLOW_CANVAS_NAME_MAX_LENGTH,
})
const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'commit'): void
  (event: 'update:modelValue', value: string): void
}>()

const initialTitle = splitFlowTitleEmoji(normalizeFlowCanvasName(props.modelValue))
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const draftEmoji = ref(initialTitle.emoji)
const draftText = ref(initialTitle.text)
const emojiPickerOpen = ref(false)
const inputMaxLength = computed(() => {
  const prefixLength = draftEmoji.value ? draftEmoji.value.length + 1 : 0
  return Math.max(1, props.maxLength - prefixLength)
})

function focusInput(selectText = true): void {
  const input = inputRef.value
  if (!input) return
  input.focus()
  if (selectText) input.select()
  else input.setSelectionRange(input.value.length, input.value.length)
}

function emitDraftValue(): void {
  emit('update:modelValue', composeFlowTitleEmoji(draftEmoji.value, draftText.value, props.maxLength))
}

function handleTextInput(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  draftText.value = event.target.value
  emitDraftValue()
}

function selectEmoji(emoji: string): void {
  draftEmoji.value = emoji
  draftText.value = draftText.value.slice(0, inputMaxLength.value)
  emojiPickerOpen.value = false
  emitDraftValue()
  void nextTick(() => focusInput(false))
}

function requestCommit(): void {
  if (draftText.value.trim()) emit('commit')
  else emit('cancel')
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && rootRef.value?.contains(nextTarget)) return
  requestCommit()
}

function handleEscape(): void {
  if (emojiPickerOpen.value) emojiPickerOpen.value = false
  else emit('cancel')
}

onMounted(() => {
  void nextTick(() => focusInput())
})
</script>

<template>
  <div
    ref="rootRef"
    class="flow-title-emoji-editor"
    @focusout="handleFocusOut"
    @keydown.esc.stop.prevent="handleEscape"
  >
    <button
      :aria-expanded="emojiPickerOpen"
      :aria-label="draftEmoji ? '更换画布名称表情' : '添加表情到画布名称'"
      aria-haspopup="menu"
      class="flow-title-emoji-editor__trigger"
      :title="draftEmoji ? '更换表情' : '添加表情'"
      type="button"
      @click="emojiPickerOpen = !emojiPickerOpen"
    >
      <span v-if="draftEmoji" class="flow-title-emoji-editor__current">{{ draftEmoji }}</span>
      <svg
        v-else
        aria-hidden="true"
        fill="none"
        height="20"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.7"
        viewBox="0 0 24 24"
        width="20"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9h.01M15 9h.01M8.5 14a4.2 4.2 0 0 0 7 0" />
      </svg>
    </button>
    <span class="flow-title-emoji-editor__divider" aria-hidden="true" />
    <input
      ref="inputRef"
      :maxlength="inputMaxLength"
      :value="draftText"
      aria-label="画布名称"
      autocomplete="off"
      class="flow-title-emoji-editor__input"
      spellcheck="false"
      type="text"
      @input="handleTextInput"
      @keydown.enter.stop.prevent="requestCommit"
    />

    <div
      v-if="emojiPickerOpen"
      aria-label="选择画布名称表情"
      class="flow-title-emoji-editor__picker"
      role="menu"
      @mousedown.prevent
    >
      <div class="flow-title-emoji-editor__grid">
        <button
          v-for="emoji in FLOW_TITLE_EMOJIS"
          :key="emoji"
          :aria-checked="draftEmoji === emoji"
          :aria-label="`使用 ${emoji} 表情`"
          class="flow-title-emoji-editor__option"
          :class="{ 'is-selected': draftEmoji === emoji }"
          role="menuitemradio"
          type="button"
          @click="selectEmoji(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <button
        class="flow-title-emoji-editor__clear"
        :class="{ 'is-selected': !draftEmoji }"
        role="menuitem"
        type="button"
        @click="selectEmoji('')"
      >
        不使用表情
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss" src="./FlowTitleEmojiEditor.scss"></style>
