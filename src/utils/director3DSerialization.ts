/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust JSON serialization helper that safely avoids cycle/DOM/React references.
 * Essential to keep React and internal canvas structures from throwing errors when serializing.
 */
export const safeJsonStringify = (obj: any): string => {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      // Primitive types
      if (typeof value !== 'object' || value === null) {
        if (typeof value === 'function') return undefined; // omit functions
        return value;
      }

      // Cycle detection
      if (seen.has(value)) {
        return undefined;
      }
      
      // Node and Framework/ThreeJS class instances filtering
      try {
        if (
          value instanceof HTMLElement ||
          (typeof value.nodeType === 'number' && typeof value.nodeName === 'string') || // DOM Node check
          (typeof value.tagName === 'string') ||
          value === window ||
          (typeof window !== 'undefined' && value === window.parent) ||
          value.$$typeof || 
          value._reactName ||
          value._reactWorkInProgress ||
          value.stateNode ||
          value.updater
        ) {
          return undefined; // Strips all DOM/React elements
        }

        const constructorName = value.constructor?.name || '';
        if (
          constructorName.includes('WebGL') ||
          constructorName.includes('Renderer') ||
          constructorName.includes('Context') ||
          constructorName.includes('Canvas') ||
          constructorName.includes('Element') ||
          constructorName.includes('Fiber') ||
          constructorName.startsWith('THREE') ||
          value.isWebGLRenderer ||
          value.isScene ||
          value.isCamera ||
          value.isLight ||
          value.isMesh ||
          value.isObject3D ||
          value.isTexture ||
          value.isMaterial ||
          value.isBufferGeometry
        ) {
          return undefined; // Strips heavy objects
        }
      } catch (e) {
        // Ignore cross-origin access errors etc
        return undefined;
      }

      // Skip internal keys to prevent deep recursion
      if (
        key.startsWith('__react') ||
        key.startsWith('_react') ||
        key.startsWith('_') ||
        key === 'stateNode' ||
        key === 'renderer' ||
        key === 'canvas' ||
        key === 'domElement'
      ) {
        return undefined;
      }

      // Safe to traverse
      seen.add(value);
      return value;
    });
  } catch (err) {
    console.warn('React state safety serialization failed. Ignoring.');
    return '{}';
  }
};
