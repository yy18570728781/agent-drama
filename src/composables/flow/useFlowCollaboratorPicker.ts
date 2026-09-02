import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listFlowDepartmentSubjects,
  listFlowPermissionSuppliers,
  listFlowPermissionTenants,
  searchFlowPermissionSubjects,
  type FlowPermissionPickerItem,
} from '@/api/flowPermissionSubjects'
import type { FlowCategoryPermissionMember } from '@/api/flowCategoryPermissions'

interface UseFlowCollaboratorPickerOptions {
  existingMembers: Ref<FlowCategoryPermissionMember[]>
  visible: Ref<boolean>
}

interface UseFlowCollaboratorPickerReturn {
  allChecked: ComputedRef<boolean>
  chooseGroupMode: () => Promise<void>
  chooseSupplierMode: () => Promise<void>
  displayedItems: ComputedRef<FlowPermissionPickerItem[]>
  enterItem: (item: FlowPermissionPickerItem) => Promise<void>
  goBack: () => Promise<void>
  indeterminate: ComputedRef<boolean>
  isItemDisabled: (item: FlowPermissionPickerItem) => boolean
  isItemSelected: (item: FlowPermissionPickerItem) => boolean
  isLoading: Ref<boolean>
  modeSelected: Ref<boolean>
  modeTitle: ComputedRef<string>
  path: Ref<FlowPermissionPickerItem[]>
  removeSelected: (item: FlowPermissionPickerItem) => void
  searchKeyword: Ref<string>
  selectedItems: Ref<FlowPermissionPickerItem[]>
  toggleAll: (checked: boolean) => void
  toggleItem: (item: FlowPermissionPickerItem) => void
}

/**
 * 管理参考权限组件的租户、部门与成员批量选择流程。
 * @param options 弹窗状态与已存在的协作者。
 * @returns 层级选择、搜索、全选与已选列表状态。
 */
export function useFlowCollaboratorPicker(
  options: UseFlowCollaboratorPickerOptions,
): UseFlowCollaboratorPickerReturn {
  const modeSelected = ref(false)
  const path = ref<FlowPermissionPickerItem[]>([])
  const items = ref<FlowPermissionPickerItem[]>([])
  const tenants = ref<FlowPermissionPickerItem[]>([])
  const suppliers = ref<FlowPermissionPickerItem[]>([])
  const sourceMode = ref<'group' | 'supplier'>('group')
  const selectedItems = ref<FlowPermissionPickerItem[]>([])
  const searchKeyword = ref('')
  const searchResults = ref<FlowPermissionPickerItem[]>([])
  const isLoading = ref(false)
  let searchVersion = 0

  const displayedItems = computed(() => searchKeyword.value.trim() ? searchResults.value : items.value)
  const modeTitle = computed(() => sourceMode.value === 'supplier' ? '供应商租户' : '集团租户')
  const enabledItems = computed(() => displayedItems.value.filter((item) => !isItemDisabled(item)))
  const allChecked = computed(() =>
    !!enabledItems.value.length && enabledItems.value.every(isItemSelected),
  )
  const indeterminate = computed(() => {
    const count = enabledItems.value.filter(isItemSelected).length
    return count > 0 && count < enabledItems.value.length
  })

  function itemKey(item: FlowPermissionPickerItem): string {
    return `${item.type}-${item.id}`
  }

  function isItemDisabled(item: FlowPermissionPickerItem): boolean {
    if (item.type === 'department') return true
    return options.existingMembers.value.some(
      (member) => member.id === item.id && member.type === item.type,
    )
  }

  function isItemSelected(item: FlowPermissionPickerItem): boolean {
    if (isItemDisabled(item)) return true
    return selectedItems.value.some((selected) => itemKey(selected) === itemKey(item))
  }

  function toggleItem(item: FlowPermissionPickerItem): void {
    if (isItemDisabled(item)) return
    const key = itemKey(item)
    const exists = selectedItems.value.some((selected) => itemKey(selected) === key)
    if (exists) {
      selectedItems.value = selectedItems.value.filter((selected) => itemKey(selected) !== key)
      return
    }
    if (selectedItems.value.length >= 100) {
      ElMessage.warning('单次最多选择 100 个协作者')
      return
    }
    selectedItems.value = [...selectedItems.value, item]
  }

  function toggleAll(checked: boolean): void {
    const enabledKeys = new Set(enabledItems.value.map(itemKey))
    if (!checked) {
      selectedItems.value = selectedItems.value.filter((item) => !enabledKeys.has(itemKey(item)))
      return
    }
    const unselected = enabledItems.value.filter((item) => !isItemSelected(item))
    const remainingCount = Math.max(0, 100 - selectedItems.value.length)
    selectedItems.value = [...selectedItems.value, ...unselected.slice(0, remainingCount)]
    if (unselected.length > remainingCount) ElMessage.warning('单次最多选择 100 个协作者')
  }

  function removeSelected(item: FlowPermissionPickerItem): void {
    selectedItems.value = selectedItems.value.filter(
      (selected) => itemKey(selected) !== itemKey(item),
    )
  }

  async function loadPathItems(): Promise<void> {
    if (!path.value.length) {
      items.value = sourceMode.value === 'supplier' ? suppliers.value : tenants.value
      return
    }
    const tenant = path.value.find((item) => item.type === 'tenant')
    const department = [...path.value].reverse().find((item) => item.type === 'department')
    if (!tenant) return
    items.value = await listFlowDepartmentSubjects(tenant.id, department?.id || '')
  }

  async function chooseGroupMode(): Promise<void> {
    sourceMode.value = 'group'
    modeSelected.value = true
    path.value = []
    await loadPathItems()
  }

  async function chooseSupplierMode(): Promise<void> {
    sourceMode.value = 'supplier'
    modeSelected.value = true
    path.value = []
    isLoading.value = true
    try {
      if (!suppliers.value.length) suppliers.value = await listFlowPermissionSuppliers()
      await loadPathItems()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '供应商加载失败')
    } finally {
      isLoading.value = false
    }
  }

  async function enterItem(item: FlowPermissionPickerItem): Promise<void> {
    if (item.type === 'user') return
    path.value = item.type === 'tenant' ? [item] : [...path.value, item]
    searchKeyword.value = ''
    isLoading.value = true
    try {
      await loadPathItems()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '成员加载失败')
    } finally {
      isLoading.value = false
    }
  }

  async function goBack(): Promise<void> {
    if (!path.value.length) {
      modeSelected.value = false
      return
    }
    path.value = path.value.slice(0, -1)
    await loadPathItems()
  }

  async function search(keyword: string): Promise<void> {
    const normalized = keyword.trim()
    const version = ++searchVersion
    if (!normalized) {
      searchResults.value = []
      return
    }
    isLoading.value = true
    try {
      const results = await searchFlowPermissionSubjects(normalized)
      if (version === searchVersion) searchResults.value = results
    } catch (error) {
      if (version === searchVersion) {
        ElMessage.error(error instanceof Error ? error.message : '成员搜索失败')
      }
    } finally {
      if (version === searchVersion) isLoading.value = false
    }
  }

  watch(searchKeyword, (keyword) => { void search(keyword) })
  watch(options.visible, async (visible) => {
    if (!visible) return
    modeSelected.value = false
    path.value = []
    items.value = []
    selectedItems.value = []
    searchKeyword.value = ''
    try {
      tenants.value = await listFlowPermissionTenants()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '租户加载失败')
    }
  }, { immediate: true })

  return {
    allChecked, chooseGroupMode, chooseSupplierMode, displayedItems, enterItem, goBack,
    indeterminate, isItemDisabled, isItemSelected, isLoading, modeSelected, modeTitle,
    path, removeSelected,
    searchKeyword, selectedItems, toggleAll, toggleItem,
  }
}
