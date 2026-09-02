export interface AmbientProgram {
  handle: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation>
}

export interface AmbientTarget {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
}

export interface AmbientGeometry {
  vertexArray: WebGLVertexArrayObject
  vertexBuffer: WebGLBuffer
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create discover ambient shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
  gl.deleteShader(shader)
  throw new Error(message)
}

/**
 * Compiles an ambient full-screen program and caches its active uniforms.
 * @param gl Active WebGL2 context.
 * @param vertexSource Full-screen vertex shader source.
 * @param fragmentSource Pass-specific fragment shader source.
 * @param uniformNames Uniforms used by the pass.
 * @returns Linked program and available uniform locations.
 */
export function createAmbientProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniformNames: readonly string[],
): AmbientProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const handle = gl.createProgram()
  if (!handle) throw new Error('Unable to create discover ambient program')
  gl.attachShader(handle, vertex)
  gl.attachShader(handle, fragment)
  gl.linkProgram(handle)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(handle) ?? 'Unknown shader link error'
    gl.deleteProgram(handle)
    throw new Error(message)
  }
  const uniforms: Record<string, WebGLUniformLocation> = {}
  uniformNames.forEach((name: string) => {
    const location = gl.getUniformLocation(handle, name)
    if (location !== null) uniforms[name] = location
  })
  return { handle, uniforms }
}

/**
 * Creates an RGBA render target whose storage is allocated during resize.
 * @param gl Active WebGL2 context.
 * @returns Texture and framebuffer pair.
 */
export function createAmbientTarget(gl: WebGL2RenderingContext): AmbientTarget {
  const texture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  if (!texture || !framebuffer) throw new Error('Unable to create ambient render target')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  return { texture, framebuffer }
}

/**
 * Allocates target storage and clears stale pixels after a size change.
 * @param gl Active WebGL2 context.
 * @param target Render target to allocate.
 * @param width Backing width in pixels.
 * @param height Backing height in pixels.
 */
export function allocateAmbientTarget(
  gl: WebGL2RenderingContext,
  target: AmbientTarget,
  width: number,
  height: number,
): void {
  gl.bindTexture(gl.TEXTURE_2D, target.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
  gl.viewport(0, 0, width, height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
}

/**
 * Binds a 2D texture to a predictable sampler unit for an ambient pass.
 * @param gl Active WebGL2 context.
 * @param unit Zero-based texture unit.
 * @param texture Texture consumed by the next draw.
 */
export function bindAmbientTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  texture: WebGLTexture,
): void {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
}

/**
 * Uploads an RGB color without allocating a temporary typed array.
 * @param gl Active WebGL2 context.
 * @param location Target uniform location.
 * @param color Normalized RGB tuple.
 */
export function setAmbientColor(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation,
  color: readonly number[],
): void {
  gl.uniform3f(location, color[0], color[1], color[2])
}

/**
 * Uploads a numbered color-stop palette shared by the water passes.
 * @param gl Active WebGL2 context.
 * @param program Program containing the palette uniforms.
 * @param colorPrefix Prefix used by numbered color uniforms.
 * @param stopPrefix Prefix used by numbered stop uniforms.
 * @param colors Normalized RGB palette entries.
 * @param stops Normalized palette stop positions.
 */
export function setAmbientPalette(
  gl: WebGL2RenderingContext,
  program: AmbientProgram,
  colorPrefix: string,
  stopPrefix: string,
  colors: readonly (readonly number[])[],
  stops: readonly number[],
): void {
  colors.forEach((color: readonly number[], index: number) => {
    setAmbientColor(gl, program.uniforms[`${colorPrefix}${index}`], color)
  })
  stops.forEach((stop: number, index: number) => {
    gl.uniform1f(program.uniforms[`${stopPrefix}${index}`], stop)
  })
}

/**
 * Creates the shared full-screen triangle geometry for every ambient pass.
 * @param gl Active WebGL2 context.
 * @returns Vertex array and its owned buffer.
 */
export function createAmbientGeometry(gl: WebGL2RenderingContext): AmbientGeometry {
  const vertexArray = gl.createVertexArray()
  const vertexBuffer = gl.createBuffer()
  if (!vertexArray || !vertexBuffer) throw new Error('Unable to create ambient geometry')
  gl.bindVertexArray(vertexArray)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  return { vertexArray, vertexBuffer }
}

/**
 * Releases a framebuffer and its attached texture.
 * @param gl Active WebGL2 context.
 * @param target Owned render target.
 */
export function disposeAmbientTarget(
  gl: WebGL2RenderingContext,
  target: AmbientTarget,
): void {
  gl.deleteFramebuffer(target.framebuffer)
  gl.deleteTexture(target.texture)
}
