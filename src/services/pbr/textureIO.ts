import type { ExportFormat } from '@/composables/pbr/usePBRExport'

export function canvasToTGA(canvas: HTMLCanvasElement): ArrayBuffer {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)
  const src = imgData.data

  const pixelDataSize = w * h * 4
  const headerSize = 18
  const totalSize = headerSize + pixelDataSize
  const buf = new ArrayBuffer(totalSize)
  const view = new DataView(buf)

  view.setUint8(0, 0)
  view.setUint8(1, 0)
  view.setUint8(2, 2)
  view.setUint16(3, 0, true)
  view.setUint16(5, 0, true)
  view.setUint8(7, 0)
  view.setUint16(8, 0, true)
  view.setUint16(10, 0, true)
  view.setUint16(12, w, true)
  view.setUint16(14, h, true)
  view.setUint8(16, 32)
  view.setUint8(17, 0x28)

  let offset = headerSize
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      view.setUint8(offset++, src[idx + 2])
      view.setUint8(offset++, src[idx + 1])
      view.setUint8(offset++, src[idx])
      view.setUint8(offset++, src[idx + 3])
    }
  }

  return buf
}

export function downloadTGA(canvas: HTMLCanvasElement, fileName: string) {
  const buf = canvasToTGA(canvas)
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName + '.tga'
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export function canvasToBMP(canvas: HTMLCanvasElement): ArrayBuffer {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const imgData = ctx.getImageData(0, 0, w, h)
  const src = imgData.data

  const rowSize = Math.ceil((w * 3) / 4) * 4
  const pixelDataSize = rowSize * h
  const fileSize = 54 + pixelDataSize
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)

  view.setUint8(0, 0x42)
  view.setUint8(1, 0x4D)
  view.setUint32(2, fileSize, true)
  view.setUint32(6, 0, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, w, true)
  view.setInt32(22, h, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(30, 0, true)
  view.setUint32(34, pixelDataSize, true)
  view.setUint32(38, 2835, true)
  view.setUint32(42, 2835, true)
  view.setUint32(46, 0, true)
  view.setUint32(50, 0, true)

  let offset = 54
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      view.setUint8(offset++, src[idx + 2])
      view.setUint8(offset++, src[idx + 1])
      view.setUint8(offset++, src[idx])
    }
    const padding = rowSize - w * 3
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0)
    }
  }

  return buf
}

export function downloadBMP(canvas: HTMLCanvasElement, fileName: string) {
  const buf = canvasToBMP(canvas)
  const blob = new Blob([buf], { type: 'image/bmp' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName + '.bmp'
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadEXR(canvas: HTMLCanvasElement, fileName: string) {
  const { DataTexture, RGBAFormat, FloatType } = await import('three')
  const { EXRExporter } = await import('three/examples/jsm/exporters/EXRExporter.js')
  const { HalfFloatType } = await import('three')

  const ctx = canvas.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const floatData = new Float32Array(canvas.width * canvas.height * 4)
  for (let i = 0; i < imgData.data.length; i += 4) {
    floatData[i] = imgData.data[i] / 255
    floatData[i + 1] = imgData.data[i + 1] / 255
    floatData[i + 2] = imgData.data[i + 2] / 255
    floatData[i + 3] = imgData.data[i + 3] / 255
  }

  const texture = new DataTexture(floatData, canvas.width, canvas.height, RGBAFormat, FloatType)
  texture.needsUpdate = true
  const exporter = new EXRExporter()
  const exrBuffer = await exporter.parse(texture, { type: HalfFloatType })
  const blob = new Blob([exrBuffer], { type: 'image/x-exr' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName + '.exr'
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
  texture.dispose()
}

export async function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  if (format === 'tga') return new Blob([canvasToTGA(canvas)], { type: 'application/octet-stream' })
  if (format === 'bmp') return new Blob([canvasToBMP(canvas)], { type: 'image/bmp' })
  if (format === 'exr') {
    const { DataTexture, RGBAFormat, FloatType } = await import('three')
    const { EXRExporter } = await import('three/examples/jsm/exporters/EXRExporter.js')
    const { HalfFloatType } = await import('three')
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const floatData = new Float32Array(canvas.width * canvas.height * 4)
    for (let i = 0; i < imgData.data.length; i += 4) {
      floatData[i] = imgData.data[i] / 255
      floatData[i + 1] = imgData.data[i + 1] / 255
      floatData[i + 2] = imgData.data[i + 2] / 255
      floatData[i + 3] = imgData.data[i + 3] / 255
    }
    const texture = new DataTexture(floatData, canvas.width, canvas.height, RGBAFormat, FloatType)
    texture.needsUpdate = true
    const exporter = new EXRExporter()
    const exrBuffer = await exporter.parse(texture, { type: HalfFloatType })
    texture.dispose()
    return new Blob([exrBuffer], { type: 'image/x-exr' })
  }
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), mime))
}
