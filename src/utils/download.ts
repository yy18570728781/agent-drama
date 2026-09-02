import { ElMessage } from 'element-plus'
import { defineComponent, h, ref } from 'vue'

/**
 * 取媒体响应（不消费 body，留给调用方流式读取）。
 * 先直接 fetch（同源 / 服务器已带 CORS 时生效）；
 * 失败再走 /__image-proxy 代理；代理只接受配置白名单中的资源来源。
 */
async function fetchMediaResponse(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    const resp = await fetch(url, { signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp
  } catch (err) {
    if (signal?.aborted) throw err
    // 跨域被拦 → 走同源代理
    const proxyUrl = `/__image-proxy?url=${encodeURIComponent(url)}`
    const resp = await fetch(proxyUrl, { signal })
    if (!resp.ok) throw new Error(`proxy HTTP ${resp.status}`)
    return resp
  }
}

function deriveExtAndPrefix(url: string, resp: Response): { ext: string; prefix: string } {
  const ct = (resp.headers.get('content-type') || '').toLowerCase()
  const normalizedPath = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return String(url || '').toLowerCase()
    }
  })()
  const isModel = /\.(glb|gltf)(?:$|[?#])/i.test(url) || ct.includes('model/')
  if (isModel) {
    const ext = /\.gltf(?:$|[?#])/i.test(url) ? 'gltf' : 'glb'
    return { ext, prefix: 'model' }
  }
  const isVideo = ct.startsWith('video/') || /\.(mp4|webm|mov)(?:$|[?#])/i.test(url)
  if (isVideo) {
    if (normalizedPath.endsWith('.mov')) return { ext: 'mov', prefix: 'video' }
    if (normalizedPath.endsWith('.webm')) return { ext: 'webm', prefix: 'video' }
    if (normalizedPath.endsWith('.mp4')) return { ext: 'mp4', prefix: 'video' }
    if (ct === 'video/quicktime') return { ext: 'mov', prefix: 'video' }
    if (ct === 'video/webm') return { ext: 'webm', prefix: 'video' }
    return { ext: 'mp4', prefix: 'video' }
  }
  const ext = ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : 'jpg'
  return { ext, prefix: 'image' }
}

/** 用响应头里的 content-length 做百分比；拿不到就按已下载 MB 显示 */
function createProgressMessage(total: number) {
  const progress = ref(0)
  const Comp = defineComponent({
    setup() {
      return () => h('span', total > 0
        ? `正在另存为… ${progress.value}%`
        : `正在另存为… ${(progress.value / 1048576).toFixed(1)} MB`)
    }
  })
  return { progress, Comp }
}

async function blobDownload(resp: Response, suggestedName: string) {
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.style.display = 'none'
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
}

async function downloadMediaRaw(url: string) {
  const controller = new AbortController()
  const resp = await fetchMediaResponse(url, controller.signal)
  const { ext, prefix } = deriveExtAndPrefix(url, resp)
  const suggestedName = `${prefix}_${Date.now()}.${ext}`
  const total = Number(resp.headers.get('content-length')) || 0
  const pickerSupported = typeof (window as any).showSaveFilePicker === 'function'
  console.log('[downloadMedia] name=', suggestedName, 'size=', total,
    '| pickerSupported=', pickerSupported,
    '| isSecureContext=', (window as any).isSecureContext,
    '| location=', location?.href)
  if (!pickerSupported) {
    console.warn('[downloadMedia] showSaveFilePicker 不可用 → 走 blob 直接下载。'
      + ' 原因通常是当前页面不是安全上下文（非 https / 非 localhost，例如用局域网 IP http://192.168.x.x 访问）。')
  }

  // 优先「另存为」对话框 + 流式写入（边读边写，不缓冲整块到内存）
  if (pickerSupported) {
    let handle: any
    try {
      handle = await (window as any).showSaveFilePicker({ suggestedName })
    } catch (err: any) {
      controller.abort()
      if (err?.name === 'AbortError') return // 用户取消
      // 某些环境（如 Electron iframe）存在该 API 但被安全策略拦截，
      // 回退到 blob 下载，避免直接失败。
      console.warn('[downloadMedia] picker unavailable, fallback to blob:', err?.name, err)
      const fallbackResp = await fetchMediaResponse(url)
      await blobDownload(fallbackResp, suggestedName)
      return
    }
    const { progress, Comp } = createProgressMessage(total)
    const notif = (ElMessage as any)({ message: h(Comp), duration: 0, showClose: false, type: 'info' })
    try {
      const writable = await handle.createWritable()
      const reader = resp.body!.getReader()
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        await writable.write(value)
        received += value.length
        progress.value = total > 0 ? Math.round((received / total) * 100) : received
      }
      await writable.close()
      console.log('[downloadMedia] write done, bytes=', received)
    } catch (err: any) {
      console.error('[downloadMedia] write failed:', err?.name, err)
      controller.abort()
      throw err
    } finally {
      notif?.close?.()
    }
    return
  }

  // 不支持 showSaveFilePicker：缓冲成 blob 再 <a download>
  await blobDownload(resp, suggestedName)
}

/**
 * 另存为：统一封装错误处理与提示，返回是否成功完成。
 * 调用方无需再写 try/catch —— 失败已自动 toast 真实原因，用户取消静默处理。
 */
export async function downloadMedia(url: string): Promise<boolean> {
  if (!url) return false
  try {
    await downloadMediaRaw(url)
    return true
  } catch (e: any) {
    if (e?.name === 'AbortError') return false // 用户取消，静默
    console.error('[downloadMedia] failed:', e?.name, e)
    ElMessage.error(`另存为失败：${e?.message || e?.name || '未知错误'}`)
    return false
  }
}

export async function copyImageToClipboard(url: string): Promise<boolean> {
  if (!url) return false
  const resp = await fetch(url)
  const rawBlob = await resp.blob()
  const blobUrl = URL.createObjectURL(rawBlob)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('img load failed'))
    img.src = blobUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  URL.revokeObjectURL(blobUrl)
  const pngBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(b => resolve(b!), 'image/png')
  })
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': pngBlob })
    ])
    return true
  } catch {
    const dataUrl = canvas.toDataURL('image/png')
    const container = document.createElement('div')
    container.contentEditable = 'true'
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
    document.body.appendChild(container)
    container.innerHTML = `<img src="${dataUrl}">`
    const range = document.createRange()
    range.selectNodeContents(container)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
    document.execCommand('copy')
    sel.removeAllRanges()
    document.body.removeChild(container)
    return true
  }
}
