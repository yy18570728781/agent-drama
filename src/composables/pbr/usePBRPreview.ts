import { onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { usePBRStore } from '@/stores/pbr.store'
import type { GeometryType, PBRChannel, LightingPreset } from '@/types/pbr.types'
import { usePBRMiddlePan } from './usePBRMiddlePan'

const PBR_DEBUG = false
function pbrLog(...args: unknown[]): void {
  if (PBR_DEBUG) console.warn('[PBR]', ...args)
}

interface PresetConfig {
  ambient: { color: number; intensity: number }
  main: { color: number; intensity: number }
  fill: { color: number; intensity: number }
}

const LIGHTING_PRESETS: Record<LightingPreset, PresetConfig> = {
  studio: {
    ambient: { color: 0xffffff, intensity: 0.3 },
    main: { color: 0xffffff, intensity: 1.2 },
    fill: { color: 0xb0c4de, intensity: 0.4 },
  },
  daylight: {
    ambient: { color: 0x87ceeb, intensity: 0.5 },
    main: { color: 0xfff5e6, intensity: 1.5 },
    fill: { color: 0x87ceeb, intensity: 0.3 },
  },
  warm: {
    ambient: { color: 0xffd699, intensity: 0.4 },
    main: { color: 0xffaa44, intensity: 1.3 },
    fill: { color: 0xff8866, intensity: 0.5 },
  },
  cyberpunk: {
    ambient: { color: 0x220044, intensity: 0.4 },
    main: { color: 0xff0066, intensity: 1.4 },
    fill: { color: 0x00ccff, intensity: 0.6 },
  },
  custom: {
    ambient: { color: 0x808080, intensity: 0.5 },
    main: { color: 0xffffff, intensity: 0.8 },
    fill: { color: 0x808080, intensity: 0.2 },
  },
}

export function usePBRPreview(containerRef: Ref<HTMLElement | null>, externalRenderer?: THREE.WebGLRenderer) {
  const store = usePBRStore()

  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let controls: OrbitControls | null = null
  let mesh: THREE.Mesh | null = null
  let wireframeMesh: THREE.Mesh | null = null
  let importedGroup: THREE.Group | null = null
  let glbWireframeGroup: THREE.Group | null = null
  let material: THREE.MeshPhysicalMaterial | null = null
  let pmremGenerator: THREE.PMREMGenerator | null = null
  let customEnvTexture: THREE.Texture | null = null
  let animFrameId = 0
  let viewOffX = 0
  let viewOffY = 0
  let isExternalRenderer = !!externalRenderer
  let envRenderTarget: THREE.WebGLRenderTarget | null = null
  let rawEnvTexture: THREE.Texture | null = null
  let ambientLight: THREE.AmbientLight | null = null
  let mainLight: THREE.DirectionalLight | null = null
  let fillLight: THREE.DirectionalLight | null = null
  const middlePan = usePBRMiddlePan({
    readOffset: () => ({ x: viewOffX, y: viewOffY }),
    updateOffset: ({ x, y }) => {
      viewOffX = x
      viewOffY = y
      applyViewOffset()
    },
  })

  const textures: Record<string, THREE.Texture | null> = {
    map: null,
    displacementMap: null,
    normalMap: null,
    roughnessMap: null,
    metalnessMap: null,
    aoMap: null,
  }

  const lastCanvases: Record<string, HTMLCanvasElement | null> = {
    map: null,
    displacementMap: null,
    normalMap: null,
    roughnessMap: null,
    metalnessMap: null,
    aoMap: null,
  }

  const lastRTs: Record<string, THREE.WebGLRenderTarget | null> = {
    map: null,
    displacementMap: null,
    normalMap: null,
    roughnessMap: null,
    metalnessMap: null,
    aoMap: null,
  }

  const isRTTexture: Record<string, boolean> = {
    map: false,
    displacementMap: false,
    normalMap: false,
    roughnessMap: false,
    metalnessMap: false,
    aoMap: false,
  }

  let prevMapActive: Record<string, boolean> = {
    map: false,
    displacementMap: false,
    normalMap: false,
    roughnessMap: false,
    metalnessMap: false,
    aoMap: false,
  }

  const CHANNEL_TO_MAP: Record<string, string> = {
    albedo: 'map',
    displacement: 'displacementMap',
    normal: 'normalMap',
    roughness: 'roughnessMap',
    metallic: 'metalnessMap',
    ao: 'aoMap',
  }

  function init() {
    if (!containerRef.value) return

    const container = containerRef.value
    const w = container.clientWidth || 600
    const h = container.clientHeight || 400

    renderer = externalRenderer || new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = store.lightIntensity
    container.appendChild(renderer.domElement)

    pmremGenerator = new THREE.PMREMGenerator(renderer)
    pmremGenerator.compileEquirectangularShader()

    scene = new THREE.Scene()
    const roomEnv = new RoomEnvironment()
    envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04)
    scene.environment = envRenderTarget.texture
    scene.background = new THREE.Color(0x111111)
      scene.environmentIntensity = store.hdrIntensity
    scene.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(store.hdrRotation), 0)
    roomEnv.dispose()

    ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)
    mainLight = new THREE.DirectionalLight(0xffffff, 1.2)
    mainLight.position.set(2, 3, 2)
    scene.add(mainLight)
    fillLight = new THREE.DirectionalLight(0xb0c4de, 0.4)
    fillLight.position.set(-2, 1, -1)
    scene.add(fillLight)
    applyLightingPreset(store.lightingPreset)
    updateLightAngle(store.lightAngle)

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 0, 3)
    camera.clearViewOffset()
    viewOffX = 0
    viewOffY = 0

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 0, 0)
    controls.enablePan = false
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: -1 as any,
      RIGHT: null as any,
    }

    middlePan.bind(renderer.domElement)

    material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.0,
      envMapIntensity: 1.0,
      side: THREE.FrontSide,
    })

    mesh = new THREE.Mesh(createGeometry(store.activeGeometry), material)
    scene.add(mesh)

    const wfMat = new THREE.MeshPhysicalMaterial({
      color: 0x00ff66,
      wireframe: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    wireframeMesh = new THREE.Mesh(mesh.geometry, wfMat)
    wireframeMesh.visible = store.wireframe
    scene.add(wireframeMesh)

    updateMaterialSide()
    animate()
  }


  function smoothNormalsForDisplacement(geo: THREE.BufferGeometry): void {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute
    const factor = 10000
    const groups = new Map<number, number[]>()
    for (let i = 0; i < pos.count; i++) {
      const key = Math.round(pos.getX(i) * factor) * 1000000000000
        + Math.round(pos.getY(i) * factor) * 1000000
        + Math.round(pos.getZ(i) * factor)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(i)
    }
    for (const [, indices] of groups) {
      if (indices.length < 2) continue
      let nx = 0, ny = 0, nz = 0
      for (const idx of indices) {
        nx += norm.getX(idx)
        ny += norm.getY(idx)
        nz += norm.getZ(idx)
      }
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) { nx /= len; ny /= len; nz /= len }
      for (const idx of indices) {
        norm.setXYZ(idx, nx, ny, nz)
      }
    }
    norm.needsUpdate = true
  }

  function createRoundedBox(w: number, h: number, d: number, seg: number, r: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const sx = w / 2, sy = h / 2, sz = d / 2
    const cx = sx - r, cy = sy - r, cz = sz - r
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
      const qx = Math.max(-cx, Math.min(cx, px))
      const qy = Math.max(-cy, Math.min(cy, py))
      const qz = Math.max(-cz, Math.min(cz, pz))
      const dx = px - qx, dy = py - qy, dz = pz - qz
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist > 1e-6) {
        const scale = r / dist
        pos.setXYZ(i, qx + dx * scale, qy + dy * scale, qz + dz * scale)
      }
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }

  function createRoundedCylinder(radius: number, height: number, radialSegments: number): THREE.BufferGeometry {
    const filletRadius = radius * 0.08
    const profileRes = Math.max(20, Math.floor(radialSegments * 0.5))
    const halfH = height / 2
    const r = filletRadius
    const R = radius
    const diskLen = R - r
    const filletLen = Math.PI * r / 2
    const wallLen = height - 2 * r
    const totalLen = 2 * diskLen + 2 * filletLen + wallLen
    const diskSeg = Math.max(2, Math.floor(profileRes * diskLen / totalLen))
    const filletSeg = Math.max(3, Math.floor(profileRes * filletLen / totalLen))
    const wallSeg = Math.max(2, Math.floor(profileRes * wallLen / totalLen))
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= diskSeg; i++) {
      pts.push(new THREE.Vector2((i / diskSeg) * (R - r), -halfH))
    }
    for (let i = 1; i <= filletSeg; i++) {
      const t = i / filletSeg
      const a = -Math.PI / 2 + t * Math.PI / 2
      pts.push(new THREE.Vector2((R - r) + r * Math.cos(a), (-halfH + r) + r * Math.sin(a)))
    }
    for (let i = 1; i <= wallSeg; i++) {
      const t = i / wallSeg
      pts.push(new THREE.Vector2(R, -halfH + r + t * wallLen))
    }
    for (let i = 1; i <= filletSeg; i++) {
      const t = i / filletSeg
      const a = t * Math.PI / 2
      pts.push(new THREE.Vector2((R - r) + r * Math.cos(a), (halfH - r) + r * Math.sin(a)))
    }
    for (let i = 1; i <= diskSeg; i++) {
      pts.push(new THREE.Vector2((1 - i / diskSeg) * (R - r), halfH))
    }
    return new THREE.LatheGeometry(pts, radialSegments)
  }

  function createSpherizedCubeGeometry(radius: number, subdivs: number): THREE.BufferGeometry {
    const geom = new THREE.BoxGeometry(radius * 1.8, radius * 1.8, radius * 1.8, subdivs, subdivs, subdivs)
    const pos = geom.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize().multiplyScalar(radius)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    geom.computeVertexNormals()
    return geom
  }

  function createGeometry(type: GeometryType): THREE.BufferGeometry {
    const detail = Math.max(64, store.subdivisionsDetail)
    let geo: THREE.BufferGeometry
    switch (type) {
      case 'sphere':
        geo = createSpherizedCubeGeometry(1, detail)
        break
      case 'cube':
        geo = createRoundedBox(1.5, 1.5, 1.5, detail, 1.5 * 0.05)
        break
      case 'cylinder':
        geo = createRoundedCylinder(0.8, 1.8, detail)
        break
      case 'plane':
      default:
        geo = new THREE.PlaneGeometry(2, 2, detail, detail)
        break
    }
    smoothNormalsForDisplacement(geo)
    return geo
  }

  function updateMaterialSide() {
    if (!material) return
    material.side = store.activeGeometry === 'plane' ? THREE.DoubleSide : THREE.FrontSide
    material.needsUpdate = true
  }

  function applyViewOffset() {
    if (!camera || !renderer) return
    if (viewOffX === 0 && viewOffY === 0) {
      camera.clearViewOffset()
      return
    }
    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight
    const fw = w + Math.abs(viewOffX)
    const fh = h + Math.abs(viewOffY)
    const ox = Math.max(0, viewOffX)
    const oy = Math.max(0, viewOffY)
    camera.setViewOffset(fw, fh, ox, oy, w, h)
    camera.updateProjectionMatrix()
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate)
    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  function updateTextureForChannel(channel: PBRChannel, mapKey: string, srgb: boolean) {
    const rt = store.renderTargets[channel]

    if (rt) {
      rt.texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
      const canvas = store.channels[channel]?.canvas
      if (canvas) {
        const tex = new THREE.CanvasTexture(canvas)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(store.uvTiling, store.uvTiling)
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
        tex.needsUpdate = true
        if (textures[mapKey] && !isRTTexture[mapKey]) {
          textures[mapKey]!.dispose()
        }
        textures[mapKey] = tex
        isRTTexture[mapKey] = false
      } else {
        if (textures[mapKey] && !isRTTexture[mapKey]) {
          textures[mapKey]!.dispose()
        }
        textures[mapKey] = rt.texture
        isRTTexture[mapKey] = true
        pbrLog('updateTexture() RT fallback:', channel, '→', mapKey, 'using rt.texture directly')
      }
      lastRTs[mapKey] = rt
      lastCanvases[mapKey] = canvas ?? null
      return
    }

    if (isRTTexture[mapKey]) {
      textures[mapKey] = null
    }
    lastRTs[mapKey] = null
    isRTTexture[mapKey] = false

    const canvas: HTMLCanvasElement | null = (store.channels as any)[channel]?.canvas ?? null
    const prev = lastCanvases[mapKey]
    if (canvas === prev) return

    if (textures[mapKey]) {
      textures[mapKey]!.dispose()
      textures[mapKey] = null
    }

    if (canvas) {
      const tex = new THREE.CanvasTexture(canvas)
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(store.uvTiling, store.uvTiling)
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
      tex.needsUpdate = true
      textures[mapKey] = tex
      pbrLog('updateTexture() canvas:', channel, '→', mapKey, `${canvas.width}x${canvas.height}`, 'srgb:', srgb)
    } else {
      pbrLog('updateTexture() no data:', channel, '→', mapKey, '(both RT and canvas null)')
    }
    lastCanvases[mapKey] = canvas
  }

  function updateTextures() {
    if (!material) return
    const m = material

    updateTextureForChannel('albedo', 'map', true)
    updateTextureForChannel('displacement', 'displacementMap', false)
    updateTextureForChannel('normal', 'normalMap', false)
    updateTextureForChannel('roughness', 'roughnessMap', false)
    updateTextureForChannel('metallic', 'metalnessMap', false)
    updateTextureForChannel('ao', 'aoMap', false)

    material.map = textures.map
    material.displacementMap = store.displacementEnabled ? textures.displacementMap : null
    material.displacementScale = store.displacementScale
    material.normalMap = textures.normalMap
    material.normalScale = new THREE.Vector2(1, 1)
    material.roughnessMap = textures.roughnessMap
    material.roughness = textures.roughnessMap ? 1.0 : 0.5
    material.metalnessMap = textures.metalnessMap
    material.metalness = textures.metalnessMap ? 1.0 : 0.0
    material.aoMap = textures.aoMap
    material.aoMapIntensity = 1.0

    if (wireframeMesh && wireframeMesh.material instanceof THREE.MeshPhysicalMaterial) {
      wireframeMesh.material.displacementMap = material.displacementMap
      wireframeMesh.material.displacementScale = material.displacementScale
    }

    if (importedGroup) {
      importedGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshPhysicalMaterial
          mat.map = m.map
          mat.displacementMap = m.displacementMap
          mat.displacementScale = m.displacementScale
          mat.normalMap = m.normalMap
          mat.normalScale = m.normalScale
          mat.roughnessMap = m.roughnessMap
          mat.roughness = m.roughnessMap ? 1.0 : 0.5
          mat.metalnessMap = m.metalnessMap
          mat.metalness = m.metalnessMap ? 1.0 : 0.0
          mat.aoMap = m.aoMap
          mat.aoMapIntensity = 1.0
          mat.needsUpdate = true
        }
      })
    }

    if (glbWireframeGroup) {
      glbWireframeGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.displacementMap = m.displacementMap
          child.material.displacementScale = m.displacementScale
        }
      })
    }

    const currentActive = {
      map: !!textures.map,
      displacementMap: !!textures.displacementMap,
      normalMap: !!textures.normalMap,
      roughnessMap: !!textures.roughnessMap,
      metalnessMap: !!textures.metalnessMap,
      aoMap: !!textures.aoMap,
    }
    const needsRecompile =
      currentActive.map !== prevMapActive.map ||
      currentActive.displacementMap !== prevMapActive.displacementMap ||
      currentActive.normalMap !== prevMapActive.normalMap ||
      currentActive.roughnessMap !== prevMapActive.roughnessMap ||
      currentActive.metalnessMap !== prevMapActive.metalnessMap ||
      currentActive.aoMap !== prevMapActive.aoMap
    if (needsRecompile) {
      material.needsUpdate = true
    }
    prevMapActive = currentActive

    // Force re-evaluate RT textures whose object identity may be unchanged (pool-reused RTs)
    material.needsUpdate = true
  }

  function loadImportedModel(url: string) {
    const loader = new GLTFLoader()
    loader.load(url, (gltf) => {
      if (importedGroup) {
        scene?.remove(importedGroup)
        importedGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose()
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
            else child.material.dispose()
          }
        })
      }
      importedGroup = gltf.scene
      const box = new THREE.Box3().setFromObject(importedGroup)
      const size = box.getSize(new THREE.Vector3()).length()
      const scale = 2 / size
      importedGroup.scale.setScalar(scale)
      const center = box.getCenter(new THREE.Vector3())
      importedGroup.position.sub(center.multiplyScalar(scale))
      importedGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = new THREE.MeshPhysicalMaterial({
            roughness: 0.5,
            metalness: 0.0,
            envMapIntensity: 1.0,
            side: THREE.DoubleSide,
          })
          child.material = mat
        }
      })
      scene?.add(importedGroup)

      importedGroup.updateMatrixWorld(true)
      const wfGroup = new THREE.Group()
      const worldPos = new THREE.Vector3()
      const worldQuat = new THREE.Quaternion()
      const worldScale = new THREE.Vector3()
      importedGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const wfMat = new THREE.MeshStandardMaterial({
            wireframe: true,
            emissive: 0x6366f1,
            opacity: 0.7,
            transparent: true,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          })
          const wfMesh = new THREE.Mesh(child.geometry, wfMat)
          child.matrixWorld.decompose(worldPos, worldQuat, worldScale)
          wfMesh.position.copy(worldPos)
          wfMesh.quaternion.copy(worldQuat)
          wfMesh.scale.copy(worldScale)
          wfGroup.add(wfMesh)
        }
      })
      if (glbWireframeGroup) {
        scene?.remove(glbWireframeGroup)
      }
      glbWireframeGroup = wfGroup
      glbWireframeGroup.visible = store.wireframe
      scene?.add(glbWireframeGroup)

      updateTextures()
      store.activeGeometry = 'imported'
    }, undefined, (err) => {
      console.warn('[PBR] loadImportedModel error:', err)
    })
  }

  function updateGeometry() {
    if (!mesh || !material) return
    const m = material

    if (store.activeGeometry === 'imported') {
      if (importedGroup) {
        importedGroup.visible = true
        importedGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshPhysicalMaterial
            mat.map = m.map
            mat.displacementMap = m.displacementMap
            mat.displacementScale = m.displacementScale
            mat.normalMap = m.normalMap
            mat.normalScale = m.normalScale
            mat.roughnessMap = m.roughnessMap
            mat.roughness = m.roughnessMap ? 1.0 : 0.5
            mat.metalnessMap = m.metalnessMap
            mat.metalness = m.metalnessMap ? 1.0 : 0.0
            mat.aoMap = m.aoMap
            mat.aoMapIntensity = 1.0
            mat.needsUpdate = true
          }
        })
      }
      if (glbWireframeGroup) {
        glbWireframeGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.displacementMap = m.displacementMap
            child.material.displacementScale = m.displacementScale
          }
        })
      }
      if (mesh) mesh.visible = false
      if (wireframeMesh) wireframeMesh.visible = false
      return
    }

    if (glbWireframeGroup) glbWireframeGroup.visible = false
    if (importedGroup) importedGroup.visible = false
    if (mesh) mesh.visible = true
    mesh.geometry.dispose()
    mesh.geometry = createGeometry(store.activeGeometry)
    wireframeMesh!.geometry = mesh.geometry
    updateMaterialSide()
  }

  function updateLighting() {
    if (scene) {
    scene.environmentIntensity = store.hdrIntensity
      const rotY = THREE.MathUtils.degToRad(store.hdrRotation)
      scene.environmentRotation.set(0, rotY, 0)
      scene.backgroundRotation.set(0, rotY, 0)
      updateBackground()
    }
    if (renderer) {
    renderer.toneMappingExposure = store.lightIntensity
    }
  }

  function applyLightingPreset(preset: LightingPreset) {
    const cfg = LIGHTING_PRESETS[preset]
    if (ambientLight) {
      ambientLight.color.setHex(cfg.ambient.color)
      ambientLight.intensity = cfg.ambient.intensity
    }
    if (mainLight) {
      mainLight.color.setHex(cfg.main.color)
      mainLight.intensity = cfg.main.intensity
    }
    if (fillLight) {
      fillLight.color.setHex(cfg.fill.color)
      fillLight.intensity = cfg.fill.intensity
    }
  }

  function updateLightAngle(angleDeg: number) {
    if (!mainLight || !fillLight) return
    const rad = THREE.MathUtils.degToRad(angleDeg)
    mainLight.position.set(Math.cos(rad) * 3, 2, Math.sin(rad) * 3)
    fillLight.position.set(-Math.cos(rad) * 2, 1, -Math.sin(rad) * 2)
  }

  function updateBackground() {
    if (!scene) return
    if (store.showHdriBackground && scene.environment) {
      scene.background = scene.environment
      scene.backgroundBlurriness = store.hdriBlur
    } else {
      scene.background = new THREE.Color(0x111111)
      scene.backgroundBlurriness = 0
    }
  }

  function loadHdrFromUrl(url: string, fileName: string) {
    if (!pmremGenerator || !scene) return

    const ext = fileName.toLowerCase().split('.').pop()
    let loader: { load: (url: string, onLoad: (tex: THREE.Texture) => void, onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void) => unknown }

    if (ext === 'hdr') {
      const hdrLoader = new HDRLoader()
      hdrLoader.setDataType(THREE.FloatType)
      loader = hdrLoader
    } else if (ext === 'exr') {
      const exrLoader = new EXRLoader()
      exrLoader.setDataType(THREE.HalfFloatType)
      loader = exrLoader
    } else {
      const texLoader = new THREE.TextureLoader()
      loader = texLoader
    }

    loader.load(
      url,
      (texture: THREE.Texture) => {
        if (ext !== 'hdr' && ext !== 'exr') {
          texture.colorSpace = THREE.NoColorSpace
        }
        texture.needsUpdate = true

    if (customEnvTexture) {
      customEnvTexture.dispose()
      customEnvTexture = null
    }
    if (envRenderTarget) {
      envRenderTarget.dispose()
      envRenderTarget = null
    }

        envRenderTarget = pmremGenerator!.fromEquirectangular(texture)
        scene!.environment = envRenderTarget.texture
        customEnvTexture = envRenderTarget.texture

        texture.dispose()
        updateLighting()
      },
      undefined,
      (err: unknown) => {
        console.error('Failed to load HDR:', err)
      },
    )
  }

  function resetToDefaultEnv() {
    if (!pmremGenerator || !scene) return
    if (customEnvTexture) {
      customEnvTexture.dispose()
      customEnvTexture = null
    }
    if (envRenderTarget) {
      envRenderTarget.dispose()
      envRenderTarget = null
    }
    const roomEnv = new RoomEnvironment()
    envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04)
    scene.environment = envRenderTarget.texture
    roomEnv.dispose()
    updateLighting()
  }

  function disposeTextures() {
    for (const key of Object.keys(textures)) {
      const tex = textures[key]
      if (tex && !isRTTexture[key]) {
        tex.dispose()
      }
      textures[key] = null
    }
    for (const key of Object.keys(lastCanvases)) {
      lastCanvases[key] = null
    }
    for (const key of Object.keys(lastRTs)) {
      lastRTs[key] = null
    }
    for (const key of Object.keys(isRTTexture)) {
      isRTTexture[key] = false
    }
  }

  function handleResize() {
    if (!containerRef.value || !renderer || !camera) return
    const w = containerRef.value.clientWidth
    const h = containerRef.value.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    applyViewOffset()
  }

  function dispose() {
    cancelAnimationFrame(animFrameId)
    middlePan.dispose()
    disposeTextures()
    if (customEnvTexture) {
      customEnvTexture.dispose()
      customEnvTexture = null
    }
    if (mesh) {
      mesh.geometry.dispose()
    }
    if (wireframeMesh) {
      if (Array.isArray(wireframeMesh.material)) {
        wireframeMesh.material.forEach(m => m.dispose())
      } else {
        wireframeMesh.material.dispose()
      }
    }
    if (material) {
      material.dispose()
    }
    if (importedGroup) {
      importedGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
          else child.material.dispose()
        }
      })
      scene?.remove(importedGroup)
      importedGroup = null
    }
    if (glbWireframeGroup) {
      glbWireframeGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
          else child.material.dispose()
        }
      })
      scene?.remove(glbWireframeGroup)
      glbWireframeGroup = null
    }
    if (controls) {
      controls.dispose()
    }
    if (ambientLight) {
      ambientLight.dispose()
    }
    if (mainLight) {
      mainLight.dispose()
    }
    if (fillLight) {
      fillLight.dispose()
    }
    if (pmremGenerator) {
      pmremGenerator.dispose()
      pmremGenerator = null
    }
    if (!isExternalRenderer && renderer) {
      if (containerRef.value && renderer.domElement.parentNode === containerRef.value) {
        containerRef.value.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
    renderer = null
    scene = null
    camera = null
    controls = null
    mesh = null
    wireframeMesh = null
    importedGroup = null
    glbWireframeGroup = null
    material = null
    ambientLight = null
    mainLight = null
    fillLight = null
    rawEnvTexture = null
  }

  onMounted(() => {
    init()
    updateTextures()
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    dispose()
  })

  watch(() => store.activeGeometry, updateGeometry)
  watch(() => store.subdivisionsDetail, updateGeometry)
  watch(() => store.wireframe, (val) => {
    if (store.activeGeometry === 'imported') {
      if (glbWireframeGroup) glbWireframeGroup.visible = val
    } else {
      if (wireframeMesh) wireframeMesh.visible = val
    }
  })
  watch(() => store.displacementEnabled, updateTextures)
  watch(() => store.displacementScale, () => {
    if (material) material.displacementScale = store.displacementScale
  })
  watch(() => store.uvTiling, () => {
    for (const key of Object.keys(textures)) {
      const tex = textures[key]
      if (tex) {
        tex.repeat.set(store.uvTiling, store.uvTiling)
      }
    }
  })
  watch(() => store.hdrIntensity, updateLighting)
  watch(() => store.hdrRotation, updateLighting)
  watch(() => store.lightIntensity, updateLighting)
  watch(() => store.lightingPreset, (preset) => {
    applyLightingPreset(preset)
  })
  watch(() => store.lightAngle, (angle) => {
    updateLightAngle(angle)
  })
  watch(() => store.showHdriBackground, () => {
    updateBackground()
  })
  watch(() => store.hdriBlur, () => {
    if (scene && store.showHdriBackground) {
      scene.backgroundBlurriness = store.hdriBlur
    }
  })
  watch(() => store.customHdrUrl, (url) => {
    if (url) {
      loadHdrFromUrl(url, store.customHdrFileName)
    } else {
      resetToDefaultEnv()
    }
  })

  return {
    updateTextures,
    handleResize,
    loadImportedModel,
  }
}
