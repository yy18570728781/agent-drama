import * as THREE from 'three';
import type { DirectingProject } from '@/components/director-3d/director3D.types';

export interface NameTagDeps {
  scene: THREE.Scene;
  mannequinMeshes: Map<string, THREE.Group>;
}

export function createNameTagCanvas(name: string, hasGroup: boolean): HTMLCanvasElement {
  const fontSize = 18;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const groupTag = hasGroup ? '  阵组成员' : '';
  const text = name + groupTag;
  const textWidth = ctx.measureText(text).width;

  const padX = 16;
  const padY = 8;
  const dotR = 4;
  const canvasW = Math.ceil(textWidth + padX * 2 + dotR * 2 + 6);
  const canvasH = fontSize + padY * 2;

  canvas.width = canvasW * 2;
  canvas.height = canvasH * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvasW, canvasH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  let drawX = padX;
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.arc(drawX + dotR, canvasH / 2, dotR, 0, Math.PI * 2);
  ctx.fill();
  drawX += dotR * 2 + 6;

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textBaseline = 'middle';

  if (hasGroup) {
    const nameWidth = ctx.measureText(name).width;
    ctx.fillText(name, drawX, canvasH / 2);
    const tagX = drawX + nameWidth + 4;
    ctx.font = `${fontSize * 0.75}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const tagW = ctx.measureText('阵组成员').width + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(tagX, canvasH / 2 - fontSize * 0.35, tagW, fontSize * 0.7, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('阵组成员', tagX + 4, canvasH / 2);
  } else {
    ctx.fillText(name, drawX, canvasH / 2);
  }

  return canvas;
}

export function syncNameTags(
  project: DirectingProject,
  nameTagSprites: Map<string, THREE.Sprite>,
  deps: NameTagDeps,
): void {
  if (!deps.scene) return;

  project.mannequins.forEach((m) => {
    const showLabel = m.showLabel !== undefined ? !!m.showLabel : (m.groupId ? !!project.showCrowdLabels : false);
    let sprite = nameTagSprites.get(m.id);
    const lastName = sprite?.userData?.lastName as string | undefined;
    const lastGroup = sprite?.userData?.lastGroup as boolean | undefined;
    const nameChanged = !sprite || lastName !== m.name || lastGroup !== !!m.groupId;

    if (nameChanged) {
      if (sprite) {
        deps.scene.remove(sprite);
        (sprite.material as THREE.SpriteMaterial).map?.dispose();
        (sprite.material as THREE.SpriteMaterial).dispose();
      }
      const canvas = createNameTagCanvas(m.name || '', !!m.groupId);
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
      sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 999;
      sprite.userData = { id: m.id, type: 'nameTag', lastName: m.name, lastGroup: !!m.groupId };
      nameTagSprites.set(m.id, sprite);
      deps.scene.add(sprite);
    }

    if (!m.visible || !showLabel) {
      sprite!.visible = false;
      return;
    }

    const mGroup = deps.mannequinMeshes.get(m.id);
    if (!mGroup) { sprite!.visible = false; return; }

    const tagBaseObj = mGroup.getObjectByName('head_rig_controller') || mGroup.getObjectByName('head') || mGroup;
    const worldPos = new THREE.Vector3();
    tagBaseObj.getWorldPosition(worldPos);
    worldPos.y += 0.25 * (m.scale?.x || 1);

    const map = (sprite!.material as THREE.SpriteMaterial).map!;
    const img = map.image as HTMLCanvasElement;
    const aspect = img.width / img.height;
    const baseHeight = 0.15 * (m.scale?.x || 1);
    sprite!.scale.set(baseHeight * aspect, baseHeight, 1);
    sprite!.position.copy(worldPos);
    sprite!.visible = true;
  });

  nameTagSprites.forEach((sprite, id) => {
    if (!project.mannequins.some(m => m.id === id)) {
      deps.scene.remove(sprite);
      (sprite.material as THREE.SpriteMaterial).map?.dispose();
      (sprite.material as THREE.SpriteMaterial).dispose();
      nameTagSprites.delete(id);
    }
  });
}

export function disposeNameTags(nameTagSprites: Map<string, THREE.Sprite>): void {
  nameTagSprites.forEach(sprite => {
    (sprite.material as THREE.SpriteMaterial).map?.dispose();
    (sprite.material as THREE.SpriteMaterial).dispose();
  });
  nameTagSprites.clear();
}
