<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps<{
  src: string
  type: 'image' | 'video'
}>()

defineEmits(['dblclick'])

const containerRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadError = ref('')

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationFrameId: number
let videoElement: HTMLVideoElement | null = null
let texture: THREE.Texture | THREE.VideoTexture | null = null
let resizeObserver: ResizeObserver | null = null
let resizeFrameId: number | null = null

const minFov = 30
const maxFov = 120
let targetFov = 75
let isMiddleDragging = false
let middleDragStartY = 0
let middleDragStartFov = 75
const disposers: (() => void)[] = []

const updateRendererSize = () => {
  if (!containerRef.value || !camera || !renderer) return
  const width = containerRef.value.clientWidth || 1
  const height = containerRef.value.clientHeight || 1
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

const initThree = () => {
  if (!containerRef.value) return
  loading.value = true
  loadError.value = ''

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(75, containerRef.value.clientWidth / containerRef.value.clientHeight, 0.1, 1000)
  camera.position.set(0, 0, 0.1)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  containerRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableZoom = false
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.rotateSpeed = -0.5

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    targetFov += e.deltaY * 0.05
    targetFov = Math.max(minFov, Math.min(maxFov, targetFov))
  }
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
  disposers.push(() => { renderer?.domElement?.removeEventListener('wheel', onWheel) })

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isMiddleDragging = true
      middleDragStartY = e.clientY
      middleDragStartFov = targetFov
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!isMiddleDragging) return
    const dy = e.clientY - middleDragStartY
    targetFov = Math.max(minFov, Math.min(maxFov, middleDragStartFov + dy * 0.2))
  }
  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 1) isMiddleDragging = false
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  disposers.push(() => {
    renderer?.domElement?.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  })

  const geometry = new THREE.SphereGeometry(500, 60, 40)
  geometry.scale(-1, 1, 1)

  let material: THREE.MeshBasicMaterial

  if (props.type === 'image') {
    const loader = new THREE.TextureLoader()
    const textureSrc = props.src
    texture = loader.load(
      textureSrc,
      () => {
        loading.value = false
      },
      undefined,
      (error) => {
        console.warn('[PanoramaViewer] 全景图片加载失败:', error)
        loading.value = false
        loadError.value = '全景图片加载失败'
      }
    )
    texture.colorSpace = THREE.SRGBColorSpace
    material = new THREE.MeshBasicMaterial({ map: texture })
  } else {
    videoElement = document.createElement('video')
    videoElement.src = props.src
    videoElement.crossOrigin = 'anonymous'
    videoElement.loop = true
    videoElement.muted = true
    videoElement.play().catch(e => console.warn('Auto-play failed', e))

    texture = new THREE.VideoTexture(videoElement)
    texture.colorSpace = THREE.SRGBColorSpace
    material = new THREE.MeshBasicMaterial({ map: texture })
    loading.value = false
  }

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  resizeObserver = new ResizeObserver(() => {
    if (resizeFrameId !== null) cancelAnimationFrame(resizeFrameId)
    resizeFrameId = requestAnimationFrame(() => {
      resizeFrameId = null
      updateRendererSize()
    })
  })
  resizeObserver.observe(containerRef.value)

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    if (camera.fov !== targetFov) {
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * 0.1
      } else {
        camera.fov = targetFov
      }
      camera.updateProjectionMatrix()
    }
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

}

const cleanup = () => {
  disposers.forEach(fn => fn())
  disposers.length = 0
  isMiddleDragging = false

  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (resizeFrameId !== null) {
    cancelAnimationFrame(resizeFrameId)
    resizeFrameId = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (renderer && renderer.domElement && containerRef.value) {
    if (containerRef.value.contains(renderer.domElement)) {
      containerRef.value.removeChild(renderer.domElement)
    }
    renderer.dispose()
  }
  if (texture) texture.dispose()
  if (videoElement) {
    videoElement.pause()
    videoElement.removeAttribute('src')
    videoElement.load()
    videoElement = null
  }
}

onMounted(() => {
  initThree()
})

onBeforeUnmount(() => {
  cleanup()
})

watch(() => props.src, () => {
  cleanup()
  initThree()
})

const captureFrame = (): string | null => {
  if (!renderer || !scene || !camera) return null
  renderer.render(scene, camera)
  return renderer.domElement.toDataURL('image/png')
}

defineExpose({ captureFrame })
</script>

<template>
  <div class="relative w-full h-full bg-zinc-950 flex items-center justify-center nodrag nowheel" @mousedown.stop @touchstart.stop @pointerdown.stop @wheel.stop @dblclick="$emit('dblclick', $event)">
    <div ref="containerRef" class="w-full h-full cursor-grab active:cursor-grabbing"></div>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-zinc-950/50">
      <div class="w-8 h-8 border-2 border-zinc-500 border-t-white rounded-full animate-spin"></div>
    </div>
    <div v-if="loadError" class="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-sm text-zinc-300">
      {{ loadError }}
    </div>
  </div>
</template>
