/**
 * 积分中心 CSV 导出工具
 *
 * 生成标准 CSV 文本（UTF-8 BOM，Excel 可直接打开），通过浏览器下载。
 */

/** CSV 行转义：含逗号/引号/换行的字段用双引号包裹，内部引号双写 */
function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/["\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(escapeCsvField).join(',')).join('\r\n')
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/** 导出用户积分账户数据 */
export function exportUserAccountsCsv(
  accounts: Array<{
    user?: { name?: string; phone?: string }
    balance?: number
    total_consumed?: number
    status?: number
  }>,
): void {
  const header = ['用户名', '手机号', '余额', '已消费', '状态']
  const rows = accounts.map(a => [
    a.user?.name || '-',
    a.user?.phone || '-',
    a.balance ?? 0,
    a.total_consumed ?? 0,
    a.status === 1 ? '启用' : '禁用',
  ])
  triggerDownload(`用户积分账户_${timestamp()}.csv`, buildCsv([header, ...rows]))
}

/** 导出分组积分账户数据 */
export function exportGroupAccountsCsv(
  groups: Array<{
    name?: string
    balance?: number
    total_consumed?: number
    account_status?: number
  }>,
): void {
  const header = ['分组名称', '余额', '已消费', '状态']
  const rows = groups.map(g => [
    g.name || '-',
    g.balance ?? 0,
    g.total_consumed ?? 0,
    g.account_status === 1 ? '启用' : '禁用',
  ])
  triggerDownload(`分组积分账户_${timestamp()}.csv`, buildCsv([header, ...rows]))
}
