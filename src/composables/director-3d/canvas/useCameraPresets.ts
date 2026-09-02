import { ref, computed, watchEffect, type ComputedRef } from 'vue';
import type { CameraConfig, Vector3D } from '@/components/director-3d/director3D.types';

export interface PresetOption<T extends string = string> {
  key: T;
  label: string;
  degrees: number;
}

export interface ShotSizeOption {
  key: ShotSizeKey;
  label: string;
  degrees: number;
  distance: number;
  fov: number;
}

export type HorizontalKey = 'front' | 'front-right' | 'right' | 'back-right' | 'back' | 'back-left' | 'left' | 'front-left';
export type VerticalKey = 'low-angle' | 'eye-level' | 'elevated' | 'high-angle';
export type ShotSizeKey = 'wide' | 'medium' | 'close-up';

export const HORIZONTAL_ANGLES: PresetOption<HorizontalKey>[] = [
  { key: 'front', label: '正前方', degrees: 0 },
  { key: 'front-right', label: '右前方', degrees: 45 },
  { key: 'right', label: '右侧方', degrees: 90 },
  { key: 'back-right', label: '右后方', degrees: 135 },
  { key: 'back', label: '正后方', degrees: 180 },
  { key: 'back-left', label: '左后方', degrees: 225 },
  { key: 'left', label: '左侧方', degrees: 270 },
  { key: 'front-left', label: '左前方', degrees: 315 },
];

export const VERTICAL_ANGLES: PresetOption<VerticalKey>[] = [
  { key: 'low-angle', label: '低角度', degrees: -20 },
  { key: 'eye-level', label: '平视', degrees: 0 },
  { key: 'elevated', label: '俯角', degrees: 25 },
  { key: 'high-angle', label: '高俯角', degrees: 45 },
];

export const SHOT_SIZES: ShotSizeOption[] = [
  { key: 'wide', label: '远景', degrees: 0, distance: 8, fov: 42 },
  { key: 'medium', label: '中景', degrees: 0, distance: 4, fov: 50 },
  { key: 'close-up', label: '特写', degrees: 0, distance: 1.5, fov: 65 },
];

const DEG_TO_RAD = Math.PI / 180;

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function findNearestPreset<T extends string>(
  angle: number,
  presets: PresetOption<T>[],
): T {
  const norm = normalizeAngle(angle);
  let best = presets[0].key;
  let bestDiff = Infinity;
  for (const p of presets) {
    const pNorm = normalizeAngle(p.degrees);
    let diff = Math.abs(norm - pNorm);
    if (diff > 180) diff = 360 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p.key;
    }
  }
  return best;
}

function findNearestByValue<T extends string>(
  value: number,
  presets: { key: T; value: number }[],
): T {
  let best = presets[0].key;
  let bestDiff = Infinity;
  for (const p of presets) {
    const diff = Math.abs(value - p.value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p.key;
    }
  }
  return best;
}

export function computePosition(
  hKey: HorizontalKey,
  vKey: VerticalKey,
  shotKey: ShotSizeKey,
  target: Vector3D,
): { position: Vector3D; fov: number } {
  const hOpt = HORIZONTAL_ANGLES.find(h => h.key === hKey)!;
  const vOpt = VERTICAL_ANGLES.find(v => v.key === vKey)!;
  const shot = SHOT_SIZES.find(s => s.key === shotKey)!;

  const hRad = hOpt.degrees * DEG_TO_RAD;
  const vRad = vOpt.degrees * DEG_TO_RAD;
  const dist = shot.distance;

  const horizDist = dist * Math.cos(vRad);
  const dy = dist * Math.sin(vRad);
  const dx = horizDist * Math.sin(hRad);
  const dz = horizDist * Math.cos(hRad);

  return {
    position: {
      x: parseFloat((target.x + dx).toFixed(3)),
      y: parseFloat((target.y + dy).toFixed(3)),
      z: parseFloat((target.z + dz).toFixed(3)),
    },
    fov: shot.fov,
  };
}

export function inferPreset(position: Vector3D, target: Vector3D) {
  const dx = position.x - target.x;
  const dy = position.y - target.y;
  const dz = position.z - target.z;
  const horizDist = Math.sqrt(dx * dx + dz * dz);

  const hAngle = normalizeAngle(Math.atan2(dx, dz) / DEG_TO_RAD);
  const vAngle = Math.atan2(dy, horizDist) / DEG_TO_RAD;

  const hKey = findNearestPreset(hAngle, HORIZONTAL_ANGLES);
  const vKey = findNearestByValue(vAngle, VERTICAL_ANGLES.map((v): { key: VerticalKey; value: number } => ({ key: v.key, value: v.degrees })));
  const fullDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const shotKey = findNearestByValue(fullDist, SHOT_SIZES.map((s): { key: ShotSizeKey; value: number } => ({ key: s.key, value: s.distance })));

  return { hKey, vKey, shotKey };
}

function focalLengthFromFov(fov: number): number {
  return parseFloat((12 / Math.tan((fov / 2) * DEG_TO_RAD)).toFixed(1));
}

export function useCameraPresets(camera: ComputedRef<CameraConfig | null>) {
  const selectedH = ref<HorizontalKey>('front');
  const selectedV = ref<VerticalKey>('eye-level');
  const selectedShot = ref<ShotSizeKey>('wide');

  const isMatched = ref(false);

  watchEffect(() => {
    const cam = camera.value;
    if (!cam) return;
    const { hKey, vKey, shotKey } = inferPreset(cam.position, cam.target);
    selectedH.value = hKey;
    selectedV.value = vKey;
    selectedShot.value = shotKey;

    const computed = computePosition(hKey, vKey, shotKey, cam.target);
    const posMatch =
      Math.abs(computed.position.x - cam.position.x) < 0.05 &&
      Math.abs(computed.position.y - cam.position.y) < 0.05 &&
      Math.abs(computed.position.z - cam.position.z) < 0.05;
    const fovMatch = Math.abs(computed.fov - cam.fov) < 1;
    isMatched.value = posMatch && fovMatch;
  });

  function apply(): Partial<CameraConfig> | null {
    const cam = camera.value;
    if (!cam) return null;
    const result = computePosition(selectedH.value, selectedV.value, selectedShot.value, cam.target);
    return {
      position: result.position,
      fov: result.fov,
      focalLength: focalLengthFromFov(result.fov),
    };
  }

  return {
    selectedH,
    selectedV,
    selectedShot,
    isMatched,
    apply,
  };
}
