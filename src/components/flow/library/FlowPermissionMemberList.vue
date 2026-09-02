<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { FlowCategoryPermissionMember } from '@/api/flowCategoryPermissions'
import { FLOW_CATEGORY_PERMISSION_OPTIONS } from './flowCategoryPermission.constants'

const props = defineProps<{
  inheritToChildren: boolean
  isLoading: boolean
  lockedUserIds: string[]
  members: FlowCategoryPermissionMember[]
  tenantName: string
}>()

const emit = defineEmits<{
  batchPermission: [members: FlowCategoryPermissionMember[], permission: number]
  batchRemove: [members: FlowCategoryPermissionMember[]]
  permission: [member: FlowCategoryPermissionMember, permission: number]
  remove: [member: FlowCategoryPermissionMember]
  'update:inheritToChildren': [value: boolean]
}>()

const filterKeyword = ref('')
const selectedKeys = ref<string[]>([])
const filteredMembers = computed(() => {
  const keyword = filterKeyword.value.trim().toLocaleLowerCase()
  return keyword
    ? props.members.filter((member) => member.name.toLocaleLowerCase().includes(keyword))
    : props.members
})
const editableMembers = computed(() => filteredMembers.value.filter((member) => !isLocked(member)))
const selectedMembers = computed(() => props.members.filter((member) =>
  selectedKeys.value.includes(memberKey(member)) && !isLocked(member)))
const allChecked = computed(() =>
  !!editableMembers.value.length
  && editableMembers.value.every((member) => selectedKeys.value.includes(memberKey(member))),
)
const indeterminate = computed(() => {
  const count = editableMembers.value.filter((member) => selectedKeys.value.includes(memberKey(member))).length
  return count > 0 && count < editableMembers.value.length
})
const tenantCount = computed(() => props.members.filter((member) => member.type === 'tenant').length)
const userCount = computed(() => props.members.filter((member) => member.type === 'user').length)
const selectedTenantCount = computed(() => selectedMembers.value.filter((member) => member.type === 'tenant').length)
const selectedUserCount = computed(() => selectedMembers.value.filter((member) => member.type === 'user').length)

function memberKey(member: FlowCategoryPermissionMember): string {
  return `${member.type}-${member.id}`
}

function isLocked(member: FlowCategoryPermissionMember): boolean {
  return member.type === 'user' && props.lockedUserIds.includes(member.id)
}

function permissionLabel(permission: number): string {
  return FLOW_CATEGORY_PERMISSION_OPTIONS.find((option) => option.value === permission)?.label || '仅可查看'
}

function toggleAll(checked: boolean): void {
  const editableKeys = editableMembers.value.map(memberKey)
  selectedKeys.value = checked
    ? Array.from(new Set([...selectedKeys.value, ...editableKeys]))
    : selectedKeys.value.filter((key) => !editableKeys.includes(key))
}

function handleMemberCommand(command: string, member: FlowCategoryPermissionMember): void {
  if (command === 'remove') {
    emit('remove', member)
    return
  }
  const option = FLOW_CATEGORY_PERMISSION_OPTIONS.find((item) => item.command === command)
  if (option) emit('permission', member, option.value)
}

function handleBatchCommand(command: string): void {
  if (command === 'remove') {
    emit('batchRemove', selectedMembers.value)
    return
  }
  const option = FLOW_CATEGORY_PERMISSION_OPTIONS.find((item) => item.command === command)
  if (!option) return
  emit('batchPermission', selectedMembers.value, option.value)
}
</script>

<template>
  <section v-loading="isLoading" class="selection-area">
    <div class="selection-header">
      <el-checkbox
        :model-value="allChecked"
        :indeterminate="indeterminate"
        :disabled="!editableMembers.length"
        @change="toggleAll(Boolean($event))"
      >全选</el-checkbox>
      <el-input v-model="filterKeyword" clearable placeholder="搜索协作者">
        <template #prefix><Icon icon="lucide:search" /></template>
      </el-input>
    </div>
    <div class="summary-info">{{ tenantName }} 成员 {{ tenantCount }} 租户，{{ userCount }} 人</div>
    <el-checkbox-group v-model="selectedKeys" class="permission-list">
      <div
        v-for="member in filteredMembers"
        :key="memberKey(member)"
        class="permission-member"
        :class="{ 'is-disabled': isLocked(member) }"
      >
        <el-checkbox :value="memberKey(member)" :disabled="isLocked(member)" />
        <span class="member-avatar"><Icon :icon="member.type === 'tenant' ? 'lucide:building-2' : 'lucide:user'" /></span>
        <span class="member-info"><strong>{{ member.name }}</strong><small>{{ member.type === 'tenant' ? '租户' : '成员' }}</small></span>
        <el-dropdown
          :disabled="isLocked(member)"
          popper-class="flow-permission-options-popper"
          @command="handleMemberCommand($event, member)"
        >
          <button class="member-permission-button" type="button" :disabled="isLocked(member)">
            {{ permissionLabel(member.permission) }} <Icon icon="lucide:chevron-down" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="option in FLOW_CATEGORY_PERMISSION_OPTIONS" :key="option.command" :command="option.command">
                <span class="permission-option-content"><Icon :icon="option.icon" /><span><strong>{{ option.label }}</strong><small>{{ option.remark }}</small></span></span>
              </el-dropdown-item>
              <el-dropdown-item class="permission-option-remove" command="remove" divided>
                <span class="permission-option-content"><Icon icon="lucide:trash-2" /><strong>移除</strong></span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <el-empty v-if="!isLoading && !filteredMembers.length" description="暂无权限数据" :image-size="72" />
    </el-checkbox-group>
    <div v-if="selectedMembers.length" class="selected-footer">
      <span>已勾选 {{ selectedTenantCount }} 租户 {{ selectedUserCount }} 人</span>
      <el-dropdown popper-class="flow-permission-options-popper" @command="handleBatchCommand">
        <button type="button">批量修改权限 <Icon icon="lucide:chevron-down" /></button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="option in FLOW_CATEGORY_PERMISSION_OPTIONS" :key="option.command" :command="option.command">
              <span class="permission-option-content"><Icon :icon="option.icon" /><span><strong>{{ option.label }}</strong><small>{{ option.remark }}</small></span></span>
            </el-dropdown-item>
            <el-dropdown-item class="permission-option-remove" command="remove" divided>
              <span class="permission-option-content"><Icon icon="lucide:trash-2" /><strong>移除</strong></span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="permission-inherit">
      <el-switch
        :model-value="inheritToChildren"
        @update:model-value="emit('update:inheritToChildren', Boolean($event))"
      />
      <span :class="{ active: inheritToChildren }">下级是否继承</span>
    </div>
  </section>
</template>

<style scoped src="./FlowPermissionMemberList.scss"></style>
