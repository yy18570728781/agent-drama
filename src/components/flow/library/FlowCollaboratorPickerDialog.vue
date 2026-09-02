<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Icon } from '@iconify/vue'
import type { FlowCategoryPermissionMember } from '@/api/flowCategoryPermissions'
import type { FlowPermissionPickerItem } from '@/api/flowPermissionSubjects'
import { useFlowCollaboratorPicker } from '@/composables/flow/useFlowCollaboratorPicker'

const props = defineProps<{
  existingMembers: FlowCategoryPermissionMember[]
  visible: boolean
}>()

const emit = defineEmits<{
  confirm: [items: FlowPermissionPickerItem[]]
  'update:visible': [visible: boolean]
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const {
  allChecked, chooseGroupMode, chooseSupplierMode, displayedItems, enterItem, goBack,
  indeterminate, isItemDisabled, isItemSelected, isLoading, modeSelected, modeTitle,
  path, removeSelected,
  searchKeyword, selectedItems, toggleAll, toggleItem,
} = useFlowCollaboratorPicker({
  existingMembers: toRef(props, 'existingMembers'),
  visible: visibleModel,
})

function confirmSelection(): void {
  emit('confirm', [...selectedItems.value])
  visibleModel.value = false
}
</script>

<template>
  <el-dialog
    v-model="visibleModel"
    class="flow-collaborator-picker-dialog"
    width="min(94vw, 900px)"
    :show-close="false"
    append-to-body
    destroy-on-close
  >
    <header class="picker-titlebar">
      <strong>添加成员</strong>
      <button type="button" title="关闭" aria-label="关闭" @click="visibleModel = false">
        <Icon icon="lucide:x" />
      </button>
    </header>

    <div class="picker-content">
      <section class="picker-left">
        <el-input v-model="searchKeyword" clearable placeholder="请输入搜索内容">
          <template #prefix><Icon icon="lucide:search" /></template>
        </el-input>

        <div v-if="!modeSelected && !searchKeyword" class="picker-modes">
          <button class="group-mode" type="button" @click="chooseGroupMode">
            <span><Icon icon="lucide:users" /></span>
            <strong>按集团选</strong>
          </button>
          <button class="group-mode" type="button" @click="chooseSupplierMode">
            <span><Icon icon="lucide:truck" /></span>
            <strong>按供应商选</strong>
          </button>
        </div>

        <template v-else>
          <div class="picker-breadcrumb">
            <button type="button" title="返回" @click="goBack"><Icon icon="lucide:arrow-left" /></button>
            <span v-if="path.length">{{ path.map((item) => item.name).join(' / ') }}</span>
            <span v-else>{{ modeTitle }}</span>
          </div>
          <el-checkbox
            :model-value="allChecked"
            :indeterminate="indeterminate"
            :disabled="!displayedItems.length"
            @change="toggleAll(Boolean($event))"
          >全选</el-checkbox>
          <div v-loading="isLoading" class="picker-list">
            <div v-for="item in displayedItems" :key="`${item.type}-${item.id}`" class="picker-item">
              <el-checkbox
                :model-value="isItemSelected(item)"
                :disabled="isItemDisabled(item)"
                @change="toggleItem(item)"
              />
              <span class="picker-avatar">
                <Icon :icon="item.type === 'user' ? 'lucide:user' : item.type === 'tenant' ? 'lucide:building-2' : 'lucide:folder'" />
              </span>
              <button class="picker-item-name" type="button" @click="enterItem(item)">
                {{ item.name }}<small v-if="item.subCount">（{{ item.subCount }}）</small>
              </button>
              <Icon v-if="item.type !== 'user'" icon="lucide:chevron-right" />
            </div>
            <el-empty v-if="!isLoading && !displayedItems.length" description="暂无数据" :image-size="64" />
          </div>
        </template>
      </section>

      <section class="picker-right">
        <strong>已选择（{{ existingMembers.length + selectedItems.length }}）</strong>
        <div class="selected-tags">
          <el-tag
            v-for="member in existingMembers"
            :key="`existing-${member.type}-${member.id}`"
            type="info"
          >{{ member.name }}</el-tag>
          <el-tag
            v-for="item in selectedItems"
            :key="`${item.type}-${item.id}`"
            closable
            @close="removeSelected(item)"
          >{{ item.name }}</el-tag>
        </div>
      </section>
    </div>

    <footer class="picker-footer">
      <el-button @click="visibleModel = false">取消</el-button>
      <el-button type="primary" :disabled="!selectedItems.length" @click="confirmSelection">确定</el-button>
    </footer>
  </el-dialog>
</template>

<style scoped src="./FlowCollaboratorPickerDialog.scss"></style>
