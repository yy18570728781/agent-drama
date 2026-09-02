<template>
  <div class="prompt-input-wrap" :class="{ 'is-multiline-batch': multilineBatchMode && multilinePrompts.length > 1 }">
    <div class="prompt-input-main-row">
      <!-- 多行提示词卡片 -->
      <div v-if="multilineBatchMode && multilinePrompts.length > 1" class="multiline-prompt-cards">
        <div v-for="(p, i) in multilinePrompts" :key="i" class="multiline-prompt-card" :title="p">
          <span class="multiline-prompt-card-idx">{{ i + 1 }}</span>
          <span class="multiline-prompt-card-text">{{ p.length > 40 ? p.slice(0, 40) + '…' : p }}</span>
        </div>
      </div>
      <div ref="textareaRef" contenteditable="true" role="textbox" aria-multiline="true"
        :aria-label="editorAriaLabel"
        autocorrect="off" autocomplete="off" spellcheck="false"
        class="prompt-editor w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed overflow-y-auto py-2 transition-all duration-300"
        :class="isTextExpanded ? 'flex-1 min-h-0' : 'min-h-[140px] max-h-[320px]'"
        :data-placeholder="modelValue ? '' : (placeholder || '说说你想做什么吧')"
        @focus="prepareEmptyEditor"
        @input="onPromptInput"
        @copy="onPromptCopy"
        @paste="onPromptPaste"
        @keydown="onPromptKeydown"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"></div>
      <!-- @ 引用下拉菜单 -->
      <ReferenceMenu
        :visible="showRefMenu"
        :menu-position="menuPosition"
        :ref-images="refImages"
        :active-item-id="activeItemId"
        :get-display-label="getReferenceDisplayLabel"
        :get-ordinal="getReferenceOrdinal"
        :search-query="refSearchQuery"
        :subjects="atMenuSubjects"
        :subjects-loading="atMenuSubjectsLoading"
        :category-bar="atMenuCategoryBar"
        @select-ref="insertRef"
        @select-subject="selectSubject"
        @set-active="setActiveByItemId"
        @update:search-query="refSearchQuery = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReferenceMenu from './ReferenceMenu.vue'
import { usePromptInputSetup } from './usePromptInputSetup'
import type { PromptInputProps, PromptInputEmits } from './promptInput/types'

const props = defineProps<PromptInputProps>()
const emit = defineEmits<PromptInputEmits>()
const editorAriaLabel = computed<string>(() => props.ariaLabel || props.placeholder || '提示词')
const { exposed, ...bindings } = usePromptInputSetup(props, emit)
const {
  textareaRef,
  showRefMenu,
  menuPosition,
  refSearchQuery,
  activeItemId,
  multilinePrompts,
  atMenuSubjects,
  atMenuSubjectsLoading,
  atMenuCategoryBar,
  getReferenceDisplayLabel,
  getReferenceOrdinal,
  setActiveByItemId,
  insertRef,
  selectSubject,
  prepareEmptyEditor,
  onPromptInput,
  onPromptCopy,
  onPromptPaste,
  onPromptKeydown,
} = bindings

function onCompositionStart() {
  bindings.isComposing.value = true
}

function onCompositionEnd(event: CompositionEvent) {
  bindings.isComposing.value = false
  bindings.finishComposition(event.data)
}

defineExpose(exposed)
</script>

<style scoped>
.prompt-input-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 0%;
  min-width: 0;
}
.prompt-input-main-row {
  display: flex;
  flex: 1 1 0%;
  min-width: 0;
  align-items: stretch;
  min-height: 140px;
}

/* 多行批量模式：提示词卡片在左侧 */
.prompt-input-wrap.is-multiline-batch .prompt-input-main-row {
  gap: 8px;
}
.prompt-input-wrap.is-multiline-batch .prompt-editor {
  width: auto;
  flex: 1;
  min-width: 0;
}

/* 多行提示词卡片列表 */
.multiline-prompt-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  width: 80px;
  max-height: 100%;
  overflow-y: auto;
  padding: 2px 0;
}
.multiline-prompt-cards::-webkit-scrollbar {
  width: 3px;
}
.multiline-prompt-cards::-webkit-scrollbar-thumb {
  background: rgba(113, 113, 122, 0.3);
  border-radius: 2px;
}

.multiline-prompt-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(39, 39, 42, 0.5);
  border: 1px solid rgba(63, 63, 70, 0.4);
  cursor: default;
  flex-shrink: 0;
}
.multiline-prompt-card:hover {
  background: rgba(63, 63, 70, 0.5);
  border-color: rgba(113, 113, 122, 0.4);
}
.multiline-prompt-card-idx {
  font-size: 10px;
  color: #fbbf24;
  font-weight: 600;
}
.multiline-prompt-card-text {
  font-size: 11px;
  color: #a1a1aa;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

/* Textarea dark style */
.prompt-editor {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 140px;
  box-sizing: border-box;
  flex: 1 1 auto;
  color: var(--generator-text-primary) !important;
  padding-left: 8px !important;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}
.prompt-editor:empty:before {
  content: attr(data-placeholder);
  color: var(--generator-text-muted);
  pointer-events: none;
}
.prompt-editor:focus {
  outline: none;
}

/* @ 引用标签 */
.ref-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 2px;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 3px;
  color: #93c5fd;
  font-size: 13px;
  line-height: 1.5;
  vertical-align: middle;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  position: relative;
}
.ref-tag:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}
.ref-tag > img,
.ref-tag-thumb {
  display: inline-block;
  width: 30px !important;
  height: 15px !important;
  min-width: 30px !important;
  min-height: 15px !important;
  max-width: 30px !important;
  max-height: 15px !important;
  object-fit: cover;
  border-radius: 2px;
  border: 0.5px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  vertical-align: middle;
}
.ref-tag:hover > img,
.ref-tag:hover .ref-tag-thumb {
  position: absolute;
  width: 120px !important;
  height: 180px !important;
  min-width: 120px !important;
  min-height: 180px !important;
  max-width: 120px !important;
  max-height: 180px !important;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}
</style>
