import { ElMessageBox } from 'element-plus'

/**
 * 统一删除确认口径，避免不同入口的破坏性操作提示不一致。
 * @returns 单删与批删确认方法
 * @throws 用户取消确认时由底层确认框抛出
 */
export function useAssetDeleteConfirm(): {
  confirmDeleteOne: () => Promise<void>
  confirmDeleteMany: (count: number) => Promise<void>
} {
  const confirmDeleteOne = () => ElMessageBox.confirm(
    '确定删除这条记录吗？',
    '删除确认',
    {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
    },
  ).then(() => undefined)

  const confirmDeleteMany = (count: number) => ElMessageBox.confirm(
    `确定删除已选的 ${count} 条记录吗？`,
    '批量删除确认',
    {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
    },
  ).then(() => undefined)

  return {
    confirmDeleteOne,
    confirmDeleteMany,
  }
}
