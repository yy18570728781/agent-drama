import { ref, onUnmounted } from 'vue'

export function useSSE(url: string) {
  const data = ref<any>(null)
  const error = ref<string | null>(null)
  const isConnected = ref(false)
  let source: EventSource | null = null

  function connect() {
    if (source) source.close()

    source = new EventSource(url)
    isConnected.value = true

    source.onmessage = (event) => {
      try {
        data.value = JSON.parse(event.data)
      } catch {
        data.value = event.data
      }
    }

    source.addEventListener('generation_progress', (event: MessageEvent) => {
      try {
        data.value = { type: 'progress', ...JSON.parse(event.data) }
      } catch {
        data.value = { type: 'progress', raw: event.data }
      }
    })

    source.addEventListener('generation_complete', (event: MessageEvent) => {
      try {
        data.value = { type: 'complete', ...JSON.parse(event.data) }
      } catch {
        data.value = { type: 'complete', raw: event.data }
      }
    })

    source.onerror = () => {
      error.value = 'SSE connection error'
      isConnected.value = false
    }
  }

  function disconnect() {
    source?.close()
    source = null
    isConnected.value = false
  }

  onUnmounted(disconnect)

  return { data, error, isConnected, connect, disconnect }
}
