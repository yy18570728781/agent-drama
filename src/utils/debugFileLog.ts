type DebugDetail = unknown

function serialize(detail?: DebugDetail) {
  if (detail == null) return ''
  try {
    return JSON.stringify(detail)
  } catch (error: any) {
    return JSON.stringify({
      serializationError: String(error?.message || error || ''),
      fallback: String(detail),
    })
  }
}

export function appendDebugFileLog(_scope: string, _message: string, _detail?: DebugDetail) {
  const line = `[${new Date().toISOString()}] [${_scope}] ${_message}${_detail == null ? '' : ` ${serialize(_detail)}`}`
  try {
    // eslint-disable-next-line no-console
    console.log(line)
  } catch {}
}

export function clearDebugFileLog() {
  // 控制台原生日志模式下，不再清文件、不再调试端点、不再写 localStorage。
}
