<script setup lang="ts">
import { LoaderCircle, MoreHorizontal, Pencil, Trash2 } from '@/components/common/icon/lucide'

defineOptions({ name: 'DiscoverCaseManageMenu' })

const props = defineProps<{
  pending: boolean
}>()

const emit = defineEmits<{
  delete: []
  edit: []
}>()

type ManageCommand = 'delete' | 'edit'

function handleCommand(command: ManageCommand): void {
  if (props.pending) return
  emit(command)
}
</script>

<template>
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    popper-class="discover-case-manage-menu-popper"
    :disabled="pending"
    @command="handleCommand"
  >
    <button
      type="button"
      class="discover-case-manage-menu__trigger"
      :disabled="pending"
      :aria-label="pending ? '案例操作处理中' : '更多案例操作'"
      title="更多操作"
    >
      <LoaderCircle v-if="pending" class="discover-case-manage-menu__spinner" :size="16" aria-hidden="true" />
      <MoreHorizontal v-else :size="18" :stroke-width="1.8" aria-hidden="true" />
    </button>
    <template #dropdown>
      <el-dropdown-menu class="discover-case-manage-menu">
        <el-dropdown-item command="edit">
          <Pencil :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>编辑</span>
        </el-dropdown-item>
        <el-dropdown-item class="is-danger" command="delete" divided>
          <Trash2 :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>删除</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped src="./DiscoverCaseManageMenu.scss"></style>
