<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import NodePortsOverlay from '@/components/flow/NodePortsOverlay.vue'
import { ArrowUpRight } from '@/components/common/icon/lucide'
import { useTextureMaterialPBRBridge } from '@/composables/flow/useTextureMaterialPBRBridge'
import { getTextureMaterialPortLabel, TEXTURE_MATERIAL_PORT_ORDER } from '@/composables/flow/textureMaterialConsumerNode'

const props = defineProps({
  id: String,
  type: String,
  data: { type: Object, default: () => ({}) },
  selected: Boolean,
})

const flowNodes = inject('flowNodes', ref<any[]>([]))
const flowEdges = inject('flowEdges', ref<any[]>([]))
const { openTextureMaterialInPBR } = useTextureMaterialPBRBridge()

const inputPorts = computed(() => props.data?.ports?.inputs || [])
const outputPorts = computed(() => props.data?.ports?.outputs || [])

const connectedItems = computed(() => {
  const nodes = flowNodes.value || []
  const edges = flowEdges.value || []
  const nodeId = String(props.id || '')
  const itemByChannel = new Map<string, any>()
  const incomingEdges = [...edges].reverse().filter((edge: any) => edge?.target === nodeId)
  incomingEdges.forEach((edge: any) => {
    const sourceNode = nodes.find((node: any) => node?.id === edge.source)
    const sourceData = sourceNode?.data || {}
    const channel = String(sourceData.pbrChannel || '').trim()
    if (!channel || !TEXTURE_MATERIAL_PORT_ORDER.includes(channel as any) || itemByChannel.has(channel)) return
    const url = String(sourceData.url || sourceData.preview || '').trim()
    const thumb = String(sourceData.thumb || url).trim()
    itemByChannel.set(channel, {
      channel,
      label: getTextureMaterialPortLabel(channel),
      url,
      thumb,
      pbrChannel: channel,
      data: {
        label: getTextureMaterialPortLabel(channel),
        url,
        thumb,
      },
    })
  })
  const items = TEXTURE_MATERIAL_PORT_ORDER.map((channel) => {
    return itemByChannel.get(channel) || {
      channel,
      label: getTextureMaterialPortLabel(channel),
      url: '',
      thumb: '',
      pbrChannel: channel,
      data: { label: getTextureMaterialPortLabel(channel) },
    }
  })
  const legacyItems = Array.isArray(props.data?.items) ? props.data.items : []
  if (items.some((item) => item.url)) return items
  return legacyItems.map((item: any) => ({
    channel: String(item?.pbrChannel || '').trim(),
    label: getTextureMaterialPortLabel(String(item?.pbrChannel || '').trim()),
    url: String(item?.data?.url || item?.data?.preview || '').trim(),
    thumb: String(item?.data?.thumb || item?.data?.url || item?.data?.preview || '').trim(),
    pbrChannel: String(item?.pbrChannel || '').trim(),
    data: item?.data || {},
  }))
})

const visibleItems = computed(() => connectedItems.value.filter((item) => item.url || item.thumb))
const itemByChannel = computed(() => {
  return new Map(connectedItems.value.map((item) => [item.channel, item]))
})

async function handleOpenPBR() {
  await openTextureMaterialInPBR(connectedItems.value as any)
}
</script>

<template>
  <div class="tm-node group" :class="{ selected }">
    <NodePortsOverlay
      :input-ports="inputPorts"
      :output-ports="outputPorts"
    />

    <div class="tm-node-toolbar" :class="{ active: selected }">
      <button class="tm-node-toolbar-btn" title="打开到 3D 材质工具" @click.stop="handleOpenPBR">
        <ArrowUpRight class="w-4 h-4" />
      </button>
    </div>

    <div class="tm-node-header">
      <span class="tm-node-title">{{ data?.label || '3D材质' }}</span>
      <span class="tm-node-count">{{ visibleItems.length }}/{{ TEXTURE_MATERIAL_PORT_ORDER.length }}</span>
    </div>

    <div class="tm-node-grid">
      <div v-for="channel in TEXTURE_MATERIAL_PORT_ORDER" :key="channel" class="tm-node-slot">
        <div class="tm-node-slot-label">{{ getTextureMaterialPortLabel(channel) }}</div>
        <div class="tm-node-slot-preview">
          <img
            v-if="itemByChannel.get(channel)?.thumb || itemByChannel.get(channel)?.url"
            :src="itemByChannel.get(channel)?.thumb || itemByChannel.get(channel)?.url"
            :alt="getTextureMaterialPortLabel(channel)"
            loading="lazy"
          />
          <div v-else class="tm-node-slot-empty">未连接</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tm-node {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(26, 27, 31, 0.98), rgba(16, 17, 20, 0.96));
  overflow: hidden;
}

.tm-node-toolbar {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.tm-node-toolbar.active,
.tm-node:hover .tm-node-toolbar {
  opacity: 1;
}

.tm-node-toolbar-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.88);
}

.tm-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 6px;
  color: rgba(255, 255, 255, 0.9);
}

.tm-node-title {
  font-size: 12px;
  font-weight: 600;
}

.tm-node-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.48);
}

.tm-node-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 0 8px 8px;
}

.tm-node-slot {
  min-width: 0;
}

.tm-node-slot-label {
  margin-bottom: 2px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.62);
}

.tm-node-slot-preview {
  height: 40px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
}

.tm-node-slot-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tm-node-slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.32);
}
</style>
