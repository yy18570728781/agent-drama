import client from './client'

function unwrapResponse<T = any>(response: any): T {
  return response?.data?.data ?? response?.data ?? response
}

export async function getChannelsConfig(): Promise<any> {
  const response = await client.get('/api/channels')
  const payload = unwrapResponse<any>(response) || {}
  return payload.config ? payload : { config: payload }
}

export async function updateChannelConfig(channelName: string, config: any): Promise<any> {
  const response = await client.put(`/api/channels/${channelName}`, config)
  return unwrapResponse(response)
}

export async function getChannelsStatus(): Promise<any> {
  const response = await client.get('/api/channels/status')
  const payload = unwrapResponse<any>(response) || {}
  return payload.channels ? payload : { channels: payload }
}

export async function listWebhooks(): Promise<any> {
  const response = await client.get('/api/channels/webhooks')
  const payload = unwrapResponse<any>(response) || {}
  return payload.webhooks ? payload : { webhooks: payload }
}

export async function createWebhook(webhook: any): Promise<any> {
  const response = await client.post('/api/channels/webhooks', webhook)
  return unwrapResponse(response)
}

export async function updateWebhook(id: string, webhook: any): Promise<any> {
  const response = await client.put(`/api/channels/webhooks/${id}`, webhook)
  return unwrapResponse(response)
}

export async function deleteWebhook(id: string): Promise<any> {
  const response = await client.delete(`/api/channels/webhooks/${id}`)
  return unwrapResponse(response)
}