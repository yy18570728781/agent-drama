import mammoth from 'mammoth'

export interface ParsedFileResult {
  filename: string
  file_type: 'txt' | 'pdf' | 'docx'
  file_size: number
  text: string
  char_count: number
  truncated: boolean
}

/**
 * 上传文档文件并解析提取文本内容。
 * 支持 .txt / .pdf / .docx 格式。
 */
export async function parseFile(file: File): Promise<ParsedFileResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  let text = ''
  if (extension === 'txt') text = await file.text()
  else if (extension === 'docx') text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  else throw new Error('PDF 本地解析尚未支持，请转换为 TXT 或 DOCX')
  const maxLength = 200_000
  return {
    filename: file.name,
    file_type: extension as 'txt' | 'docx',
    file_size: file.size,
    text: text.slice(0, maxLength),
    char_count: text.length,
    truncated: text.length > maxLength,
  }
}
