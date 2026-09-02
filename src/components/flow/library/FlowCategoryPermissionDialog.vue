<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { Icon } from '@iconify/vue'
import { getStoredAuthUserInfo } from '@/api/tokenStorage'
import type { TeamonesUserInfo } from '@/api/auth'
import type { FlowCategoryPermissionMember } from '@/api/flowCategoryPermissions'
import type { FlowPermissionPickerItem } from '@/api/flowPermissionSubjects'
import { useFlowCategoryPermissions } from '@/composables/flow/useFlowCategoryPermissions'
import { FLOW_CATEGORY_PERMISSION } from './flowCategoryPermission.constants'
import FlowCollaboratorPickerDialog from './FlowCollaboratorPickerDialog.vue'
import FlowPermissionConfirmDialog from './FlowPermissionConfirmDialog.vue'
import FlowPermissionMemberList from './FlowPermissionMemberList.vue'

const props = defineProps<{
  categoryId: string
  categoryName: string
  lockedUserIds: string[]
  visible: boolean
}>()

const emit = defineEmits<{
  updated: []
  'update:visible': [visible: boolean]
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})
const collaboratorPickerVisible = ref(false)
const permissionConfirmVisible = ref(false)
const pendingMembers = ref<FlowCategoryPermissionMember[]>([])
const authUserInfo = getStoredAuthUserInfo() as TeamonesUserInfo | null
const tenantName = authUserInfo?.tenant?.name || '当前团队'

const {
  addMembers, inheritToChildren, isLoading, members, removeMember, removeMembers,
  updateMember, updateMembers,
} = useFlowCategoryPermissions({
  categoryId: toRef(props, 'categoryId'),
  lockedUserIds: toRef(props, 'lockedUserIds'),
  onUpdated: () => emit('updated'),
  visible: visibleModel,
})

function handlePickerConfirm(items: FlowPermissionPickerItem[]): void {
  pendingMembers.value = items
    .filter((item) => item.type !== 'department')
    .map((item) => ({
      id: item.id,
      name: item.name,
      permission: FLOW_CATEGORY_PERMISSION.VIEW,
      permissionId: '',
      type: item.type === 'tenant' ? 'tenant' : 'user',
    }))
  permissionConfirmVisible.value = !!pendingMembers.value.length
}

async function handlePermissionConfirm(
  nextMembers: FlowCategoryPermissionMember[],
  inherit: boolean,
): Promise<void> {
  const failedMembers = await addMembers(nextMembers, inherit)
  pendingMembers.value = failedMembers
  if (failedMembers.length) return
  permissionConfirmVisible.value = false
}

function resetNestedDialogs(): void {
  collaboratorPickerVisible.value = false
  permissionConfirmVisible.value = false
  pendingMembers.value = []
}
</script>

<template>
  <el-dialog
    v-model="visibleModel"
    class="flow-permission-dialog"
    width="min(92vw, 660px)"
    :show-close="false"
    destroy-on-close
    @closed="resetNestedDialogs"
  >
    <header class="permission-titlebar">
      <strong>【{{ categoryName }}】权限管理</strong>
      <button type="button" title="关闭" aria-label="关闭" @click="visibleModel = false">
        <Icon icon="lucide:x" />
      </button>
    </header>

    <div class="permission-dialog-content">
      <div class="dialog-header">
        <strong>所有协作者</strong>
        <el-button link type="primary" @click="collaboratorPickerVisible = true">
          <Icon icon="lucide:plus" />添加协作者
        </el-button>
      </div>

      <FlowPermissionMemberList
        v-model:inherit-to-children="inheritToChildren"
        :is-loading="isLoading"
        :locked-user-ids="lockedUserIds"
        :members="members"
        :tenant-name="tenantName"
        @batch-permission="updateMembers"
        @batch-remove="removeMembers"
        @permission="updateMember"
        @remove="removeMember"
      />
    </div>

    <FlowCollaboratorPickerDialog
      v-model:visible="collaboratorPickerVisible"
      :existing-members="members"
      @confirm="handlePickerConfirm"
    />
    <FlowPermissionConfirmDialog
      v-model:visible="permissionConfirmVisible"
      :members="pendingMembers"
      @confirm="handlePermissionConfirm"
    />
  </el-dialog>
</template>

<style scoped src="./FlowCategoryPermissionDialog.scss"></style>
