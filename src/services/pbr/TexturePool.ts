import * as THREE from 'three'

export class TexturePool {
  private available: THREE.WebGLRenderTarget[] = []
  private named: Map<string, THREE.WebGLRenderTarget> = new Map()

  acquire(width: number, height: number, halfFloat: boolean = true): THREE.WebGLRenderTarget {
    const idx = this.available.findIndex(
      rt => rt.width === width && rt.height === height,
    )
    if (idx !== -1) {
      return this.available.splice(idx, 1)[0]
    }
    return new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
    })
  }

  release(rt: THREE.WebGLRenderTarget): void {
    this.available.push(rt)
  }

  getNamed(key: string): THREE.WebGLRenderTarget | null {
    return this.named.get(key) ?? null
  }

  setNamed(key: string, rt: THREE.WebGLRenderTarget): void {
    const old = this.named.get(key)
    if (old && old !== rt) {
      old.dispose()
    }
    this.named.set(key, rt)
  }

  deleteNamed(key: string): void {
    const rt = this.named.get(key)
    if (rt) {
      this.named.delete(key)
      rt.dispose()
    }
  }

  clearNamed(): void {
    for (const rt of this.named.values()) rt.dispose()
    this.named.clear()
  }

  getNames(): string[] {
    return [...this.named.keys()]
  }

  dispose(): void {
    for (const rt of this.available) rt.dispose()
    this.available.length = 0
    this.clearNamed()
  }
}
