import { h, nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import { RefreshCw } from '@/components/common/icon/lucide'
import type { FlowNode } from './flowCore.types'
import type {
  GenerationPipelineDeps,
  GenerationRegenerateContext,
} from './useGenerationPipeline.types'

export function useGenerationPipelineCommonActions(deps: GenerationPipelineDeps) {
  async function promptRegenerateCount(
    context: GenerationRegenerateContext,
  ): Promise<number | null> {
    const config = context?.countConfig || { label: '生成张数', min: 1, defaultValue: 1 }
    const max = Math.min(4, config.max ?? Math.max(config.min, config.defaultValue, 4))
    const min = config.min || 1
    const options: number[] = []
    for (let i = min; i <= max; i++) options.push(i)

    return new Promise<number | null>((resolve) => {
      ElMessageBox({
        title: ' ',
        message: h('div', { class: 'regen-picker' }, [
          h('div', { class: 'regen-picker-header' }, [
            h(RefreshCw, { size: 18, class: 'regen-picker-icon' }),
            h('span', null, '重新生成'),
          ]),
          h('div', { class: 'regen-picker-label' }, config.label),
          h('div', { class: 'regen-picker-grid' },
            options.map((n) => h('button', {
              class: 'regen-card',
              onClick: () => { ElMessageBox.close(); resolve(n) },
            }, [
              h('span', { class: 'regen-card-num' }, String(n)),
              h('span', { class: 'regen-card-unit' }, '张'),
            ])),
          ),
        ]),
        showConfirmButton: false,
        showCancelButton: false,
        closeOnClickModal: true,
        customClass: 'regen-picker-dialog',
      }).catch(() => resolve(null))
    })
  }

  async function ensureCanStartRegenerate(requiredCount: number): Promise<void> {
    const storeAny = deps.taskQueueStore
    const tryAssert = () => {
      if (typeof storeAny.assertCanStartSubmission === 'function') {
        storeAny.assertCanStartSubmission(requiredCount)
        return true
      }
      if (typeof storeAny.assertCanEnqueue === 'function') {
        storeAny.assertCanEnqueue(requiredCount)
        return true
      }
      return false
    }

    try {
      if (tryAssert()) return
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      const looksLikeQueueFull =
        message.includes('生成队列')
        || message.includes('队列已满')
        || message.includes('只能有')

      if (looksLikeQueueFull && typeof storeAny.reconcileQueueState === 'function') {
        await storeAny.reconcileQueueState()
        if (tryAssert()) return
      }
      throw e
    }
  }

  async function focusReeditNode(node: FlowNode): Promise<void> {
    if (!node) return
    const previousNode = deps.selectedPanelNode.value
      ? (deps.findNode(deps.selectedPanelNode.value.id) || deps.nodes.value.find((item) => item.id === deps.selectedPanelNode.value.id) || deps.selectedPanelNode.value)
      : null
    if (previousNode?.id) {
      if (previousNode.data && typeof previousNode.data === 'object') {
        previousNode.data._skipPanelStateSaveOnce = true
      }
    }
    let freshNode = deps.findNode(node.id) || deps.nodes.value.find((item) => item.id === node.id) || node
    deps.removeSelectedNodes(deps.getSelectedNodes.value)
    deps.addSelectedNodes([freshNode])
    await nextTick()
    deps.updateNodeInternals([freshNode.id])
    await nextTick()
    freshNode = deps.findNode(node.id) || deps.nodes.value.find((item) => item.id === node.id) || freshNode
    deps.panelSwitchLockedNodeId.value = freshNode.id
    deps.panelSwitchLockUntil.value = Date.now() + 400
    deps.selectedPanelNode.value = freshNode
    if (deps.generationPanelLayoutTick?.value !== undefined) {
      deps.generationPanelLayoutTick.value += 1
    }
    if (deps.panelVisible?.value !== undefined) {
      deps.panelVisible.value = true
    }
    deps.emit('node-select', freshNode)
    await nextTick()
    deps.scheduleGenerationPanelViewportAdjustment?.()
  }

  return { promptRegenerateCount, ensureCanStartRegenerate, focusReeditNode }
}
