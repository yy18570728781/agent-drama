<template>
  <div class="loading-wrapper" :class="{ 'fade-out': fadeOut }">
    <!-- 水晶粒子容器 -->
    <div class="crystals-container">
      <div
        v-for="i in crystalCount"
        :key="i"
        class="crystal"
        :class="crystalShapes[i - 1]"
        :style="crystalStyles[i - 1]"
      />
    </div>

    <!-- 中心信息 -->
    <div class="center-content">
      <div class="percentage-display" :style="percentageScaleStyle">{{ displayPercent }}%</div>
      <div v-if="title" class="loading-text">{{ title }}</div>
      <div class="loading-subtext" :class="{ pulsing: pulsing }">{{ subtext }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  percent?: number
  title?: string
  subtext?: string
  autoProgress?: boolean
}>(), {
  percent: 0,
  title: 'AI-Comic-Director-Canvas',
  subtext: '正在为您处理请求',
  autoProgress: false
})

const emit = defineEmits<{
  (e: 'complete'): void
}>()

// 水晶配置 - 更多水晶填满整个区域
const crystalCount = 40
const crystalShapes = [
  'diamond', 'hexagon', 'diamond-small', 'shard', 'diamond',
  'hexagon', 'shard', 'diamond-small', 'diamond', 'shard',
  'diamond', 'hexagon', 'shard', 'diamond-small', 'hexagon'
]

// 水晶色系 - 冰蓝、白色、淡紫
const crystalColors = [
  { main: 'rgba(147, 197, 253, 0.95)', glow: 'rgba(147, 197, 253, 0.6)', spark: '#e0f2fe' }, // 冰蓝
  { main: 'rgba(226, 232, 240, 0.95)', glow: 'rgba(226, 232, 240, 0.5)', spark: '#f8fafc' }, // 银白
  { main: 'rgba(196, 181, 253, 0.9)', glow: 'rgba(196, 181, 253, 0.5)', spark: '#ede9fe' }, // 淡紫
  { main: 'rgba(125, 211, 252, 0.95)', glow: 'rgba(125, 211, 252, 0.6)', spark: '#e0f2fe' }, // 天蓝
  { main: 'rgba(255, 255, 255, 0.95)', glow: 'rgba(255, 255, 255, 0.5)', spark: '#ffffff' }, // 纯白
  { main: 'rgba(167, 243, 208, 0.9)', glow: 'rgba(167, 243, 208, 0.5)', spark: '#d1fae5' }, // 薄荷绿
]

// 生成水晶样式 - 充满整个区域
const crystalStyles = Array.from({ length: crystalCount }, () => {
  const size = Math.random() * 16 + 8 // 8-24px
  const left = Math.random() * 92 + 4 // 4-96%
  const delay = Math.random() * 6
  const duration = Math.random() * 8 + 6 // 6-14秒
  const colorScheme = crystalColors[Math.floor(Math.random() * crystalColors.length)]
  const sparkleDuration = Math.random() * 2 + 1
  const sparkleDelay = Math.random() * 3
  const swayAmount = Math.random() * 30 - 15 // 左右摆动
  const startDelay = Math.random() * 100 // 底部起始位置随机

  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    bottom: `-${20 + startDelay}px`,
    '--crystal-main': colorScheme.main,
    '--crystal-glow': colorScheme.glow,
    '--crystal-spark': colorScheme.spark,
    '--sway': `${swayAmount}px`,
    '--rise-height': `${300 + Math.random() * 200}px`,
    background: `linear-gradient(135deg, ${colorScheme.spark}, ${colorScheme.main}, ${colorScheme.glow})`,
    boxShadow: `0 0 ${size * 0.8}px ${colorScheme.glow}, inset 0 0 ${size * 0.3}px rgba(255,255,255,0.5)`,
    animation: `crystal-rise ${duration}s ease-out ${delay}s infinite, sparkle ${sparkleDuration}s ease-in-out ${sparkleDelay}s infinite`
  }
})

const fadeOut = ref(false)
const pulsing = ref(true)
const percentageScale = ref(1)
let scaleTimeout: number | null = null
let autoProgressRaf: number | null = null

// 自动进度模式
const internalPercent = ref(0)

const displayPercent = computed(() => {
  const p = props.autoProgress ? internalPercent.value : props.percent
  return Math.floor(Math.min(100, Math.max(0, p)))
})

// 百分比缩放样式
const percentageScaleStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${percentageScale.value})`
}))

// 监听百分比变化，触发缩放动画
watch(displayPercent, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    percentageScale.value = 1.1
    if (scaleTimeout) clearTimeout(scaleTimeout)
    scaleTimeout = window.setTimeout(() => {
      percentageScale.value = 1
    }, 150)
  }
})

// 自动进度模式
onMounted(() => {
  if (props.autoProgress) {
    let startTime: number | null = null
    const duration = 10000 // 10秒一个周期

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = (elapsed % duration) / duration
      internalPercent.value = progress * 100

      autoProgressRaf = requestAnimationFrame(animate)
    }

    autoProgressRaf = requestAnimationFrame(animate)
  }
})

onUnmounted(() => {
  if (scaleTimeout) clearTimeout(scaleTimeout)
  if (autoProgressRaf) cancelAnimationFrame(autoProgressRaf)
})

// 完成加载动画
function complete() {
  fadeOut.value = true
  setTimeout(() => {
    emit('complete')
  }, 800)
}

defineExpose({ complete })
</script>

<style scoped>
.loading-wrapper {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  /* 冰蓝水晶氛围光 */
  box-shadow:
    inset 0 0 60px rgba(147, 197, 253, 0.06),
    inset 0 0 120px rgba(196, 181, 253, 0.03);
}

.loading-wrapper.fade-out {
  opacity: 0;
  transform: scale(0.95);
}

/* 水晶容器 - 充满整个区域 */
.crystals-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

/* 基础水晶样式 */
.crystal {
  position: absolute;
  opacity: 0;
  backdrop-filter: blur(1px);
}

/* 钻石形状 */
.crystal.diamond {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

/* 小钻石 */
.crystal.diamond-small {
  clip-path: polygon(50% 0%, 100% 35%, 50% 100%, 0% 35%);
}

/* 六边形 */
.crystal.hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* 碎片形状 */
.crystal.shard {
  clip-path: polygon(20% 0%, 80% 15%, 100% 70%, 60% 100%, 0% 80%);
}

/* 中心内容 */
.center-content {
  position: relative;
  z-index: 10;
  text-align: center;
}

.percentage-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin-top: -40px;
  /* 冰蓝渐变文字 */
  background: linear-gradient(135deg, #e0f2fe, #93c5fd, #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
  font-size: 48px;
  font-weight: 700;
  text-shadow:
    0 0 4px rgba(147, 197, 253, 0.8),
    0 0 30px rgba(147, 197, 253, 0.4),
    0 0 60px rgba(147, 197, 253, 0.2);
  transition: transform 0.15s ease-out;
  /* 文字发光效果 */
  filter: drop-shadow(0 0 20px rgba(147, 197, 253, 0.5));
}

.loading-text {
  /* 冰蓝到白色渐变 */
  background: linear-gradient(180deg, #f0f9ff, #bfdbfe);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 22px;
  font-weight: 600;
  margin-top: 60px;
  margin-bottom: 12px;
  font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
  letter-spacing: 2px;
  text-shadow:
    0 0 20px rgba(147, 197, 253, 0.3),
    0 0 40px rgba(147, 197, 253, 0.15);
  position: relative;
  display: inline-block;
}

/* 没有 title 时，subtext 的间距 */
.center-content:not(:has(.loading-text)) .loading-subtext {
  margin-top: 60px;
}

.loading-text::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 10%;
  width: 80%;
  height: 1px;
  /* 冰蓝色下划线 */
  background: linear-gradient(90deg, transparent, rgba(147, 197, 253, 0.8), rgba(196, 181, 253, 0.5), transparent);
}

.loading-subtext {
  color: #94a3b8;
  font-size: 14px;
  font-family: 'Noto Sans SC', sans-serif;
  letter-spacing: 0.5px;
}

.loading-subtext.pulsing {
  animation: pulse 2.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    color: #94a3b8;
  }
  50% {
    opacity: 1;
    color: #93c5fd;
    text-shadow: 0 0 12px rgba(147, 197, 253, 0.5);
  }
}

/* 水晶上升动画 - 从底部升起充满整个区域 */
@keyframes crystal-rise {
  0% {
    transform: translateY(0) translateX(0) rotate(0deg) scale(0.8);
    opacity: 0;
  }
  8% {
    opacity: 0.9;
    transform: translateY(10%) translateX(0) rotate(30deg) scale(1);
  }
  30% {
    opacity: 0.85;
  }
  60% {
    opacity: 0.7;
    transform: translateY(60%) translateX(var(--sway, 0px)) rotate(200deg) scale(0.95);
  }
  85% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(calc(-100% - var(--rise-height, 300px))) translateX(calc(var(--sway, 0px) * -1)) rotate(360deg) scale(0.6);
    opacity: 0;
  }
}

/* 水晶闪烁动画 */
@keyframes sparkle {
  0%, 100% {
    filter: brightness(1) saturate(1);
  }
  50% {
    filter: brightness(1.5) saturate(1.3);
  }
}
</style>
