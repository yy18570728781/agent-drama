import { getStoredAuthScope } from './tokenStorage'

export type StoredWorkflowVersion = {
  id: string
  ownerKey: string
  workflowId: string
  revision: number
  definition: Record<string, unknown>
  label?: string
  published?: boolean
  createdAt: string
  teamones_canvas?: { asset_id?: number | string }
}

const DATABASE_NAME = 'infinite_canvas-local'
const STORE_NAME = 'workflow-versions'
const DATABASE_VERSION = 1

function currentOwnerKey(): string {
  const scope = getStoredAuthScope()
  return `${scope?.tenantId || 'anonymous'}:${scope?.userId || 'anonymous'}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('workflowId', 'workflowId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
  })
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    operation(transaction.objectStore(STORE_NAME), resolve, reject)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function listLocalVersions(workflowId: string): Promise<StoredWorkflowVersion[]> {
  return transact('readonly', (store, resolve, reject) => {
    const ownerKey = currentOwnerKey()
    const request = store.index('workflowId').getAll(workflowId)
    request.onsuccess = () => resolve((request.result as StoredWorkflowVersion[])
      .filter((item) => item.ownerKey === ownerKey)
      .sort((left, right) => right.revision - left.revision))
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocalVersion(
  workflowId: string,
  definition: Record<string, unknown>,
  label?: string,
): Promise<StoredWorkflowVersion> {
  const previous = await listLocalVersions(workflowId)
  const revision = (previous[0]?.revision || 0) + 1
  const ownerKey = currentOwnerKey()
  const value: StoredWorkflowVersion = {
    id: `${ownerKey}:${workflowId}:${revision}`,
    ownerKey,
    workflowId,
    revision,
    definition,
    label,
    createdAt: new Date().toISOString(),
  }
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.put(value)
    request.onsuccess = () => resolve(value)
    request.onerror = () => reject(request.error)
  })
}

export async function publishLocalVersion(workflowId: string, revision: number): Promise<StoredWorkflowVersion | null> {
  const versions = await listLocalVersions(workflowId)
  const selected = versions.find((item) => item.revision === revision)
  if (!selected) return null
  await Promise.all(versions.map((item) => transact<void>('readwrite', (store, resolve, reject) => {
    const request = store.put({ ...item, published: item.revision === revision })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })))
  return { ...selected, published: true }
}

export async function getPublishedLocalVersion(workflowId: string): Promise<StoredWorkflowVersion | null> {
  return (await listLocalVersions(workflowId)).find((item) => item.published) || null
}
