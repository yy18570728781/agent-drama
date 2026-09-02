export const FLOW_TITLE_EMOJIS = [
  '📝', '📊', '📈', '📌', '💡', '⭐', '🔥', '✅',
  '🎯', '🚀', '📚', '📁', '💼', '🧠', '💻', '🎨',
  '🧩', '🔍', '📅', '🗂️', '🔖', '❤️', '🎉', '👏',
  '😊', '🙂', '😎', '🤔', '⚡', '🌟', '🌈', '🍀',
  '🌻', '🐱', '🐶', '🦊', '🐼', '🍎', '☕', '🏆',
  '🎵', '🌍', '🔧', '🛠️', '🔒', '🔔', '💬', '✨',
] as const

const LEADING_TITLE_EMOJI = /^((?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*))\s*(.*)$/u

/**
 * 将名称开头的 emoji 与正文拆开，保持与 Univer 标题协议一致。
 * @param title 完整画布名称
 * @returns emoji 与名称正文
 */
export function splitFlowTitleEmoji(title: string): { emoji: string; text: string } {
  const trimmed = title.trim()
  const match = LEADING_TITLE_EMOJI.exec(trimmed)
  if (!match) return { emoji: '', text: trimmed }
  return { emoji: match[1] ?? '', text: match[2] ?? '' }
}

/**
 * 将 emoji 与输入正文组合为可走原重命名链路的画布名称。
 * @param emoji 选中的 emoji
 * @param text 正在编辑的名称正文
 * @param maxLength 完整名称最大长度
 * @returns 完整画布名称
 */
export function composeFlowTitleEmoji(emoji: string, text: string, maxLength: number): string {
  const prefix = emoji ? `${emoji} ` : ''
  const availableLength = Math.max(0, maxLength - prefix.length)
  return `${prefix}${text.slice(0, availableLength)}`
}
