<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { FlowCategoryPermissionMember } from '@/api/flowCategoryPermissions'
import { FLOW_CATEGORY_PERMISSION_OPTIONS } from './flowCategoryPermission.constants'

const props = defineProps<{
  members: FlowCategoryPermissionMember[]
  visible: boolean
}>()

const emit = defineEmits<{
  confirm: [members: FlowCategoryPermissionMember[], inherit: boolean]
  'update:visible': [visible: boolean]
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})
const draftMembers = ref<FlowCategoryPermissionMember[]>([])
const inheritToChildren = ref(true)

function permissionLabel(permission: number): string {
  return FLOW_CATEGORY_PERMISSION_OPTIONS.find((option) => option.value === permission)?.label || '仅可查看'
}

function handleMemberCommand(command: string, member: FlowCategoryPermissionMember): void {
  if (command === 'remove') {
    draftMembers.value = draftMembers.value.filter((item) => item !== member)
    return
  }
  const option = FLOW_CATEGORY_PERMISSION_OPTIONS.find((item) => item.command === command)
  if (option) member.permission = option.value
}

function handleBatchCommand(command: string): void {
  const option = FLOW_CATEGORY_PERMISSION_OPTIONS.find((item) => item.command === command)
  if (!option) return
  draftMembers.value.forEach((member) => { member.permission = option.value })
}

function confirmPermissions(): void {
  emit('confirm', draftMembers.value.map((member) => ({ ...member })), inheritToChildren.value)
}

watch(
  () => [props.visible, props.members] as const,
  ([visible]) => {
    if (!visible) return
    draftMembers.value = props.members.map((member) => ({ ...member }))
    inheritToChildren.value = true
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <el-dialog
    v-model="visibleModel"
    class="flow-permission-confirm-dialog"
    width="min(92vw, 600px)"
    :show-close="false"
    append-to-body
    destroy-on-close
  >
    <header class="confirm-titlebar">
      <strong>添加协作者</strong>
      <button type="button" title="关闭" aria-label="关闭" @click="visibleModel = false">
        <Icon icon="lucide:x" />
      </button>
    </header>

    <div class="confirm-permission-list">
      <div class="confirm-toolbar">
        <span>已选择 {{ draftMembers.length }} 个协作者</span>
        <el-dropdown
          :disabled="!draftMembers.length"
          popper-class="flow-permission-options-popper"
          @command="handleBatchCommand"
        >
          <button class="batch-permission-button" type="button">批量修改权限 <Icon icon="lucide:chevron-down" /></button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="option in FLOW_CATEGORY_PERMISSION_OPTIONS"
                :key="option.command"
                :command="option.command"
              >
                <span class="permission-option-content">
                  <Icon :icon="option.icon" />
                  <span><strong>{{ option.label }}</strong><small>{{ option.remark }}</small></span>
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="confirm-list-content">
        <div v-for="member in draftMembers" :key="`${member.type}-${member.id}`" class="confirm-member">
          <span class="confirm-avatar"><Icon :icon="member.type === 'tenant' ? 'lucide:building-2' : 'lucide:user'" /></span>
          <strong>{{ member.name }}</strong>
          <el-dropdown popper-class="flow-permission-options-popper" @command="handleMemberCommand($event, member)">
            <button class="member-permission-button" type="button">
              {{ permissionLabel(member.permission) }} <Icon icon="lucide:chevron-down" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in FLOW_CATEGORY_PERMISSION_OPTIONS"
                  :key="option.command"
                  :command="option.command"
                >
                  <span class="permission-option-content">
                    <Icon :icon="option.icon" />
                    <span><strong>{{ option.label }}</strong><small>{{ option.remark }}</small></span>
                  </span>
                </el-dropdown-item>
                <el-dropdown-item class="permission-option-remove" command="remove" divided>移除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <footer class="confirm-footer">
      <span><el-switch v-model="inheritToChildren" />下级是否继承</span>
      <span>
        <el-button @click="visibleModel = false">取消</el-button>
        <el-button type="primary" :disabled="!draftMembers.length" @click="confirmPermissions">确定</el-button>
      </span>
    </footer>
  </el-dialog>
</template>

<style scoped src="./FlowPermissionConfirmDialog.scss"></style>
