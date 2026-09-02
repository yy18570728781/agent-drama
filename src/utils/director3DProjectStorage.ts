/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DirectingProject } from '@/components/director-3d/director3D.types';
import { safeJsonStringify } from '@/utils/director3DSerialization';

const DB_NAME = 'DIRECTOR_PROJECT_DB';
const STORE_NAME = 'projects';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

function nodeKey(nodeId: string): string {
  return `director_project_${nodeId}`;
}

export async function saveProjectToDB(nodeId: string, data: DirectingProject): Promise<void> {
  try {
    const serialized = safeJsonStringify(data);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(serialized, nodeKey(nodeId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveProjectToDB failed:', err);
  }
}

export async function loadProjectFromDB(nodeId: string): Promise<DirectingProject | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(nodeKey(nodeId));
      req.onsuccess = () => {
        const raw = req.result;
        if (!raw || typeof raw !== 'string') return resolve(null);
        try {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.mannequins) && Array.isArray(parsed.cameras)) {
            resolve(parsed);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('loadProjectFromDB failed:', err);
    return null;
  }
}

export async function clearProjectDB(nodeId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(nodeKey(nodeId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('clearProjectDB failed:', err);
  }
}
