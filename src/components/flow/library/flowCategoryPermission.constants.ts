export const FLOW_CATEGORY_PERMISSION = {
  REMOVE: 0,
  VIEW: 1,
  DOWNLOAD: 3,
  EDIT: 7,
  MANAGE: 31,
} as const

export const FLOW_CATEGORY_PERMISSION_OPTIONS = [
  {
    command: 'manage', icon: 'lucide:lock', label: '可管理',
    remark: '可编辑/上传/下载/删除', value: FLOW_CATEGORY_PERMISSION.MANAGE,
  },
  {
    command: 'edit', icon: 'lucide:pencil', label: '可编辑',
    remark: '可编辑/上传', value: FLOW_CATEGORY_PERMISSION.EDIT,
  },
  {
    command: 'download', icon: 'lucide:download', label: '可下载',
    remark: '仅可下载', value: FLOW_CATEGORY_PERMISSION.DOWNLOAD,
  },
  {
    command: 'view', icon: 'lucide:eye', label: '仅可查看',
    remark: '仅可查看', value: FLOW_CATEGORY_PERMISSION.VIEW,
  },
] as const
