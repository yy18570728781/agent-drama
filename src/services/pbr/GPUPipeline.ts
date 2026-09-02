import * as THREE from 'three'
import { TexturePool } from './TexturePool'
import type { PBRChannel } from '@/types/pbr.types'
import { TOPOLOGICAL_ORDER } from '@/types/pbr.types'

import fullscreenVert from './shaders/fullscreen.vert.glsl?raw'
import gaussianBlurFrag from './shaders/gaussianBlur.frag.glsl?raw'
import luminanceFrag from './shaders/luminance.frag.glsl?raw'
import heightCombineFrag from './shaders/heightCombine.frag.glsl?raw'
import normalBaseFrag from './shaders/normalBase.frag.glsl?raw'
import normalCombineFrag from './shaders/normalCombine.frag.glsl?raw'
import roughnessCombineFrag from './shaders/roughnessCombine.frag.glsl?raw'
import metallicMatchFrag from './shaders/metallicMatch.frag.glsl?raw'
import aoIterateFrag from './shaders/aoIterate.frag.glsl?raw'
import aoCombineFrag from './shaders/aoCombine.frag.glsl?raw'
import edgeBaseFrag from './shaders/edgeBase.frag.glsl?raw'
import edgeCombineFrag from './shaders/edgeCombine.frag.glsl?raw'
import sampleMatchFrag from './shaders/sampleMatch.frag.glsl?raw'
import editDiffuseFrag from './shaders/editDiffuse.frag.glsl?raw'
import hfnIterateFrag from './shaders/heightFromNormalIterate.frag.glsl?raw'
import seamlessOverlapFrag from './shaders/seamlessOverlap.frag.glsl?raw'
import seamlessSplatFrag from './shaders/seamlessSplat.frag.glsl?raw'
import seamlessClearFrag from './shaders/seamlessClear.frag.glsl?raw'
import seamlessTransferFrag from './shaders/seamlessTransfer.frag.glsl?raw'
import albedoAdjustFrag from './shaders/albedoAdjust.frag.glsl?raw'

function M(frag: string, uniforms: Record<string, any>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: fullscreenVert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
}

export class GPUPipeline {
  private static readonly DEBUG = false
  private pbrLog(...args: unknown[]): void {
    if (GPUPipeline.DEBUG) console.warn('[PBR]', ...args)
  }

  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private quad: THREE.Mesh
  private pool: TexturePool

  private blurMat: THREE.ShaderMaterial
  private lumaMat: THREE.ShaderMaterial
  private heightMat: THREE.ShaderMaterial
  private normalBaseMat: THREE.ShaderMaterial
  private normalCombineMat: THREE.ShaderMaterial
  private roughnessMat: THREE.ShaderMaterial
  private metallicMat: THREE.ShaderMaterial
  private aoIterMat: THREE.ShaderMaterial
  private aoCombineMat: THREE.ShaderMaterial
  private edgeBaseMat: THREE.ShaderMaterial
  private edgeCombineMat: THREE.ShaderMaterial
  private sampleMatchMat: THREE.ShaderMaterial
  private editDiffuseMat: THREE.ShaderMaterial
  private hfnIterMat: THREE.ShaderMaterial
  private seamlessOverlapMat: THREE.ShaderMaterial
  private seamlessSplatMat: THREE.ShaderMaterial
  private seamlessClearMat: THREE.ShaderMaterial
  private seamlessTransferMat: THREE.ShaderMaterial
  private albedoAdjustMat: THREE.ShaderMaterial

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null as any)
    this.scene.add(this.quad)
    this.pool = new TexturePool()

    this.blurMat = M(gaussianBlurFrag, {
      _MainTex: { value: null }, _BlurDirection: { value: new THREE.Vector2(1, 0) },
      _BlurSpread: { value: 1.0 }, _BlurSamples: { value: 4 },
      _TexelSize: { value: new THREE.Vector2() }, _BlurContrast: { value: 1.0 }, _Desaturate: { value: 0 },
    })
    this.lumaMat = M(luminanceFrag, { _MainTex: { value: null } })
    this.heightMat = M(heightCombineFrag, this.make7BandUniforms(
      ['_AvgTex'], ['_FinalContrast', '_FinalBias', '_FinalGain', '_Invert'],
    ))
    this.normalBaseMat = M(normalBaseFrag, {
      _MainTex: { value: null }, _BlurContrast: { value: 20.0 }, _TexelSize: { value: new THREE.Vector2() },
      _DiffuseTex: { value: null }, _DiffuseBlurTex: { value: null },
      _ShapeRecognition: { value: 0.0 }, _LightRotation: { value: 0.0 }, _ShapeBias: { value: 0.5 },
    })
    this.normalCombineMat = M(normalCombineFrag, this.make7BandUniforms(
      [], ['_Angularity', '_AngularIntensity', '_FinalContrast', '_FlipNormalY'],
    ))
    this.roughnessMat = M(roughnessCombineFrag, {
      _MainTex: { value: null }, _Blurred: { value: null }, _MetallicTex: { value: null },
      _Overlay: { value: 3.0 }, _MetalSmoothness: { value: 0.7 }, _BaseSmoothness: { value: 0.1 },
      _FinalContrast: { value: 1.0 },
      _FinalBias: { value: 0 }, _Invert: { value: 1.0 },
    })
    this.metallicMat = M(metallicMatchFrag, {
      _MainTex: { value: null }, _BlurTex: { value: null }, _OverlayBlurTex: { value: null },
      _BlurOverlay: { value: 1.0 }, _FinalContrast: { value: 1.0 },
      _FinalBias: { value: 0 }, _Invert: { value: 0 },
      _MetalColor: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      _HueWeight: { value: 1.0 }, _SatWeight: { value: 0.5 }, _LumWeight: { value: 0.2 },
      _MaskLow: { value: 0.0 }, _MaskHigh: { value: 1.0 },
    })
    this.aoIterMat = M(aoIterateFrag, {
      _MainTex: { value: null }, _HeightTex: { value: null }, _BlendTex: { value: null },
      _TexelSize: { value: new THREE.Vector2() }, _Progress: { value: 0 },
      _BlendAmount: { value: 1.0 }, _Spread: { value: 50.0 }, _Depth: { value: 100.0 },
      _FlipNormalY: { value: 1.0 }, _Samples: { value: 50 },
    })
    this.aoCombineMat = M(aoCombineFrag, {
      _MainTex: { value: null }, _AOBlend: { value: 0.5 },
      _FinalContrast: { value: 1.0 }, _FinalBias: { value: 0 },
    })
    this.edgeBaseMat = M(edgeBaseFrag, {
      _MainTex: { value: null }, _BlurContrast: { value: 1.0 },
      _FlipNormalY: { value: 1.0 }, _TexelSize: { value: new THREE.Vector2() },
    })
    this.edgeCombineMat = M(edgeCombineFrag, this.make7BandUniforms(
      [], ['_EdgeAmount', '_CreviceAmount', '_Pinch', '_Pillow', '_FinalContrast', '_FinalBias', '_Invert'],
    ))
    this.sampleMatchMat = M(sampleMatchFrag, {
      _MainTex: { value: null }, _SampleBlurTex: { value: null },
      _SampleColor1: { value: new THREE.Vector3() },
      _HueWeight1: { value: 1.0 }, _SatWeight1: { value: 0.5 }, _LumWeight1: { value: 0.2 },
      _MaskLow1: { value: 0.0 }, _MaskHigh1: { value: 1.0 }, _SampleHeight1: { value: 0.5 },
      _UseSample1: { value: 0.0 }, _IsolateSample1: { value: 0.0 },
      _SampleColor2: { value: new THREE.Vector3() },
      _HueWeight2: { value: 1.0 }, _SatWeight2: { value: 0.5 }, _LumWeight2: { value: 0.2 },
      _MaskLow2: { value: 0.0 }, _MaskHigh2: { value: 1.0 }, _SampleHeight2: { value: 0.3 },
      _UseSample2: { value: 0.0 }, _IsolateSample2: { value: 0.0 },
      _SampleBlend: { value: 0.5 }, _GamaCorrection: { value: 1.0 },
    })
    this.editDiffuseMat = M(editDiffuseFrag, {
      _MainTex: { value: null }, _BlurTex: { value: null }, _AvgTex: { value: null },
      _BlurContrast: { value: 0.0 },
      _LightMaskPow: { value: 0.5 }, _LightPow: { value: 0.0 },
      _DarkMaskPow: { value: 0.5 }, _DarkPow: { value: 0.0 },
      _HotSpot: { value: 0.0 }, _DarkSpot: { value: 0.0 },
      _FinalContrast: { value: 1.0 }, _FinalBias: { value: 0.0 },
      _ColorLerp: { value: 0.5 }, _Saturation: { value: 1.0 },
    })
    this.hfnIterMat = M(hfnIterateFrag, {
      _MainTex: { value: null }, _HeightTex: { value: null }, _BlendTex: { value: null },
      _TexelSize: { value: new THREE.Vector2() }, _Progress: { value: 0 },
      _BlendAmount: { value: 1.0 }, _Spread: { value: 50.0 }, _SpreadBoost: { value: 1.0 },
      _Samples: { value: 50 }, _FlipNormalY: { value: 1.0 },
    })
    this.seamlessOverlapMat = M(seamlessOverlapFrag, {
      _MainTex: { value: null }, _HeightTex: { value: null },
      _Overlap: { value: new THREE.Vector2(0.2, 0.2) },
      _Falloff: { value: 0.1 }, _IsHeight: { value: 0.0 }, _IsNormal: { value: 0.0 }, _FlipY: { value: 0.0 },
    })
    this.seamlessSplatMat = M(seamlessSplatFrag, {
      _MainTex: { value: null }, _HeightTex: { value: null }, _TargetTex: { value: null },
      _SplatKernel: { value: new THREE.Vector4(0.5, 0.5, 1.0, 0.0) },
      _SplatScale: { value: 1.0 }, _AspectRatio: { value: new THREE.Vector2(1.0, 1.0) },
      _TargetAspectRatio: { value: new THREE.Vector2(1.0, 1.0) },
      _SplatRotation: { value: 0.0 }, _SplatRotationRandom: { value: 0.25 },
      _SplatRandomize: { value: 0.0 }, _Wobble: { value: new THREE.Vector3(0, 0, 0.2) },
      _Falloff: { value: 0.1 }, _IsHeight: { value: 0.0 }, _IsNormal: { value: 0.0 }, _FlipY: { value: 0.0 },
    })
    this.seamlessClearMat = M(seamlessClearFrag, {})
    this.seamlessTransferMat = M(seamlessTransferFrag, { _MainTex: { value: null } })
    this.albedoAdjustMat = M(albedoAdjustFrag, {
      _MainTex: { value: null },
      _Brightness: { value: 0 }, _Contrast: { value: 0 }, _Invert: { value: 0 },
      _Exposure: { value: 0 }, _ExposureOffset: { value: 0 }, _ExposureGamma: { value: 1.0 },
      _ColorBalanceR: { value: 0 }, _ColorBalanceG: { value: 0 }, _ColorBalanceB: { value: 0 },
      _ColorBalancePreserveLuma: { value: 1.0 },
      _BlackAndWhite: { value: 0 },
      _LevelsMin: { value: 0 }, _LevelsMax: { value: 255 },
      _LevelsMid: { value: 1.0 }, _LevelsOutMin: { value: 0 }, _LevelsOutMax: { value: 255 },
      _Hue: { value: 0 }, _Saturation: { value: 0 }, _Lightness: { value: 0 },
      _Vibrance: { value: 0 }, _Colorize: { value: 0 },
    })
  }

  private make7BandUniforms(extraSamplers: string[], extraFloats: string[]): Record<string, any> {
    const u: Record<string, any> = {}
    for (let i = 0; i < 7; i++) {
      u[`_BlurTex${i}`] = { value: null }
      u[`_Blur${i}Weight`] = { value: 1.0 }
      u[`_Blur${i}Contrast`] = { value: 1.0 }
    }
    for (const s of extraSamplers) u[s] = { value: null }
    for (const f of extraFloats) u[f] = { value: f === '_Invert' ? 0.0 : 1.0 }
    return u
  }

  private render(mat: THREE.ShaderMaterial, output: THREE.WebGLRenderTarget) {
    if (!this.renderer) {
      console.warn('[PBR] render() skipped — no renderer')
      return
    }
    const gl = this.renderer.getContext() as WebGL2RenderingContext
    const glErr1 = gl.getError()
    if (glErr1 !== gl.NO_ERROR) {
      this.pbrLog('render() pre-existing GL error:', glErr1)
    }
    this.quad.material = mat
    this.renderer.setRenderTarget(output)
    this.renderer.render(this.scene, this.camera)
    const glErr2 = gl.getError()
    if (glErr2 !== gl.NO_ERROR) {
      this.pbrLog('render() GL error after draw:', glErr2, 'shader:', mat.fragmentShader?.substring(0, 60))
    }
    this.renderer.setRenderTarget(null)
  }

  private sampleRT(rt: THREE.WebGLRenderTarget, label: string) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext
    this.renderer.setRenderTarget(rt)
    const w = Math.min(rt.width, 4)
    const h = Math.min(rt.height, 4)
    const floatBuf = new Float32Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, floatBuf)
    const glErr = gl.getError()
    this.renderer.setRenderTarget(null)
    const samples: number[] = []
    for (let i = 0; i < Math.min(4, w * h); i++) {
      samples.push(
        Math.round(floatBuf[i * 4] * 255),
        Math.round(floatBuf[i * 4 + 1] * 255),
        Math.round(floatBuf[i * 4 + 2] * 255),
        Math.round(floatBuf[i * 4 + 3] * 255),
      )
    }
    const isBlack = samples.every(v => v <= 2)
    this.pbrLog(`sampleRT(${label})`, `${rt.width}x${rt.height}`, isBlack ? '*** ALL BLACK ***' : 'has data', 'px[0-3]:', samples.slice(0, 16), glErr !== gl.NO_ERROR ? `GL_ERR=${glErr}` : '')
  }

  private blur(input: THREE.Texture, output: THREE.WebGLRenderTarget, spread: number, w: number, h: number, samples: number = 4, contrast: number = 1.0, desaturate: number = 0) {
    const tmp = this.pool.acquire(w, h)
    const ts = new THREE.Vector2(1 / w, 1 / h)
    this.blurMat.uniforms._TexelSize.value.copy(ts)
    this.blurMat.uniforms._BlurContrast.value = contrast
    this.blurMat.uniforms._Desaturate.value = desaturate
    this.blurMat.uniforms._BlurSamples.value = samples

    this.blurMat.uniforms._MainTex.value = input
    this.blurMat.uniforms._BlurDirection.value.set(1, 0)
    this.blurMat.uniforms._BlurSpread.value = spread
    this.render(this.blurMat, tmp)

    this.blurMat.uniforms._MainTex.value = tmp.texture
    this.blurMat.uniforms._BlurDirection.value.set(0, 1)
    this.render(this.blurMat, output)

    this.pool.release(tmp)
  }

  private toLuminance(input: THREE.Texture, output: THREE.WebGLRenderTarget) {
    this.lumaMat.uniforms._MainTex.value = input
    this.render(this.lumaMat, output)
  }

  private cascadeBlur(input: THREE.Texture, spreads: number[], w: number, h: number, samples: number = 4, contrast: number = 1.0): THREE.WebGLRenderTarget[] {
    const results: THREE.WebGLRenderTarget[] = []
    let current = input
    for (const s of spreads) {
      const rt = this.pool.acquire(w, h)
      this.blur(current, rt, s, w, h, samples, contrast)
      results.push(rt)
      current = rt.texture
    }
    return results
  }

  private releaseRTs(rts: THREE.WebGLRenderTarget[]) {
    for (const rt of rts) this.pool.release(rt)
  }

  public canvasToTex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }

  private computeAvgColor(input: THREE.Texture, srcW: number, srcH: number): THREE.WebGLRenderTarget {
    const e = ((srcW + srcH) * 0.5) / 1024.0
    const small = this.pool.acquire(256, 256)
    this.blur(input, small, 64.0 * e, srcW, srcH, 32, 1.0, 1)
    const avgRT = this.pool.acquire(256, 256)
    this.blur(small.texture, avgRT, 64.0 * e, 256, 256, 32, 1.0, 0)
    this.pool.release(small)
    return avgRT
  }

  private getSpreads(w: number, h: number): number[] {
    const e = ((w + h) * 0.5) / 1024.0
    return [1.0, 1.0 + e, 1.0 + e + 2 * e, 1.0 + e + 2 * e + 4 * e, 1.0 + e + 2 * e + 4 * e + 8 * e, 1.0 + e + 2 * e + 4 * e + 8 * e + 16 * e]
  }

  generateHeight(albedoTex: THREE.Texture, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    this.pbrLog('generateHeight() start', { texType: albedoTex.constructor.name, hasImage: !!albedoTex.image, res: `${w}x${h}` })
    const lumaRT = this.pool.acquire(w, h)
    this.toLuminance(albedoTex, lumaRT)
    this.sampleRT(lumaRT, 'height/lumaRT')

    const echoRT = this.pool.acquire(w, h)
    this.renderWithTexture(albedoTex, echoRT)
    this.sampleRT(echoRT, 'height/rawEcho')
    this.pool.release(echoRT)

    let heightInput: THREE.Texture = lumaRT.texture
    const samples: any[] = params.samples || []
    const hasSamples = samples.some((s: any) => s.enabled)
    let sampleMatchRT: THREE.WebGLRenderTarget | null = null

    if (hasSamples) {
      const blurRT = this.pool.acquire(w, h)
      this.blur(albedoTex, blurRT, 2.0, w, h, 4, 1.0)

      const su = this.sampleMatchMat.uniforms
      su._MainTex.value = lumaRT.texture
      su._SampleBlurTex.value = blurRT.texture
      for (let i = 0; i < 2; i++) {
        const s = samples[i] || {} as any
        const idx = i + 1
        su[`_SampleColor${idx}`].value.set(...(s.color || [0, 0, 0]))
        su[`_HueWeight${idx}`].value = s.hueWeight ?? 1.0
        su[`_SatWeight${idx}`].value = s.satWeight ?? 0.5
        su[`_LumWeight${idx}`].value = s.lumWeight ?? 0.2
        su[`_MaskLow${idx}`].value = s.maskLow ?? 0.0
        su[`_MaskHigh${idx}`].value = s.maskHigh ?? 1.0
        su[`_SampleHeight${idx}`].value = s.targetValue ?? 0.5
        su[`_UseSample${idx}`].value = s.enabled ? 1.0 : 0.0
        su[`_IsolateSample${idx}`].value = s.isolate ? 1.0 : 0.0
      }
      su._SampleBlend.value = params.sampleBlend ?? 0.5
      su._GamaCorrection.value = 1.0

      sampleMatchRT = this.pool.acquire(w, h)
      this.render(this.sampleMatchMat, sampleMatchRT)
      this.pool.release(blurRT)
      heightInput = sampleMatchRT.texture
    }

    const spreads = this.getSpreads(w, h)
    const blurs = this.cascadeBlur(heightInput, spreads, w, h, 4, 1.0)
    if (blurs.length > 0) this.sampleRT(blurs[blurs.length - 1], 'height/lastBlur')

    const lastBlur = blurs.length > 0 ? blurs[blurs.length - 1].texture : heightInput
    const avgRT = this.computeAvgColor(lastBlur, w, h)

    for (let i = 0; i < blurs.length; i++) {
      this.pool.setNamed(`heightBlur${i + 1}`, blurs[i])
    }
    this.pool.setNamed('heightBlur0', this.pool.acquire(w, h))
    const blur0RT = this.pool.getNamed('heightBlur0')!
    this.renderWithTexture(heightInput, blur0RT)
    this.sampleRT(blur0RT, 'height/blur0')
    this.pool.setNamed('heightAvg', avgRT)
    this.pool.setNamed('heightLuma', lumaRT)
    if (sampleMatchRT) this.pool.setNamed('heightSampleMatch', sampleMatchRT)

    const output = this.applyHeightCombine(params, w, h)
    this.sampleRT(output, 'generateHeight output')
    return output
  }

  private renderWithTexture(tex: THREE.Texture, output: THREE.WebGLRenderTarget) {
    const tmpMat = M(seamlessTransferFrag, { _MainTex: { value: tex } })
    this.render(tmpMat, output)
    tmpMat.dispose()
  }

  private applyHeightCombine(params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const blur0 = this.pool.getNamed('heightBlur0')
    const avgRT = this.pool.getNamed('heightAvg')

    const u = this.heightMat.uniforms
    u._AvgTex.value = avgRT ? avgRT.texture : null
    u._BlurTex0.value = blur0 ? blur0.texture : null
    for (let i = 1; i <= 6; i++) {
      const blurRT = this.pool.getNamed(`heightBlur${i}`)
      u[`_BlurTex${i}`].value = blurRT ? blurRT.texture : null
    }

    const weights = params.weights || [0.15, 0.19, 0.30, 0.50, 0.70, 0.90, 1.00]
    const contrasts = params.contrasts || [1, 1, 1, 1, 1, 1, 1]
    for (let i = 0; i < 7; i++) {
      u[`_Blur${i}Weight`].value = weights[i] ?? 0.5
      u[`_Blur${i}Contrast`].value = contrasts[i] ?? 1.0
    }
    u._FinalContrast.value = params.finalContrast ?? 1.5
    u._FinalBias.value = params.finalBias ?? 0
    let realGain = params.finalGain ?? 0
    if (realGain < 0) realGain = Math.abs(1.0 / (realGain - 1.0))
    else realGain = realGain + 1.0
    u._FinalGain.value = realGain
    u._Invert.value = params.invert ? 1.0 : 0.0

    const output = this.pool.acquire(w, h)
    this.render(this.heightMat, output)
    return output
  }

  recombineHeight(params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    return this.applyHeightCombine(params, w, h)
  }

  invalidateHeightCache() {
    for (let i = 0; i <= 6; i++) this.pool.deleteNamed(`heightBlur${i}`)
    this.pool.deleteNamed('heightAvg')
    this.pool.deleteNamed('heightLuma')
    this.pool.deleteNamed('heightSampleMatch')
  }

  generateNormal(heightRT: THREE.WebGLRenderTarget, params: Record<string, any>, w: number, h: number, albedoTex?: THREE.Texture | null): THREE.WebGLRenderTarget {
    const shapeRecognition = params.shapeRecognition ?? 0
    const u = this.normalBaseMat.uniforms
    u._MainTex.value = heightRT.texture
    u._BlurContrast.value = params.preContrast ?? 20.0
    u._TexelSize.value.set(1 / w, 1 / h)
    u._ShapeRecognition.value = shapeRecognition
    u._LightRotation.value = params.lightRotation ?? 0
    u._ShapeBias.value = params.shapeBias ?? 0.5

    if (shapeRecognition > 0.001 && albedoTex) {
      u._DiffuseTex.value = albedoTex
      const diffBlurRT = this.pool.acquire(w, h)
      this.blur(albedoTex, diffBlurRT, 1.0, w, h, params.slopeBlur ?? 50, 1.0)
      u._DiffuseBlurTex.value = diffBlurRT.texture

      const baseNormalRT = this.pool.acquire(w, h)
      this.render(this.normalBaseMat, baseNormalRT)
      this.pool.release(diffBlurRT)

      const spreads = this.getSpreads(w, h)
      const blurs = this.cascadeBlur(baseNormalRT.texture, spreads, w, h, 4, 1.0)

      const cu = this.normalCombineMat.uniforms
      cu._BlurTex0.value = baseNormalRT.texture
      for (let i = 0; i < blurs.length; i++) cu[`_BlurTex${i + 1}`].value = blurs[i].texture

      const weights = params.weights || [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]
      for (let i = 0; i < 7; i++) cu[`_Blur${i}Weight`].value = weights[i] ?? 0.5
      cu._Angularity.value = params.angularity ?? 0.0
      cu._AngularIntensity.value = params.angularIntensity ?? 0.5
      cu._FinalContrast.value = params.finalContrast ?? 1.0
      cu._FlipNormalY.value = params.invertY ? 0.0 : 1.0

      const output = this.pool.acquire(w, h)
      this.render(this.normalCombineMat, output)

      this.pool.release(baseNormalRT)
      this.releaseRTs(blurs)
      return output
    }

    u._DiffuseTex.value = null
    u._DiffuseBlurTex.value = null

    const baseNormalRT = this.pool.acquire(w, h)
    this.render(this.normalBaseMat, baseNormalRT)

    const spreads = this.getSpreads(w, h)
    const blurs = this.cascadeBlur(baseNormalRT.texture, spreads, w, h, 4, 1.0)

    const cu = this.normalCombineMat.uniforms
    cu._BlurTex0.value = baseNormalRT.texture
    for (let i = 0; i < blurs.length; i++) cu[`_BlurTex${i + 1}`].value = blurs[i].texture

    const weights = params.weights || [0.30, 0.35, 0.50, 0.80, 1.00, 0.95, 0.80]
    for (let i = 0; i < 7; i++) cu[`_Blur${i}Weight`].value = weights[i] ?? 0.5
    cu._Angularity.value = params.angularity ?? 0.0
    cu._AngularIntensity.value = params.angularIntensity ?? 0.5
    cu._FinalContrast.value = params.finalContrast ?? 1.0
    cu._FlipNormalY.value = params.invertY ? 0.0 : 1.0

    const output = this.pool.acquire(w, h)
    this.render(this.normalCombineMat, output)

    this.pool.release(baseNormalRT)
    this.releaseRTs(blurs)
    return output
  }

  generateRoughness(albedoTex: THREE.Texture, params: Record<string, any>, w: number, h: number, metallicRT?: THREE.WebGLRenderTarget | null): THREE.WebGLRenderTarget {
    const lumaRT = this.pool.acquire(w, h)
    this.toLuminance(albedoTex, lumaRT)

    const samples: any[] = params.samples || []
    const hasSamples = samples.some((s: any) => s.enabled)
    let roughnessInput: THREE.Texture = lumaRT.texture
    let sampleMatchRT: THREE.WebGLRenderTarget | null = null

    if (hasSamples) {
      const blurRT = this.pool.acquire(w, h)
      this.blur(albedoTex, blurRT, 2.0, w, h, 4, 1.0)

      const su = this.sampleMatchMat.uniforms
      su._MainTex.value = lumaRT.texture
      su._SampleBlurTex.value = blurRT.texture
      for (let i = 0; i < 2; i++) {
        const s = samples[i] || {} as any
        const idx = i + 1
        su[`_SampleColor${idx}`].value.set(...(s.color || [0, 0, 0]))
        su[`_HueWeight${idx}`].value = s.hueWeight ?? 1.0
        su[`_SatWeight${idx}`].value = s.satWeight ?? 0.5
        su[`_LumWeight${idx}`].value = s.lumWeight ?? 0.2
        su[`_MaskLow${idx}`].value = s.maskLow ?? 0.0
        su[`_MaskHigh${idx}`].value = s.maskHigh ?? 1.0
        su[`_SampleHeight${idx}`].value = s.targetValue ?? 0.5
        su[`_UseSample${idx}`].value = s.enabled ? 1.0 : 0.0
        su[`_IsolateSample${idx}`].value = s.isolate ? 1.0 : 0.0
      }
      su._SampleBlend.value = params.sampleBlend ?? 0.5
      su._GamaCorrection.value = 1.0

      sampleMatchRT = this.pool.acquire(w, h)
      this.render(this.sampleMatchMat, sampleMatchRT)
      this.pool.release(blurRT)
      roughnessInput = sampleMatchRT.texture
    }

    const b2RT = this.pool.acquire(w, h)
    this.blur(roughnessInput, b2RT, (params.highPassBlurSize || 30), w, h, 4, 1.0)

    const u = this.roughnessMat.uniforms
    u._MainTex.value = roughnessInput
    u._Blurred.value = b2RT.texture
    u._MetallicTex.value = metallicRT ? metallicRT.texture : null
    u._Overlay.value = params.highPassOverlay ?? 3.0
    u._MetalSmoothness.value = params.metalSmoothness ?? 0.7
    u._BaseSmoothness.value = params.baseSmoothness ?? 0.1
    u._FinalContrast.value = params.finalContrast ?? 1.0
    u._FinalBias.value = params.finalBias ?? 0
    u._Invert.value = params.invert ? 1.0 : 0.0

    const output = this.pool.acquire(w, h)
    this.render(this.roughnessMat, output)

    this.pool.release(lumaRT)
    if (sampleMatchRT) this.pool.release(sampleMatchRT)
    this.pool.release(b2RT)
    return output
  }

  generateMetallic(albedoTex: THREE.Texture, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const blurRT = this.pool.acquire(w, h)
    this.blur(albedoTex, blurRT, (params.blurSize || 0), w, h, 4, 1.0)
    const overlayBlurRT = this.pool.acquire(w, h)
    this.blur(albedoTex, overlayBlurRT, (params.overlayBlurSize || 30), w, h, 4, 1.0)

    const sample = params.sample || {}
    const u = this.metallicMat.uniforms
    u._MainTex.value = albedoTex
    u._BlurTex.value = blurRT.texture
    u._OverlayBlurTex.value = overlayBlurRT.texture
    u._BlurOverlay.value = params.highPassOverlay ?? 1.0
    u._FinalContrast.value = params.finalContrast ?? 1.0
    u._FinalBias.value = params.finalBias ?? 0
    u._Invert.value = params.invert ? 1.0 : 0.0
    u._MetalColor.value.set(...(sample.color || [0.5, 0.5, 0.5]))
    u._HueWeight.value = sample.hueWeight ?? 1.0
    u._SatWeight.value = sample.satWeight ?? 0.5
    u._LumWeight.value = sample.lumWeight ?? 0.2
    u._MaskLow.value = sample.maskLow ?? 0.0
    u._MaskHigh.value = sample.maskHigh ?? 1.0

    const output = this.pool.acquire(w, h)
    this.render(this.metallicMat, output)

    this.pool.release(blurRT)
    this.pool.release(overlayBlurRT)
    return output
  }

  generateEditDiffuse(albedoTex: THREE.Texture, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const blurRT = this.pool.acquire(w, h)
    this.blur(albedoTex, blurRT, 1.0, w, h, params.blurSize ?? 20, 1.0)

    const avg1RT = this.pool.acquire(w, h)
    this.blur(albedoTex, avg1RT, 1.0, w, h, params.avgBlurSize ?? 50, 1.0)
    const avgRT = this.pool.acquire(w, h)
    const halfBlur = Math.max(1, Math.round((params.avgBlurSize ?? 50) / 5))
    this.blur(avg1RT.texture, avgRT, 1.0, w, h, halfBlur, 1.0)
    this.pool.release(avg1RT)

    const u = this.editDiffuseMat.uniforms
    u._MainTex.value = albedoTex
    u._BlurTex.value = blurRT.texture
    u._AvgTex.value = avgRT.texture
    u._BlurContrast.value = params.blurContrast ?? 0.0
    u._LightMaskPow.value = params.lightMaskPow ?? 0.5
    u._LightPow.value = params.lightPow ?? 0.0
    u._DarkMaskPow.value = params.darkMaskPow ?? 0.5
    u._DarkPow.value = params.darkPow ?? 0.0
    u._HotSpot.value = params.hotSpot ?? 0.0
    u._DarkSpot.value = params.darkSpot ?? 0.0
    u._FinalContrast.value = params.finalContrast ?? 1.0
    u._FinalBias.value = params.finalBias ?? 0.0
    u._ColorLerp.value = params.colorLerp ?? 0.5
    u._Saturation.value = params.saturation ?? 1.0

    const output = this.pool.acquire(w, h)
    this.render(this.editDiffuseMat, output)

    this.pool.release(blurRT)
    this.pool.release(avgRT)
    return output
  }

  generateAlbedoAdjust(inputTex: THREE.Texture, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const u = this.albedoAdjustMat.uniforms
    u._MainTex.value = inputTex
    u._Brightness.value = params.brightness ?? 0
    u._Contrast.value = params.contrast ?? 0
    u._Invert.value = params.invert ? 1.0 : 0.0
    u._Exposure.value = params.exposure ?? 0
    u._ExposureOffset.value = params.exposureOffset ?? 0
    u._ExposureGamma.value = params.exposureGamma ?? 1.0
    u._ColorBalanceR.value = params.colorBalanceR ?? 0
    u._ColorBalanceG.value = params.colorBalanceG ?? 0
    u._ColorBalanceB.value = params.colorBalanceB ?? 0
    u._ColorBalancePreserveLuma.value = params.colorBalancePreserveLuma !== false ? 1.0 : 0.0
    u._BlackAndWhite.value = params.blackAndWhite ? 1.0 : 0.0
    u._LevelsMin.value = params.levelsMin ?? 0
    u._LevelsMax.value = params.levelsMax ?? 255
    u._LevelsMid.value = params.levelsMid ?? 1.0
    u._LevelsOutMin.value = params.levelsOutMin ?? 0
    u._LevelsOutMax.value = params.levelsOutMax ?? 255
    u._Hue.value = params.hue ?? 0
    u._Saturation.value = params.saturation ?? 0
    u._Lightness.value = params.lightness ?? 0
    u._Vibrance.value = params.vibrance ?? 0
    u._Colorize.value = params.colorize ? 1.0 : 0.0

    const output = this.pool.acquire(w, h)
    this.render(this.albedoAdjustMat, output)
    return output
  }

  generateHeightFromNormal(normalRT: THREE.WebGLRenderTarget, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const totalPasses = 99
    const spread = params.spread ?? 50
    const spreadBoost = params.spreadBoost ?? 1.0
    const flipY = params.invertY ? 0.0 : 1.0

    let workingRT = this.pool.acquire(w, h)
    let blendedRT = this.pool.acquire(w, h)

    this.hfnIterMat.uniforms._MainTex.value = normalRT.texture
    this.hfnIterMat.uniforms._TexelSize.value.set(1 / w, 1 / h)
    this.hfnIterMat.uniforms._Spread.value = spread
    this.hfnIterMat.uniforms._SpreadBoost.value = spreadBoost
    this.hfnIterMat.uniforms._Samples.value = spread
    this.hfnIterMat.uniforms._FlipNormalY.value = flipY

    for (let i = 1; i <= totalPasses; i++) {
      this.hfnIterMat.uniforms._Progress.value = i / 100.0
      this.hfnIterMat.uniforms._BlendAmount.value = 1.0 / i
      this.hfnIterMat.uniforms._BlendTex.value = blendedRT.texture
      this.render(this.hfnIterMat, workingRT)
      const tmp = blendedRT
      blendedRT = workingRT
      workingRT = tmp
    }

    this.pool.release(workingRT)

    const output = this.pool.acquire(w, h)
    const cu = this.heightMat.uniforms
    cu._AvgTex.value = blendedRT.texture
    cu._BlurTex0.value = blendedRT.texture
    for (let i = 1; i < 7; i++) {
      cu[`_BlurTex${i}`].value = blendedRT.texture
      cu[`_Blur${i}Weight`].value = 0
    }
    cu._Blur0Weight.value = 1.0
    cu._Blur0Contrast.value = 1.0
    cu._FinalContrast.value = params.finalContrast ?? 1.5
    cu._FinalBias.value = params.finalBias ?? 0
    let hfnGain = params.finalGain ?? 0
    if (hfnGain < 0) hfnGain = Math.abs(1.0 / (hfnGain - 1.0))
    else hfnGain = hfnGain + 1.0
    cu._FinalGain.value = hfnGain
    cu._Invert.value = params.invert ? 1.0 : 0.0
    this.render(this.heightMat, output)

    this.pool.release(blendedRT)
    return output
  }

  generateAO(normalRT: THREE.WebGLRenderTarget, heightRT: THREE.WebGLRenderTarget, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const totalPasses = params.iterations ?? 100
    const samples = params.samples ?? 50

    let workingRT = this.pool.acquire(w, h)
    let blendedRT = this.pool.acquire(w, h)

    this.aoIterMat.uniforms._MainTex.value = normalRT.texture
    this.aoIterMat.uniforms._HeightTex.value = heightRT.texture
    this.aoIterMat.uniforms._TexelSize.value.set(1 / w, 1 / h)
    this.aoIterMat.uniforms._Spread.value = params.spread ?? 50.0
    this.aoIterMat.uniforms._Depth.value = params.depth ?? 100.0
    this.aoIterMat.uniforms._FlipNormalY.value = params.invertY ? 0.0 : 1.0
    this.aoIterMat.uniforms._Samples.value = samples

    for (let i = 1; i <= totalPasses; i++) {
      this.aoIterMat.uniforms._Progress.value = i / totalPasses
      this.aoIterMat.uniforms._BlendAmount.value = 1.0 / i
      this.aoIterMat.uniforms._BlendTex.value = blendedRT.texture
      this.render(this.aoIterMat, workingRT)
      const tmp = blendedRT
      blendedRT = workingRT
      workingRT = tmp
    }

    this.pool.release(workingRT)

    const cu = this.aoCombineMat.uniforms
    cu._MainTex.value = blendedRT.texture
    cu._AOBlend.value = params.aoBlend ?? 0.5
    cu._FinalContrast.value = params.aoPower ?? 1.0
    cu._FinalBias.value = params.aoBias ?? 0

    const output = this.pool.acquire(w, h)
    this.render(this.aoCombineMat, output)

    this.pool.release(blendedRT)
    return output
  }

  generateEdge(normalRT: THREE.WebGLRenderTarget, params: Record<string, any>, w: number, h: number): THREE.WebGLRenderTarget {
    const u = this.edgeBaseMat.uniforms
    u._MainTex.value = normalRT.texture
    u._BlurContrast.value = params.preContrast ?? 1.0
    u._FlipNormalY.value = params.invertY ? 0.0 : 1.0
    u._TexelSize.value.set(1 / w, 1 / h)
    const edgeBaseRT = this.pool.acquire(w, h)
    this.render(this.edgeBaseMat, edgeBaseRT)

    const spreads = this.getSpreads(w, h)
    const blurs = this.cascadeBlur(edgeBaseRT.texture, spreads, w, h, 4, 1.0)

    const cu = this.edgeCombineMat.uniforms
    cu._BlurTex0.value = edgeBaseRT.texture
    for (let i = 0; i < blurs.length; i++) cu[`_BlurTex${i + 1}`].value = blurs[i].texture

    const weights = params.weights || [0.30, 0.50, 0.70, 1.00, 0.80, 0.50, 0.30]
    for (let i = 0; i < 7; i++) cu[`_Blur${i}Weight`].value = weights[i] ?? 0.5
    cu._EdgeAmount.value = params.edgeAmount ?? 1.0
    cu._CreviceAmount.value = params.creviceAmount ?? 1.0
    cu._Pinch.value = params.pinch ?? 1.0
    cu._Pillow.value = params.pillow ?? 1.0
    cu._FinalContrast.value = params.finalContrast ?? 1.0
    cu._FinalBias.value = params.finalBias ?? 0
    cu._Invert.value = params.invert ? 1.0 : 0.0

    const output = this.pool.acquire(w, h)
    this.render(this.edgeCombineMat, output)

    this.pool.release(edgeBaseRT)
    this.releaseRTs(blurs)
    return output
  }

  renderTargetToCanvas(rt: THREE.WebGLRenderTarget): HTMLCanvasElement {
    const w = rt.width
    const h = rt.height

    this.renderer.setRenderTarget(rt)
    const gl = this.renderer.getContext() as WebGL2RenderingContext

    let buf: Uint8Array
    const ext = gl.getExtension('EXT_color_buffer_half_float') || gl.getExtension('EXT_color_buffer_float')
    if (ext) {
      const floatBuf = new Float32Array(w * h * 4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, floatBuf)
      buf = new Uint8Array(w * h * 4)
      for (let i = 0; i < floatBuf.length; i++) {
        buf[i] = Math.min(255, Math.max(0, Math.round(floatBuf[i] * 255)))
      }
    } else {
      buf = new Uint8Array(w * h * 4)
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    }
    this.renderer.setRenderTarget(null)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const imgData = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = ((h - 1 - y) * w + x) * 4
        const dstIdx = (y * w + x) * 4
        imgData.data[dstIdx] = buf[srcIdx]
        imgData.data[dstIdx + 1] = buf[srcIdx + 1]
        imgData.data[dstIdx + 2] = buf[srcIdx + 2]
        imgData.data[dstIdx + 3] = buf[srcIdx + 3]
      }
    }
    ctx.putImageData(imgData, 0, 0)
    return canvas
  }

  getPool(): TexturePool {
    return this.pool
  }

  generateAllRT(
    albedoCanvas: HTMLCanvasElement,
    paramsMap: Record<PBRChannel, Record<string, any>>,
    resolution: number,
  ): Record<PBRChannel, THREE.WebGLRenderTarget | null> {
    const w = resolution
    const h = resolution
    const results: Record<string, THREE.WebGLRenderTarget | null> = {}
    const rawAlbedoTex = this.canvasToTex(albedoCanvas)

    const edParams = paramsMap.albedo?.editDiffuse
    let albedoTex: THREE.Texture = rawAlbedoTex
    let edRT: THREE.WebGLRenderTarget | null = null
    if (edParams && edParams.enabled) {
      edRT = this.generateEditDiffuse(rawAlbedoTex, edParams, w, h)
      albedoTex = edRT.texture
      this.pool.setNamed('editDiffuse', edRT)
    }

    const dispParams = paramsMap.displacement
    let heightRT: THREE.WebGLRenderTarget
    let normalRT: THREE.WebGLRenderTarget

    if (dispParams.sourceMode === 'normal') {
      const tmpHeightRT = this.generateHeight(albedoTex, dispParams, w, h)
      normalRT = this.generateNormal(tmpHeightRT, paramsMap.normal, w, h, albedoTex)
      this.pool.release(tmpHeightRT)
      heightRT = this.generateHeightFromNormal(normalRT, dispParams, w, h)
    } else {
      heightRT = this.generateHeight(albedoTex, dispParams, w, h)
      normalRT = this.generateNormal(heightRT, paramsMap.normal, w, h, albedoTex)
    }

    results.displacement = heightRT
    this.pool.setNamed('height', heightRT)
    results.normal = normalRT
    this.pool.setNamed('normal', normalRT)

    const metallicRT = this.generateMetallic(albedoTex, paramsMap.metallic, w, h)
    results.metallic = metallicRT

    const roughnessRT = this.generateRoughness(albedoTex, paramsMap.roughness, w, h, metallicRT)
    results.roughness = roughnessRT

    const aoRT = this.generateAO(normalRT, heightRT, paramsMap.ao, w, h)
    results.ao = aoRT

    const edgeRT = this.generateEdge(normalRT, paramsMap.edge, w, h)
    results.edge = edgeRT

    rawAlbedoTex.dispose()

    results.albedo = null
    if (albedoTex !== rawAlbedoTex && albedoTex instanceof THREE.CanvasTexture) {
      albedoTex.dispose()
    }
    return results as Record<PBRChannel, THREE.WebGLRenderTarget | null>
  }

  generateAll(
    albedoCanvas: HTMLCanvasElement,
    paramsMap: Record<PBRChannel, Record<string, any>>,
    resolution: number,
  ): Record<PBRChannel, HTMLCanvasElement | null> {
    const rtResults = this.generateAllRT(albedoCanvas, paramsMap, resolution)
    const results: Record<string, HTMLCanvasElement | null> = {}
    for (const ch of TOPOLOGICAL_ORDER) {
      if (rtResults[ch]) {
        results[ch] = this.renderTargetToCanvas(rtResults[ch]!)
      } else {
        results[ch] = null
      }
    }
    results.albedo = albedoCanvas
    return results as Record<PBRChannel, HTMLCanvasElement | null>
  }

  dispose() {
    this.pool.dispose()
    const mats = [this.blurMat, this.lumaMat, this.heightMat, this.normalBaseMat,
      this.normalCombineMat, this.roughnessMat, this.metallicMat, this.aoIterMat,
      this.aoCombineMat, this.edgeBaseMat, this.edgeCombineMat, this.sampleMatchMat,
      this.editDiffuseMat, this.hfnIterMat,
      this.seamlessOverlapMat, this.seamlessSplatMat, this.seamlessClearMat, this.seamlessTransferMat,
      this.albedoAdjustMat]
    for (const m of mats) m.dispose()
    this.quad.geometry.dispose()
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  private readonly SPLAT_SQUARE = [
    new THREE.Vector4(0.0,  0.25, 0.8, 0),
    new THREE.Vector4(0.5,  0.25, 0.8, 0),
    new THREE.Vector4(0.25, 0.75, 0.8, 0),
    new THREE.Vector4(0.75, 0.75, 0.8, 0),
  ]
  private readonly SPLAT_WIDE = [
    new THREE.Vector4(0.0,   0.25, 0.5, 0), new THREE.Vector4(0.333, 0.25, 0.5, 0), new THREE.Vector4(0.666, 0.25, 0.5, 0),
    new THREE.Vector4(0.166, 0.75, 0.5, 0), new THREE.Vector4(0.5,   0.75, 0.5, 0), new THREE.Vector4(0.833, 0.75, 0.5, 0),
  ]
  private readonly SPLAT_TALL = [
    new THREE.Vector4(0.25, 0.0,   0.5, 0), new THREE.Vector4(0.25, 0.333, 0.5, 0), new THREE.Vector4(0.25, 0.666, 0.5, 0),
    new THREE.Vector4(0.75, 0.166, 0.5, 0), new THREE.Vector4(0.75, 0.5,   0.5, 0), new THREE.Vector4(0.75, 0.833, 0.5, 0),
  ]

  private getSplatKernel(aspect: number): THREE.Vector4[] {
    let base: THREE.Vector4[]
    if (aspect >= 1.5) {
      base = this.SPLAT_WIDE
    } else if (aspect <= 0.67) {
      base = this.SPLAT_TALL
    } else {
      base = this.SPLAT_SQUARE
    }
    return base.map(v => new THREE.Vector4(v.x, v.y, v.z, Math.random()))
  }

  generateSeamlessOverlap(
    inputTex: THREE.Texture, heightTex: THREE.Texture,
    params: Record<string, any>, w: number, h: number,
    isHeight: boolean, isNormal: boolean,
  ): THREE.WebGLRenderTarget {
    const u = this.seamlessOverlapMat.uniforms
    u._MainTex.value = inputTex
    u._HeightTex.value = heightTex
    u._Overlap.value.set(params.overlapX ?? 0.2, params.overlapY ?? 0.2)
    u._Falloff.value = params.falloff ?? 0.1
    u._IsHeight.value = isHeight ? 1.0 : 0.0
    u._IsNormal.value = isNormal ? 1.0 : 0.0
    u._FlipY.value = 0.0

    const output = this.pool.acquire(w, h)
    this.render(this.seamlessOverlapMat, output)
    return output
  }

  generateSeamlessSplat(
    inputTex: THREE.Texture, heightTex: THREE.Texture,
    params: Record<string, any>, w: number, h: number,
    isHeight: boolean, isNormal: boolean,
  ): THREE.WebGLRenderTarget {
    const aspect = w / h
    const kernel = this.getSplatKernel(aspect)

    const texW = (inputTex as any).image?.width ?? w
    const texH = (inputTex as any).image?.height ?? h
    const texARWidth = texW / texH
    const texARHeight = texH / texW
    const aspectRatio = new THREE.Vector2(
      texARWidth < texARHeight ? texARWidth : 1.0,
      texARWidth < texARHeight ? 1.0 : texARHeight,
    )
    const targetARWidth = w / h
    const targetARHeight = h / w
    const targetAspectRatio = new THREE.Vector2(
      targetARWidth < targetARHeight ? targetARWidth : 1.0,
      targetARWidth < targetARHeight ? 1.0 : targetARHeight,
    )

    const tmpA = this.pool.acquire(w, h)
    const tmpB = this.pool.acquire(w, h)

    this.render(this.seamlessClearMat, tmpA)
    this.render(this.seamlessClearMat, tmpB)

    const su = this.seamlessSplatMat.uniforms
    su._MainTex.value = inputTex
    su._HeightTex.value = heightTex
    su._SplatScale.value = params.splatScale ?? 1.0
    su._AspectRatio.value.copy(aspectRatio)
    su._TargetAspectRatio.value.copy(targetAspectRatio)
    su._SplatRotation.value = params.splatRotation ?? 0.0
    su._SplatRotationRandom.value = params.splatRotationRandom ?? 0.25
    su._Falloff.value = params.falloff ?? 0.1
    su._IsHeight.value = isHeight ? 1.0 : 0.0
    su._IsNormal.value = isNormal ? 1.0 : 0.0
    su._FlipY.value = 0.0

    for (let i = 0; i < kernel.length; i++) {
      const k = kernel[i]
      const seed = params.splatRandomize ?? 0.0
      const randomize = Math.sin((seed + 1.0 + i) * 472.361)
      const wobX = Math.sin((seed + 1.0 + i) * 128.352)
      const wobY = Math.cos((seed + 1.0 + i) * 243.767)

      su._SplatKernel.value.copy(k)
      su._SplatRandomize.value = randomize
      su._Wobble.value.set(wobX, wobY, params.splatWobble ?? 0.2)

      if (i % 2 === 0) {
        su._TargetTex.value = tmpB.texture
        this.render(this.seamlessSplatMat, tmpA)
      } else {
        su._TargetTex.value = tmpA.texture
        this.render(this.seamlessSplatMat, tmpB)
      }
    }

    const source = kernel.length % 2 === 0 ? tmpB : tmpA
    const output = this.pool.acquire(w, h)
    this.seamlessTransferMat.uniforms._MainTex.value = source.texture
    this.render(this.seamlessTransferMat, output)

    this.pool.release(tmpA)
    this.pool.release(tmpB)
    return output
  }
}
