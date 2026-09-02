<template>
  <Transition name="shortcuts-slide">
    <aside v-if="visible" class="shortcuts-panel">
      <header class="shortcuts-panel__header">
        <span class="shortcuts-panel__title">快捷键</span>
        <div class="shortcuts-panel__actions">
          <button class="shortcuts-panel__reset" title="重置为默认" @click="resetShortcuts">重置</button>
          <button class="shortcuts-panel__close" title="关闭" @click="$emit('update:visible', false)">×</button>
        </div>
      </header>

      <div class="shortcuts-panel__body">
        <section v-for="section in shortcutSections" :key="section.id" class="shortcut-group">
          <header class="shortcut-group__header">
            <h4>{{ section.label }}</h4>
            <span>{{ section.items.length }}</span>
          </header>
          <div class="shortcut-group__items">
            <div
              v-for="item in section.items"
              :key="item.id"
              class="shortcut-item"
              :class="{ editing: editingShortcut === item.id }"
            >
              <span class="shortcut-label">{{ item.label }}</span>
              <kbd
                class="shortcut-key"
                :class="{ editing: editingShortcut === item.id, readonly: item.readonly }"
                :title="item.readonly ? '该快捷键当前为固定说明项' : ''"
                @click="startEditShortcut(item.id)"
              >
                <span v-if="editingShortcut === item.id" class="edit-hint">{{ editBuffer || '按下快捷键...' }}</span>
                <template v-else>{{ formatShortcut(item.key) }}</template>
              </kbd>
            </div>
          </div>
        </section>
      </div>

      <footer class="shortcut-tips">按 Esc 取消编辑，按 Enter 或点击其他区域确认</footer>
    </aside>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getStorage, removeStorage, setStorage } from '@/utils/storage'
import { DEFAULT_SHORTCUTS, SHORTCUT_SECTION_DEFS } from './flowShortcuts.constants'
import './FlowShortcutsModal.css'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'update:shortcuts'])

// ---- Shortcuts management ----
const SHORTCUTS_STORAGE_KEY = 'workflow_shortcuts'

const customShortcuts = ref({})

const mergedShortcuts = computed(() => {
  const merged = {}
  for (const [k, v] of Object.entries(DEFAULT_SHORTCUTS)) {
    merged[k] = customShortcuts.value[k]?.key
      ? { ...v, key: customShortcuts.value[k].key }
      : v
  }
  return merged
})

// Emit shortcuts whenever they change
watch(mergedShortcuts, (val) => {
  emit('update:shortcuts', val)
}, { immediate: true, deep: true })

const shortcutSections = computed(() => {
  const sections = SHORTCUT_SECTION_DEFS.map(section => ({ ...section, items: [] }))
  const sectionMap = new Map(sections.map(section => [section.id, section]))
  Object.values(mergedShortcuts.value).forEach((shortcut) => {
    const category = shortcut?.category || 'workflow'
    const section = sectionMap.get(category)
    if (section) {
      section.items.push(shortcut)
    }
  })
  return sections.filter(section => section.items.length > 0)
})

function loadCustomShortcuts() {
  try {
    const saved = getStorage(SHORTCUTS_STORAGE_KEY)
    if (saved) {
      customShortcuts.value = saved
    }
  } catch (e) {
    console.error('加载快捷键配置失败:', e)
  }
}

function saveCustomShortcuts() {
  try {
    setStorage(SHORTCUTS_STORAGE_KEY, customShortcuts.value)
  } catch (e) {
    console.error('保存快捷键配置失败:', e)
  }
}

function resetShortcuts() {
  customShortcuts.value = {}
  removeStorage(SHORTCUTS_STORAGE_KEY)
}

function formatShortcut(keyConfig) {
  if (!keyConfig) return ''
  const parts = []
  if (keyConfig.ctrl) parts.push('Ctrl')
  if (keyConfig.shift) parts.push('Shift')
  if (keyConfig.alt) parts.push('Alt')
  let keyName = keyConfig.key || ''
  if (keyName.length === 1) {
    keyName = keyName.toUpperCase()
  } else if (keyName === ' ') {
    keyName = 'Space'
  } else if (keyName.startsWith('Arrow')) {
    keyName = keyName.slice(5)
  }
  parts.push(keyName)
  return parts.join(' + ')
}

const editingShortcut = ref(null)
const editBuffer = ref('')

function startEditShortcut(id) {
  if (mergedShortcuts.value[id]?.readonly) return
  editingShortcut.value = id
  editBuffer.value = ''
}

function cancelEditShortcut() {
  editingShortcut.value = null
  editBuffer.value = ''
}

function keysMatch(a, b) {
  if (!a || !b) return false
  return (a.ctrl === b.ctrl) && (a.shift === b.shift) && (a.alt === b.alt) && ((a.key || '').toLowerCase() === (b.key || '').toLowerCase())
}

function confirmEditShortcut(id, keyConfig) {
  if (!keyConfig || !keyConfig.key) {
    cancelEditShortcut()
    return
  }
  for (const [k, v] of Object.entries(mergedShortcuts.value)) {
    if (k !== id && keysMatch(v.key, keyConfig)) {
      alert(`快捷键冲突：与"${v.label}"相同`)
      cancelEditShortcut()
      return
    }
  }
  customShortcuts.value = {
    ...customShortcuts.value,
    [id]: { key: keyConfig },
  }
  saveCustomShortcuts()
  editingShortcut.value = null
  editBuffer.value = ''
}

function handleShortcutEditKeydown(e) {
  if (!editingShortcut.value) return

  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    cancelEditShortcut()
    return
  }

  if (e.key === 'Enter') {
    cancelEditShortcut()
    return
  }

  const keyConfig = {
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key,
  }

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    editBuffer.value = formatShortcut({ ...keyConfig, key: '' }).replace(/ \+ $/, '')
    return
  }

  editBuffer.value = formatShortcut(keyConfig)
  confirmEditShortcut(editingShortcut.value, keyConfig)
}

// Load on mount
loadCustomShortcuts()

// Keyboard listener for shortcut editing
watch(() => props.visible, (open) => {
  if (open) {
    window.addEventListener('keydown', handleShortcutEditKeydown, true)
  } else {
    window.removeEventListener('keydown', handleShortcutEditKeydown, true)
    editingShortcut.value = null
    editBuffer.value = ''
  }
})
</script>
