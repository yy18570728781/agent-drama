import { resolve } from 'path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const DEFAULT_IMAGE_PROXY_ORIGIN = 'https://aigc-cos.teamones.cn'

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

function resolveImageProxyOrigins(trustedOrigins: string[]): ReadonlySet<string> {
  const candidates = [
    DEFAULT_IMAGE_PROXY_ORIGIN,
    ...trustedOrigins,
  ]
  return new Set(
    candidates
      .map((value) => normalizeOrigin(value.trim()))
      .filter((origin): origin is string => Boolean(origin)),
  )
}

function resolveAllowedImageUrl(value: string, allowedOrigins: ReadonlySet<string>): URL | null {
  try {
    const url = new URL(value)
    if (!allowedOrigins.has(url.origin) || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sidecarApiPort = env.VITE_SIDECAR_API_PORT || '8000'
  const apiProxyTarget = `http://127.0.0.1:${sidecarApiPort}`
  const imageProxyOrigins = resolveImageProxyOrigins([apiProxyTarget, env.VITE_TEAMONES_BASE_URL || ''])

  return {
    base: './',
    plugins: [vue(), tailwindcss()],
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.vue'],
      alias: {
        '@': resolve(__dirname, 'src'),
        'lucide-vue-next': resolve(__dirname, 'src/components/common/icon/lucide.ts'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 6174,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, 'http://localhost')
            url.searchParams.delete('_proxy_target')
            return `${url.pathname}${url.search}`
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (_proxyReq, req) => {
              delete req.headers['x-proxy-target']
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              const ct = proxyRes.headers['content-type'] as string | undefined
              if (ct?.includes('text/event-stream')) {
                req.setTimeout(0)
                proxyRes.setTimeout(0)
              }
            })
          },
        },
        '/__image-proxy': {
          target: DEFAULT_IMAGE_PROXY_ORIGIN,
          changeOrigin: true,
          configure: (proxy) => {
            const originalWeb = proxy.web.bind(proxy)
            proxy.web = (req, res, options) => {
              const method = String(req.method || 'GET').toUpperCase()
              if (method !== 'GET' && method !== 'HEAD') {
                res.statusCode = 405
                res.setHeader('Allow', 'GET, HEAD')
                res.end('Method not allowed')
                return
              }

              const url = new URL(req.url || '/', 'http://localhost')
              const targetUrl = url.searchParams.get('url')
              if (!targetUrl) {
                res.statusCode = 400
                res.end('Missing url')
                return
              }

              const parsed = resolveAllowedImageUrl(targetUrl, imageProxyOrigins)
              if (!parsed) {
                res.statusCode = 403
                res.end('Image origin is not allowed')
                return
              }
              req.url = `${parsed.pathname}${parsed.search}`
              return originalWeb(req, res, { ...options, target: parsed.origin })
            }
          },
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4174,
    },
  }
})
