import type { Ref } from 'vue'
import type { FlowCanvasApi, FlowViewport } from './flowCore.types'

type CanvasRefLike = Readonly<Ref<FlowCanvasApi | null>>

/**
 * 延后恢复画布视口，避免 Vue Flow 尚未初始化时触发无效 setViewport 警告。
 * @param canvasRef 画布暴露实例
 * @param viewport 需要恢复的视口
 * @returns 视口成功应用或等待就绪超时后完成
 */
export async function restoreFlowViewport(
  canvasRef: CanvasRefLike,
  viewport: FlowViewport,
): Promise<void> {
  for (let attempt = 0; attempt <= 8; attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const canvasApi = canvasRef.value
    if (!canvasApi?.setViewport) continue

    const ready = typeof canvasApi.isViewportReady !== 'function' || canvasApi.isViewportReady()
    if (ready) {
      await canvasApi.setViewport(viewport)
      return
    }
  }
}
