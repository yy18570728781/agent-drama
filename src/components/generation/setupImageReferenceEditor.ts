import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import {
  Image, X, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2,
  Sun, Contrast, Droplets, Pencil, Type, ArrowRight, Circle,
  Square, Eraser, MousePointer, Undo2, Redo2, Scissors, Crop, Pipette, ChevronLeft, ChevronRight,
  LayoutGrid, Minimize2
} from '@/components/common/icon/lucide';
import { ElMessage, ElMessageBox } from 'element-plus';
import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/monolith.min.css';
import { useImageReferenceHistory } from './useImageReferenceHistory';
import { useImageExpandTool } from './useImageExpandTool';
import { useImageReferenceCompressWorkbench } from './useImageReferenceCompressWorkbench';
import { useSplitTool } from './useSplitTool';
import { IMAGE_EXPAND_RATIOS } from './imageExpand.constants';
import { useLoadingState } from '@/composables/useLoadingState';
import { editorKeyHandler } from '@/composables/flow/useFlowCore';
import { useAssetDragOut, type AssetDragPayload } from '@/composables/assets/useAssetDragOut';

import { useTextBoxOverlay } from '@/composables/useTextBoxOverlay';
import type { TextBoxCorner } from '@/composables/useTextBoxOverlay';

export function setupImageReferenceEditor(props: any, { emit }: any) {
// Canvas refs
const overlayRef = ref<HTMLElement | null>(null);
const editCanvasRef = ref<HTMLCanvasElement | null>(null);
const drawLayerRef = ref<HTMLCanvasElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const cursorCanvasRef = ref<HTMLCanvasElement | null>(null);
const textInputRef = ref<HTMLElement | null>(null);

// Color picker refs
const colorPickerEl = ref<HTMLElement | null>(null);
const expandColorPickerEl = ref<HTMLElement | null>(null);
let _pickr: Pickr | null = null;
let _expandPickr: Pickr | null = null;

// Image editing state
let _editOriginalImage: HTMLImageElement | null = null;
let _editRotation = 0;
let _editFlipH = false;
let _editFlipV = false;

const editImageInfo = ref({ width: 0, height: 0 });
const editFileSizeText = computed(() => formatFileSize(props.imageFile?.size || 0));
const imgAdjust = ref({ brightness: 0, contrast: 0, saturation: 0 });
const activeCropRatio = ref('');

// Crop ratios
const cropRatios = IMAGE_EXPAND_RATIOS;

// Crop state
const cropRect = ref({ x: 0, y: 0, w: 0, h: 0 });
let _cropDragHandle = '';
const cropHoverHandle = ref('');
let _cropDragStart = { mx: 0, my: 0, rx: 0, ry: 0, rw: 0, rh: 0 };

// DrawElement model
interface DrawElement {
  id: string
  type: 'stroke' | 'arrow' | 'circle' | 'rect' | 'text' | 'eraser'
  color: string
  size: number
  opacity: number
  offsetX: number
  offsetY: number
  points?: { x: number; y: number; pressure?: number }[]
  startX?: number
  startY?: number
  endX?: number
  endY?: number
 text?: string
 textX?: number
 textY?: number
 fontSize?: number
  width?: number
  height?: number
  backgroundColor?: string
  showBackground?: boolean
}

// Drawing tools
type DrawTool = 'select' | 'pencil' | 'arrow' | 'text' | 'circle' | 'rect' | 'eraser' | 'eyedropper' | 'expand' | 'crop' | 'split' | 'compress';
const drawTool = ref<DrawTool>('select');
const drawColor = ref('#ff3b30');
const drawSize = ref(4);
const drawOpacity = ref(100);
const pressureEnabled = ref(false);
const compressWorkbench = useImageReferenceCompressWorkbench({
  imageFile: computed(() => props.imageFile),
  imageInfo: editImageInfo,
  bgCanvas: editCanvasRef,
  drawCanvas: drawLayerRef,
});

function getPressure(e: PointerEvent): number {
  if (!pressureEnabled.value) return 1;
  if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure;
  return 0.5;
}

type EditorSnapshot = {
  width: number
  height: number
  imageData: ImageData
  elements: DrawElement[]
  rotation: number
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  saturation: number
}
const drawHistory = ref<EditorSnapshot[]>([]);
const drawFuture = ref<EditorSnapshot[]>([]);
const textInput = ref({
  visible: false,
  x: 0,
  y: 0,
  value: '',
  canvasX: 0,
  canvasY: 0,
  fontSize: 24,
  width: 160,
  height: 60,
  backgroundColor: 'rgba(99, 102, 241, 0.85)',
  color: '#ffffff',
  editingElementId: null as string | null,
});
const textColorOpacity = ref(100);
const textBgOpacity = ref(85);
const textShowBackground = ref(false);
const isDirty = ref(false);
let _drawing = false;
let _drawStart = { x: 0, y: 0 };
let _lastPoint = { x: 0, y: 0 };
let _pointerTracking = false;
let _spacePanning = false;
let _cachedCanvasRect: DOMRect | null = null;
let _cachedScaleX = 1;
let _cachedScaleY = 1;
let _cachedWrapRect: DOMRect | null = null;
let _drawRafId: number | null = null;
let _lastRenderedPointCount = 0;
let _cursorRafId: number | null = null;
let _pendingCursorPos: { x: number; y: number } | null = null;

// Draw element state
const drawElements = ref<DrawElement[]>([]);
let _elementIdCounter = 0;
const activeElementId = ref<string | null>(null);
let _currentDrawingId: string | null = null;
let _elementDragging = false;
let _elementDragStart = { x: 0, y: 0 };
let _elementDragInitOffset = { x: 0, y: 0 };

// 拖出窗口外（仅 select 工具，靠边界判定）
let _dragOutArmed = false;
let _dragOutTriggered = false;
let _dragOutWrapRect: DOMRect | null = null;
let _dragOutElementRestore: { id: string; offsetX: number; offsetY: number } | null = null;
let _editedDragPrepareToken = 0;
let _editedDragPayload: AssetDragPayload | null = null;
let _editedDragPreparePromise: Promise<AssetDragPayload | null> | null = null;
const {
  prepare: prepareAssetDragOut,
  startDrag: startAssetDragOut,
  endDrag: endAssetDragOut,
  triggerExternal: triggerAssetDragOut,
} = useAssetDragOut();

// Canvas zoom and pan
const canvasZoom = ref(1);
const canvasPan = ref({ x: 0, y: 0 });
const brushCursorPos = ref({ x: -100, y: -100 });
const canvasDisplayScale = ref(1);

function updateCanvasDisplayScale(): void {
  const canvas = editCanvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0 && canvas.width > 0) {
    canvasDisplayScale.value = rect.width / canvas.width;
  }
}

const brushCursorStyle = computed(() => {
  const size = Math.max(drawSize.value * canvasDisplayScale.value, 4);
  return {
    left: brushCursorPos.value.x - size / 2 + 'px',
    top: brushCursorPos.value.y - size / 2 + 'px',
    width: size + 'px',
    height: size + 'px',
  };
});
const showBrushProps = computed(() =>
  ['pencil', 'eraser', 'arrow', 'circle', 'rect'].includes(drawTool.value)
);
const canvasZoomStyle = computed(() => ({
  transform: `translate(${canvasPan.value.x}px, ${canvasPan.value.y}px) scale(${canvasZoom.value})`,
  transformOrigin: 'center center',
}));
const {
  textResizing,
  textMoving,
  autoFitHeight,
  onCornerPointerDown,
  onEdgePointerDown,
} = useTextBoxOverlay({ textInput, textInputRef, editCanvasRef, canvasZoom });

/** 根据文字内容自动扩宽（display 像素），最小保留拖拽设置的宽度 */
function autoFitWidth(): void {
  const ta = textInputRef.value;
  if (!ta || !textInput.value.visible) return;
  // 用不可见 span 测量文本实际宽度
  const span = document.createElement('span');
  span.style.font = `${textInput.value.fontSize}px sans-serif`;
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre';
  span.style.padding = '0';
  span.textContent = textInput.value.value || ' ';
  document.body.appendChild(span);
  const padding = Math.max(20, textInput.value.fontSize * 0.6);
  const minW = Math.max(120, textInput.value.fontSize * 2);
  textInput.value.width = Math.max(minW, span.offsetWidth + padding);
  document.body.removeChild(span);
}

/** contenteditable @input 回调：同步 innerText 到状态并重新自适应 */
function onTextInputInput(e: Event): void {
  const el = e.target as HTMLElement;
  textInput.value.value = el.innerText;
  autoFitHeight();
  autoFitWidth();
}

// selected element corner-resize state
let _elementResizeCorner: TextBoxCorner | '' = '';
let _resizeInit = { textX: 0, textY: 0, width: 0, height: 0, fontSize: 24 };
let _panning = false;
let _panStart = { x: 0, y: 0 };
let _panInit = { x: 0, y: 0 };

let _prevDrawTool: DrawTool | null = null;

const toolsCollapsed = ref(false);
const expandRatios = IMAGE_EXPAND_RATIOS;

// Draw tools configuration
const drawTools: { id: DrawTool; icon: any; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer, label: '选择/移动', shortcut: 'V' },
  { id: 'pencil', icon: Pencil, label: '画笔', shortcut: 'B' },
  { id: 'eraser', icon: Eraser, label: '橡皮', shortcut: 'E' },
  { id: 'eyedropper', icon: Pipette, label: '吸色', shortcut: 'I' },
  { id: 'arrow', icon: ArrowRight, label: '箭头', shortcut: 'U' },
  { id: 'text', icon: Type, label: '文字', shortcut: 'T' },
  { id: 'circle', icon: Circle, label: '圆形', shortcut: 'O' },
  { id: 'rect', icon: Square, label: '矩形', shortcut: 'R' },
  { id: 'crop', icon: Scissors, label: '裁剪', shortcut: 'C' },
  { id: 'expand', icon: Crop, label: '扩图', shortcut: 'X' },
  { id: 'split', icon: LayoutGrid, label: '宫格拆分', shortcut: 'S' },
  { id: 'compress', icon: Minimize2, label: '压缩', shortcut: 'M' },
];

// Canvas cursor
const canvasCursor = computed(() => {
  if (drawTool.value === 'expand') return expandCursor.value;
  if (drawTool.value === 'crop') return resolveCropCursor(cropHoverHandle.value);
  if (drawTool.value === 'select') return 'default';
  if (drawTool.value === 'split') return splitCursor.value;
  if (drawTool.value === 'compress') return 'default';
  const map: Record<string, string> = {
    pencil: 'none', arrow: 'crosshair',
    text: 'text', circle: 'crosshair', rect: 'crosshair', eraser: 'none',
    eyedropper: 'crosshair',
  };
  return map[drawTool.value] || 'crosshair';
});

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ====== Color picker init ======
function initColorPicker() {
  if (!colorPickerEl.value) return;
  _pickr = Pickr.create({
    el: colorPickerEl.value,
    theme: 'monolith',
    useAsButton: true,
    position: 'bottom-start',
    default: drawColor.value,
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: { hex: true, input: true, save: true },
    },
  });
  _pickr.on('change', (color: any) => {
    drawColor.value = color.toHEXA().toString();
  });
  _pickr.on('save', (color: any) => {
    if (color) drawColor.value = color.toHEXA().toString();
  });
}

function initExpandColorPicker() {
  if (!expandColorPickerEl.value) return;
  _expandPickr = Pickr.create({
    el: expandColorPickerEl.value,
    theme: 'nano',
    useAsButton: true,
    default: expandColor.value,
    components: {
      preview: false,
      opacity: false,
      hue: true,
      interaction: { hex: true, input: true, save: true },
    },
  });
  _expandPickr.on('save', (color: any) => {
    if (color) {
      expandColor.value = color.toHEXA().toString();
      renderExpandOverlay();
    }
  });
}

// ====== Render pipeline ======
const { loading: editorImageLoading, start: startEditorImageLoading, stop: stopEditorImageLoading } = useLoadingState(true);

async function loadImageToCanvas() {
  const rawUrl = String(props.imageUrl || '');

  startEditorImageLoading();
  const loadImage = (withCors: boolean) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = document.createElement('img') as HTMLImageElement;
    if (withCors) img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = rawUrl;
  });

  let img: HTMLImageElement;
  try {
    img = await loadImage(true);
  } catch {
    try {
      img = await loadImage(false);
    } catch {
      stopEditorImageLoading();
      throw new Error('Failed to load image');
    }
  }

  _editOriginalImage = img;
  editImageInfo.value = { width: img.naturalWidth, height: img.naturalHeight };
  renderImageToCanvas();
  stopEditorImageLoading();
}

const MAX_EDIT_CANVAS_SIZE = 2048;

function renderImageToCanvas() {
  const img = _editOriginalImage;
  const canvas = editCanvasRef.value;
  if (!img || !canvas) return;

  const rot = ((_editRotation % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  let w = swapped ? img.naturalHeight : img.naturalWidth;
  let h = swapped ? img.naturalWidth : img.naturalHeight;

  const maxDim = Math.max(w, h);
  if (maxDim > MAX_EDIT_CANVAS_SIZE) {
    const scale = MAX_EDIT_CANVAS_SIZE / maxDim;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(_editFlipH ? -1 : 1, _editFlipV ? -1 : 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  applyCanvasFilters(ctx, w, h);
  syncAllLayers();
  nextTick(() => updateCanvasDisplayScale());
}

function applyCanvasFilters(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { brightness, contrast, saturation } = imgAdjust.value;
  if (brightness === 0 && contrast === 0 && saturation === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const bF = brightness / 100;
  const cF = (contrast + 100) / 100;
  const sF = (saturation + 100) / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    r = Math.min(255, Math.max(0, r + bF * 255));
    g = Math.min(255, Math.max(0, g + bF * 255));
    b = Math.min(255, Math.max(0, b + bF * 255));
    r = Math.min(255, Math.max(0, (r - 128) * cF + 128));
    g = Math.min(255, Math.max(0, (g - 128) * cF + 128));
    b = Math.min(255, Math.max(0, (b - 128) * cF + 128));
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = Math.min(255, Math.max(0, gray + sF * (r - gray)));
    d[i + 1] = Math.min(255, Math.max(0, gray + sF * (g - gray)));
    d[i + 2] = Math.min(255, Math.max(0, gray + sF * (b - gray)));
  }

  ctx.putImageData(imageData, 0, 0);
}

function syncAllLayers() {
  syncDrawLayerSize();
  renderDrawLayer();
  syncCursorLayerSize();
  syncOverlay();
}

function syncCursorLayerSize() {
  const canvas = editCanvasRef.value;
  const cursor = cursorCanvasRef.value;
  if (!canvas || !cursor) return;
  cursor.width = canvas.width;
  cursor.height = canvas.height;
}

function syncOverlay() {
  const canvas = editCanvasRef.value;
  const overlay = overlayCanvasRef.value;
  if (!canvas || !overlay) return;
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  editImageInfo.value = { width: canvas.width, height: canvas.height };
  if (drawTool.value === 'crop') renderCropOverlay();
  if (drawTool.value === 'expand') renderExpandOverlay();
  if (drawTool.value === 'split' && splitConfig.value) renderSplitOverlay();
}

function syncDrawLayerSize() {
  const canvas = editCanvasRef.value;
  const dl = drawLayerRef.value;
  if (!canvas || !dl) return;
  dl.width = canvas.width;
  dl.height = canvas.height;
}

function clearBrushCursor() {
  brushCursorPos.value = { x: -100, y: -100 };
}

function clearOverlay() {
  const overlay = overlayCanvasRef.value;
  if (!overlay) return;
  const ctx = overlay.getContext('2d')!;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
}

function hasPressure(pts: { pressure?: number }[] | undefined): boolean {
  return !!(pts && pts.length > 0 && pts.some(p => p.pressure !== undefined));
}

function drawVariableWidthStroke(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number; pressure?: number }[],
  baseSize: number,
): void {
  if (pts.length < 2) return;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const avgPr = ((p0.pressure ?? 0.5) + (p1.pressure ?? 0.5)) / 2;
    ctx.lineWidth = Math.max(baseSize * avgPr, 0.5);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
}

// ====== DrawElement rendering ======

function appendLastStrokeSegment(el: DrawElement): void {
  const canvas = drawLayerRef.value;
  if (!canvas || !el.points || el.points.length < 2) return;
  const ctx = canvas.getContext('2d')!;
  const pts = el.points;
  const prev = pts[pts.length - 2];
  const curr = pts[pts.length - 1];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(el.offsetX, el.offsetY);

  if (el.type === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = el.size * (curr.pressure ?? 1);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  } else {
    ctx.globalAlpha = el.opacity / 100;
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
  ctx.restore();
}

function flushPendingStrokes(): void {
  _drawRafId = null;
  if (!_currentDrawingId) return;
  const el = drawElements.value.find(e => e.id === _currentDrawingId);
  if (!el?.points) return;
  const canvas = drawLayerRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const startIdx = Math.max(1, _lastRenderedPointCount);
  for (let i = startIdx; i < el.points.length; i++) {
    const prev = el.points[i - 1];
    const curr = el.points[i];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(el.offsetX, el.offsetY);
    if (el.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = el.size * (curr.pressure ?? 1);
    } else {
      ctx.globalAlpha = el.opacity / 100;
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.size;
    }
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.restore();
  }
  _lastRenderedPointCount = el.points.length;
}

function renderDrawLayer() {
  const canvas = drawLayerRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const el of drawElements.value) {
    ctx.save();
    ctx.globalAlpha = el.opacity / 100;
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.translate(el.offsetX, el.offsetY);

    switch (el.type) {
      case 'stroke': {
        if (!el.points || el.points.length < 2) break;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (hasPressure(el.points)) {
          drawVariableWidthStroke(ctx, el.points, el.size);
        } else {
          ctx.lineWidth = el.size;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
        break;
      }
      case 'eraser': {
        if (!el.points || el.points.length === 0) break;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (el.points.length === 1) {
          const r = el.size / 2 * (el.points[0].pressure ?? 1);
          ctx.beginPath();
          ctx.arc(el.points[0].x, el.points[0].y, Math.max(r, 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else if (hasPressure(el.points)) {
          drawVariableWidthStroke(ctx, el.points, el.size);
        } else {
          ctx.lineWidth = el.size;
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'arrow': {
        drawArrowHelper(ctx, el.startX!, el.startY!, el.endX!, el.endY!, el.size);
        break;
      }
      case 'circle': {
        const r = normalizeRect(el.startX!, el.startY!, el.endX!, el.endY!);
        ctx.beginPath();
        ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w / 2, 1), Math.max(r.h / 2, 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'rect': {
        ctx.strokeRect(el.startX!, el.startY!, el.endX! - el.startX!, el.endY! - el.startY!);
        break;
      }
     case 'text': {
        const fontSize = el.fontSize || 24;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'top';
        const x = el.textX || 0;
        const y = el.textY || 0;
        const padding = Math.max(4, fontSize * 0.2);
        const lineHeight = fontSize * 1.3;
        const lines = (el.text || '').split('\n');
        const maxLineWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
        const textWidth = maxLineWidth + padding * 2;
        const textHeight = lines.length * lineHeight + padding * 2;
        const w = Math.max(el.width || 0, textWidth);
        const h = Math.max(el.height || 0, textHeight);
        if (el.showBackground !== false) {
          ctx.fillStyle = el.backgroundColor || 'rgba(99, 102, 241, 0.85)';
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = el.color || '#ffffff';
        lines.forEach((line, i) => {
          ctx.fillText(line, x + padding, y + padding + i * lineHeight + fontSize * 0.08);
        });
        break;
      }
    }
    ctx.restore();
  }
}

function drawArrowHelper(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) {
  const headlen = size * 3;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

// ====== Shape preview (on overlay during drag) ======
function drawShapePreview(tool: DrawTool, start: { x: number; y: number }, end: { x: number; y: number }) {
  const overlay = overlayCanvasRef.value;
  if (!overlay) return;
  const ctx = overlay.getContext('2d')!;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.strokeStyle = drawColor.value;
  ctx.fillStyle = drawColor.value;
  ctx.lineWidth = drawSize.value;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = drawOpacity.value / 100;

  if (tool === 'arrow') {
    drawArrowHelper(ctx, start.x, start.y, end.x, end.y, drawSize.value);
  } else if (tool === 'circle') {
    const rect = normalizeRect(start.x, start.y, end.x, end.y);
    ctx.beginPath();
    ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w / 2, 1), Math.max(rect.h / 2, 1), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (tool === 'rect') {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  }
  ctx.globalAlpha = 1;
}

// ====== HitTest ======
function hitTestElement(el: DrawElement, px: number, py: number): boolean {
  const lx = px - el.offsetX;
  const ly = py - el.offsetY;
  const threshold = Math.max(el.size / 2, 3) + 5;

  switch (el.type) {
    case 'stroke':
    case 'eraser': {
      if (!el.points || el.points.length === 0) return false;
      return el.points.some(p => Math.hypot(p.x - lx, p.y - ly) < threshold);
    }
    case 'arrow': {
      return pointToSegmentDist(lx, ly, el.startX!, el.startY!, el.endX!, el.endY!) < threshold;
    }
    case 'circle':
    case 'rect': {
      const bbox = getElementBBox(el);
      return lx >= bbox.x - threshold && lx <= bbox.x + bbox.w + threshold
          && ly >= bbox.y - threshold && ly <= bbox.y + bbox.h + threshold;
    }
    case 'text': {
      const bbox = getElementBBox(el);
      return lx >= bbox.x - threshold && lx <= bbox.x + bbox.w + threshold
          && ly >= bbox.y - threshold && ly <= bbox.y + bbox.h + threshold;
    }
    default: return false;
  }
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function findHitElement(px: number, py: number): DrawElement | null {
  for (let i = drawElements.value.length - 1; i >= 0; i--) {
    if (hitTestElement(drawElements.value[i], px, py)) {
      return drawElements.value[i];
    }
  }
  return null;
}

function getElementBBox(el: DrawElement): { x: number; y: number; w: number; h: number } {
  switch (el.type) {
    case 'stroke': {
      if (!el.points || el.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of el.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case 'arrow':
    case 'circle':
    case 'rect': {
      return normalizeRect(el.startX!, el.startY!, el.endX!, el.endY!);
    }
   case 'text': {
      const fontSize = el.fontSize || 24;
      const x = el.textX || 0;
      const y = el.textY || 0;
      const h = Math.max(el.height || 0, fontSize + 8);
      const w = Math.max(el.width || 0, 40);
      return { x, y, w, h };
   }
    default: return { x: 0, y: 0, w: 0, h: 0 };
  }
}

function renderSelectionBox() {
  const el = drawElements.value.find(e => e.id === activeElementId.value);
  if (!el) return;
  const overlay = overlayCanvasRef.value;
  if (!overlay) return;
  const ctx = overlay.getContext('2d')!;
  const bbox = getElementBBox(el);
  const pad = 6;
  const bx = bbox.x + el.offsetX - pad;
  const by = bbox.y + el.offsetY - pad;
  const bw = bbox.w + pad * 2;
  const bh = bbox.h + pad * 2;

  ctx.save();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);

  const hs = 6;
  const corners = [
    [bx, by], [bx + bw - hs, by],
    [bx, by + bh - hs], [bx + bw - hs, by + bh - hs],
  ];
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1;
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx, cy, hs, hs);
    ctx.strokeRect(cx, cy, hs, hs);
  }
  ctx.restore();
}

// ====== Apply / Reset / Close ======
function applyImageFilters() {
  isDirty.value = true;
  renderImageToCanvas();
}

function rotateImage(deg: number) {
  saveToHistory();
  _editRotation += deg;
  isDirty.value = true;
  renderImageToCanvas();
}

function flipImage(dir: 'h' | 'v') {
  saveToHistory();
  if (dir === 'h') _editFlipH = !_editFlipH;
  else _editFlipV = !_editFlipV;
  isDirty.value = true;
  renderImageToCanvas();
}

async function handleClose() {
  if (!isDirty.value) {
    emit('close');
    return;
  }
  try {
    await ElMessageBox.confirm('尚未应用替换，是否直接退出？', '提示', {
      confirmButtonText: '替换',
      cancelButtonText: '退出',
      distinguishCancelAndClose: true,
      closeOnClickModal: false,
      type: 'warning',
      appendTo: overlayRef.value || undefined,
    });
    applyImageEdit();
  } catch (action) {
    if (action === 'cancel') {
      emit('close');
    }
  }
}

function resetImageEdit(trackHistory = true) {
  const current = trackHistory ? createEditorSnapshot() : null;
  if (current) {
    drawHistory.value.push(current);
    if (drawHistory.value.length > 50) drawHistory.value.shift();
    drawFuture.value = [];
  }
  _editRotation = 0;
  _editFlipH = false;
  _editFlipV = false;
  imgAdjust.value = { brightness: 0, contrast: 0, saturation: 0 };
  activeCropRatio.value = '';
  drawHistory.value = [];
  drawFuture.value = [];
  drawElements.value = [];
  activeElementId.value = null;
  _currentDrawingId = null;
  expandDrag.value = { top: 0, bottom: 0, left: 0, right: 0 };
  expandRatio.value = '自由';
  clearExpandState();
  resetSplitState();
  canvasZoom.value = 1;
  canvasPan.value = { x: 0, y: 0 };
  isDirty.value = false;
  clearOverlay();
  renderImageToCanvas();
}

async function applyImageEdit() {
  if (drawTool.value === 'split') {
    applySplit();
    return;
  }
  if (drawTool.value === 'compress') {
    const result = compressWorkbench.getApplyResult();
    if (!result) return;
    emit('apply', result);
    isDirty.value = false;
    ElMessage.success('已应用图片压缩');
    return;
  }
  if (drawTool.value === 'crop' && cropRect.value.w >= 4 && cropRect.value.h >= 4) {
    applyCropSelection();
  }
  if (drawTool.value === 'expand' && canApplyExpand.value) {
    applyExpand();
  }

  const result = await buildEditedImageResult();
  if (!result) return;
  emit('apply', result);
  isDirty.value = false;
  ElMessage.success('已应用图片修改');
}

async function buildEditedImageResult(): Promise<{ file: File; url: string } | null> {
  const bgCanvas = editCanvasRef.value;
  const drawCanvas = drawLayerRef.value;
  if (!bgCanvas) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = bgCanvas.width;
  offscreen.height = bgCanvas.height;
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(bgCanvas, 0, 0);
  if (drawCanvas) ctx.drawImage(drawCanvas, 0, 0);

  return await new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const ext = props.imageFile.name.match(/\.(png|gif|webp)$/i)?.[1] || 'jpg';
      const newFile = new File(
        [blob],
        props.imageFile.name.replace(/\.[^.]+$/, '') + '_edited.' + ext,
        { type: blob.type }
      );
      resolve({ file: newFile, url: URL.createObjectURL(newFile) });
    }, 'image/jpeg', 0.92);
  });
}

function clearEditedDragPayload(): void {
  const url = String(_editedDragPayload?.url || '');
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  _editedDragPayload = null;
}

function buildCompressedDragPayload(): AssetDragPayload | null {
  if (drawTool.value === 'compress') {
    const result = compressWorkbench.getApplyResult();
    const url = result?.url || compressWorkbench.selectedRow.value?.processedPreviewUrl;
    if (!url) return null;
    return {
      id: props.imageFile.name,
      url,
      type: 'image',
      filename: props.imageFile.name.replace(/\.[^.]+$/, '') + '_compressed.jpg',
    };
  }
  return null;
}

function buildOriginalImageDragPayload(): AssetDragPayload | null {
  const url = String(props.imageUrl || '').trim();
  const filename = String(props.imageFile?.name || '').trim();
  if (!url || !filename) return null;
  return {
    id: filename,
    url,
    type: 'image',
    filename,
  };
}

async function buildEditedImageDragPayload(): Promise<AssetDragPayload | null> {
  const compressPayload = buildCompressedDragPayload();
  if (compressPayload) return compressPayload;
  if (!isDirty.value) return buildOriginalImageDragPayload();
  const result = await buildEditedImageResult();
  if (!result?.url) return null;
  return {
    id: props.imageFile.name,
    url: result.url,
    type: 'image',
    filename: result.file.name,
  };
}

async function prepareEditedImageDragOut(): Promise<void> {
  if (_editedDragPayload) return;
  if (_editedDragPreparePromise) {
    await _editedDragPreparePromise;
    return;
  }
  const token = ++_editedDragPrepareToken;
  _editedDragPreparePromise = (async () => {
    const payload = await buildEditedImageDragPayload();
    if (token !== _editedDragPrepareToken) {
      if (payload?.url?.startsWith('blob:')) URL.revokeObjectURL(payload.url);
      return null;
    }
    clearEditedDragPayload();
    _editedDragPayload = payload;
    if (payload) prepareAssetDragOut(payload);
    return payload;
  })();
  try {
    await _editedDragPreparePromise;
  } finally {
    _editedDragPreparePromise = null;
  }
}

function handleEditedImageDragOutStart(event: DragEvent): void {
  if (!_editedDragPayload) {
    event.preventDefault();
    return;
  }
  startAssetDragOut(event, _editedDragPayload);
}

function handleEditedImageDragOutEnd(event: DragEvent): void {
  endAssetDragOut(event, _editedDragPayload);
  clearEditedDragPayload();
}

// ====== Tool switching ======
function setDrawTool(t: DrawTool) {
  if (textInput.value.visible && textInput.value.value.trim()) commitText();
  else textInput.value.visible = false;

  if (t === 'eyedropper') _prevDrawTool = drawTool.value;

  activeElementId.value = null;
  clearOverlay();
  clearBrushCursor();

  if (drawTool.value === 'crop' && t !== 'crop') {
    cropRect.value = { x: 0, y: 0, w: 0, h: 0 };
  }
  if (drawTool.value === 'expand' && t !== 'expand') {
    deactivateExpandPreview();
  }
  if (drawTool.value === 'split' && t !== 'split') {
    resetSplitState();
  }

  drawTool.value = t;

  if (t === 'crop' || t === 'expand' || t === 'split' || t === 'compress') toolsCollapsed.value = false;
  if (['pencil', 'eraser', 'arrow', 'circle', 'rect', 'text'].includes(t)) toolsCollapsed.value = false;

  if (t === 'crop') nextTick(renderCropOverlay);
  if (t === 'expand') nextTick(() => requestAnimationFrame(() => renderExpandOverlay()));
}

// ====== Zoom ======
function onCanvasWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  canvasZoom.value = Math.max(0.2, Math.min(5, canvasZoom.value * delta));
}

function createExpandHistorySnapshot(imageData: ImageData, width: number, height: number): EditorSnapshot {
  return {
    width,
    height,
    imageData,
    elements: JSON.parse(JSON.stringify(drawElements.value)),
    rotation: _editRotation,
    flipH: _editFlipH,
    flipV: _editFlipV,
    brightness: imgAdjust.value.brightness,
    contrast: imgAdjust.value.contrast,
    saturation: imgAdjust.value.saturation,
  };
}

function pushHistorySnapshot(snapshot: EditorSnapshot) {
  drawHistory.value.push(snapshot);
  if (drawHistory.value.length > 50) drawHistory.value.shift();
}

function clearFutureHistory() {
  drawFuture.value = [];
}

const {
  expandDrag,
  expandColor,
  expandRatio,
  expandInfo,
  expandSummary,
  canApplyExpand,
  isExpandReady,
  expandCursor,
  setExpandInset,
  setExpandRatio,
  clearExpandState,
  restoreExpandSnapshot,
  renderExpandOverlay,
  handleExpandMouseDown,
  handleExpandMouseMove,
  stopExpandDrag,
  clearExpandHover,
  resetExpandDrag,
  deactivateExpandPreview,
  applyExpand,
} = useImageExpandTool({
  editCanvasRef,
  drawLayerRef,
  overlayCanvasRef,
  drawElements,
  editImageInfo,
  renderDrawLayer,
  syncDrawLayerSize,
  syncCursorLayerSize,
  syncAllLayers,
  getCanvasCoords,
  createHistorySnapshot: createExpandHistorySnapshot,
  pushHistorySnapshot,
  clearFutureHistory,
  markDirty: () => { isDirty.value = true; },
  notifyApplied: () => { ElMessage.success('扩图已应用'); },
});

const {
  splitConfig,
  splitting,
  splitUploadProgress,
  splitHoverLine,
  splitCursor,
  customRows,
  customCols,
  maxDimension: maxSplitDimension,
  SPLIT_MODES,
  setSplitMode,
  applyCustomSplitMode,
  applyCustomRows,
  applyCustomCols,
  renderSplitOverlay,
  handleSplitMouseDown,
  handleSplitMouseMove,
  stopSplitDrag,
  applySplit,
  resetSplitState,
} = useSplitTool({
  editCanvasRef,
  drawLayerRef,
  overlayCanvasRef,
  getCanvasCoords,
  emitSplitResult: (payload) => emit('splitResult', payload),
});

// ====== Undo / Redo ======
const {
  createEditorSnapshot,
  restoreEditorSnapshot,
  saveToHistory,
  drawUndo,
  drawRedo,
} = useImageReferenceHistory({
  editCanvasRef,
  drawElements,
  activeElementId,
  drawHistory,
  drawFuture,
  imgAdjust,
  cropRect,
  expandDrag,
  getRotation: () => _editRotation,
  getFlipH: () => _editFlipH,
  getFlipV: () => _editFlipV,
  setRotation: (value) => { _editRotation = value; },
  setFlipH: (value) => { _editFlipH = value; },
  setFlipV: (value) => { _editFlipV = value; },
  resetCurrentDrawing: () => { _currentDrawingId = null; },
  clearExpandState: () => { clearExpandState(); },
  clearOverlay,
  syncAllLayers,
})

function bindExpandColorPickerEl(element: Element | null) {
  expandColorPickerEl.value = element instanceof HTMLElement ? element : null;
}

// ====== Text ======
const TEXT_COLOR_PRESETS = [
  '#ffffff',
  '#000000',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#007aff',
  '#af52de',
  '#ff2d55',
];

const TEXT_BG_PRESETS = [
  'rgba(255, 107, 107, 0.85)',
  'rgba(78, 205, 196, 0.85)',
  'rgba(69, 183, 209, 0.85)',
  'rgba(249, 202, 36, 0.85)',
  'rgba(108, 92, 231, 0.85)',
  'rgba(253, 121, 168, 0.85)',
  'rgba(0, 184, 148, 0.85)',
  'rgba(225, 112, 85, 0.85)',
  'rgba(129, 140, 248, 0.85)',
  'rgba(52, 211, 153, 0.85)',
];

function generateTextBoxColor(): string {
  return TEXT_BG_PRESETS[Math.floor(Math.random() * TEXT_BG_PRESETS.length)];
}

function toRgbaWithOpacity(color: string, opacity: number): string {
  const normalizedOpacity = Math.max(0.1, Math.min(1, opacity / 100));
  const raw = String(color || '').trim();
  if (!raw) return `rgba(255, 255, 255, ${normalizedOpacity})`;
  const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim());
    const [r = '255', g = '255', b = '255'] = parts;
    return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
  }
  const hex = raw.replace('#', '');
  const validHex = /^[0-9a-f]{3,8}$/i.test(hex);
  if (!validHex) return raw;
  const expanded = hex.length === 3 || hex.length === 4
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  const rgbHex = expanded.slice(0, 6).padEnd(6, 'f');
  const r = Number.parseInt(rgbHex.slice(0, 2), 16);
  const g = Number.parseInt(rgbHex.slice(2, 4), 16);
  const b = Number.parseInt(rgbHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity})`;
}

function syncTextColorOpacity(): void {
  if (!textInput.value.visible && !textInput.value.editingElementId) return;
  textInput.value.color = toRgbaWithOpacity(textInput.value.color, textColorOpacity.value);
}

function syncTextBackgroundOpacity(): void {
  if (!textInput.value.visible && !textInput.value.editingElementId) return;
  textInput.value.backgroundColor = toRgbaWithOpacity(textInput.value.backgroundColor, textBgOpacity.value);
}

const textBgColorPickerEl = ref<HTMLElement | null>(null);
let _textBgPickr: Pickr | null = null;

function setTextBgColor(color: string): void {
  textInput.value.backgroundColor = toRgbaWithOpacity(color, textBgOpacity.value);
}

function initTextBgColorPicker(): void {
  if (!textBgColorPickerEl.value || _textBgPickr) return;
  _textBgPickr = Pickr.create({
    el: textBgColorPickerEl.value,
    theme: 'monolith',
    useAsButton: true,
    position: 'bottom-start',
    default: '#6366f1',
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: { hex: true, input: true, save: true },
    },
  });
  _textBgPickr.on('save', (color: any) => {
    if (color) {
      textInput.value.backgroundColor = toRgbaWithOpacity(color.toRGBA().toString(), textBgOpacity.value);
      _textBgPickr?.hide();
    }
  });
}

function destroyTextBgColorPicker(): void {
  _textBgPickr?.destroy();
  _textBgPickr = null;
}

const textColorPickerEl = ref<HTMLElement | null>(null);
let _textColorPickr: Pickr | null = null;

function setTextColor(color: string): void {
  textInput.value.color = toRgbaWithOpacity(color, textColorOpacity.value);
}

function initTextColorPicker(): void {
  if (!textColorPickerEl.value || _textColorPickr) return;
  _textColorPickr = Pickr.create({
    el: textColorPickerEl.value,
    theme: 'monolith',
    useAsButton: true,
    position: 'bottom-start',
    default: textInput.value.color,
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: { hex: true, input: true, save: true },
    },
  });
  _textColorPickr.on('change', (color: any) => {
    textInput.value.color = toRgbaWithOpacity(color.toHEXA().toString(), textColorOpacity.value);
  });
  _textColorPickr.on('save', (color: any) => {
    if (color) {
      textInput.value.color = toRgbaWithOpacity(color.toHEXA().toString(), textColorOpacity.value);
      _textColorPickr?.hide();
    }
  });
}

function destroyTextColorPicker(): void {
  _textColorPickr?.destroy();
  _textColorPickr = null;
}

watch(drawTool, (tool) => {
  if (tool === 'text') nextTick(() => { initTextBgColorPicker(); initTextColorPicker(); });
  else { destroyTextBgColorPicker(); destroyTextColorPicker(); }
}, { immediate: true });

watch(textColorOpacity, () => {
  if (drawTool.value === 'text') syncTextColorOpacity();
});

watch(textBgOpacity, () => {
  if (drawTool.value === 'text') syncTextBackgroundOpacity();
});

function getInitialTextBoxRect(
  canvas: HTMLCanvasElement,
  canvasX: number,
  canvasY: number,
): { x: number; y: number; w: number; h: number; fontSize: number } {
  const scale = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
  const displayH = canvas.clientHeight;
  const displayW = canvas.clientWidth;
  // 文字框高度占视口高度的 6%–8%，保证在不同分辨率画布下视觉一致
  const displayBoxH = Math.max(42, Math.min(displayH * 0.075, 110));
  const displayBoxW = Math.max(130, Math.min(displayBoxH * 2.5, displayW * 0.65));
  const displayFontSize = Math.max(16, Math.min(displayBoxH * 0.65, 48));

  return {
    x: canvasX,
    y: canvasY,
    w: displayBoxW * scale,
    h: displayBoxH * scale,
    fontSize: displayFontSize * scale,
  };
}

function openTextInput(
  rect: { x: number; y: number; w: number; h: number; fontSize?: number },
  editingEl?: DrawElement,
) {
  const canvas = editCanvasRef.value;
  if (!canvas) return;
  const clamped = clampToCanvas(rect.x, rect.y);
  const maxW = canvas.width - clamped.x;
  const maxH = canvas.height - clamped.y;
  const w = Math.min(Math.max(rect.w, 40), maxW);
  const h = Math.min(Math.max(rect.h, 30), maxH);
  const baseBgColor = editingEl?.backgroundColor
    || textInput.value.backgroundColor
    || generateTextBoxColor();
  const baseTextColor = editingEl?.color || textInput.value.color || '#ffffff';
  const bgColor = toRgbaWithOpacity(baseBgColor, textBgOpacity.value);
  const textColor = toRgbaWithOpacity(baseTextColor, textColorOpacity.value);
  const sx = canvas.clientWidth / canvas.width;
  const sy = canvas.clientHeight / canvas.height;
  // fontSize 统一为 display 像素，与 width/height 单位一致，方便拖拽时等比缩放
  const canvasFontSize =
    editingEl?.fontSize
    || rect.fontSize
    || Math.max(16, Math.min(h * 0.65, 48));
  const fontSize = canvasFontSize * sx;
  textInput.value = {
    visible: true,
    x: clamped.x * sx,
    y: clamped.y * sy,
    value: editingEl?.text || '',
    canvasX: clamped.x,
    canvasY: clamped.y,
    fontSize,
    width: w * sx,
    height: h * sy,
    backgroundColor: bgColor,
    color: textColor,
    editingElementId: editingEl?.id || null,
  };
  // 编辑已有文字时读取该文字自身状态；新建文字时沿用当前勾选状态作为新文字默认值。
  textShowBackground.value = editingEl ? Boolean(editingEl.showBackground) : textShowBackground.value;
  syncTextColorOpacity();
  syncTextBackgroundOpacity();
  nextTick(() => {
    const el = textInputRef.value;
    if (el) el.innerText = textInput.value.value;
    autoFitHeight();
    autoFitWidth();
    // setTimeout 0 在所有 Vue 微任务（包括 autoFit 触发的二次渲染）之后执行，
    // 确保 contenteditable 已稳定存在于 DOM 中再聚焦
    setTimeout(() => {
      const ta = textInputRef.value;
      if (ta) {
        ta.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(ta);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 0);
  });
}

function displayWToCanvas(px: number): number {
  const canvas = editCanvasRef.value;
  if (!canvas || canvas.clientWidth === 0) return px;
  return (px * canvas.width) / canvas.clientWidth;
}

/** Check if a canvas point is near a selection corner handle. */
function hitTestSelectionCorner(px: number, py: number): TextBoxCorner | '' {
  if (!activeElementId.value) return '';
  const el = drawElements.value.find(e => e.id === activeElementId.value);
  if (!el || el.type !== 'text') return '';
  const bbox = getElementBBox(el);
  const ax = bbox.x + el.offsetX;
  const ay = bbox.y + el.offsetY;
  const threshold = 14;
  const corners: [TextBoxCorner, number, number][] = [
    ['tl', ax, ay],
    ['tr', ax + bbox.w, ay],
    ['bl', ax, ay + bbox.h],
    ['br', ax + bbox.w, ay + bbox.h],
  ];
  for (const [c, cx, cy] of corners) {
    if (Math.hypot(px - cx, py - cy) < threshold) return c;
  }
  return '';
}

function resizeTextElement(el: DrawElement, corner: TextBoxCorner, coords: { x: number; y: number }): void {
  const dx = coords.x - _elementDragStart.x;
  const dy = coords.y - _elementDragStart.y;
  const minW = 40;
  const minH = 30;
  if (corner === 'br') {
    el.width = Math.max(minW, _resizeInit.width + dx);
    el.height = Math.max(minH, _resizeInit.height + dy);
  } else if (corner === 'tr') {
    el.width = Math.max(minW, _resizeInit.width + dx);
    el.height = Math.max(minH, _resizeInit.height - dy);
    el.textY = _resizeInit.textY + (_resizeInit.height - (el.height || minH));
  } else if (corner === 'bl') {
    el.width = Math.max(minW, _resizeInit.width - dx);
    el.height = Math.max(minH, _resizeInit.height + dy);
    el.textX = _resizeInit.textX + (_resizeInit.width - (el.width || minW));
  } else if (corner === 'tl') {
    el.width = Math.max(minW, _resizeInit.width - dx);
    el.height = Math.max(minH, _resizeInit.height - dy);
    el.textX = _resizeInit.textX + (_resizeInit.width - (el.width || minW));
    el.textY = _resizeInit.textY + (_resizeInit.height - (el.height || minH));
  }
}

const selectedTextToolbarStyle = computed(() => {
  if (!activeElementId.value || textInput.value.visible) return null;
  const el = drawElements.value.find(e => e.id === activeElementId.value);
  if (!el || el.type !== 'text') return null;
  const canvas = editCanvasRef.value;
  if (!canvas || canvas.clientWidth === 0) return null;
  const bbox = getElementBBox(el);
  const sx = canvas.clientWidth / canvas.width;
  return {
    left: (bbox.x + el.offsetX) * sx + 'px',
    top: (bbox.y + el.offsetY) * sx + 'px',
    width: Math.max(bbox.w * sx, 100) + 'px',
  };
});

function deleteActiveTextElement(): void {
  if (!activeElementId.value) return;
  saveToHistory();
  drawElements.value = drawElements.value.filter(el => el.id !== activeElementId.value);
  activeElementId.value = null;
  isDirty.value = true;
  clearOverlay();
  renderDrawLayer();
}

function setActiveTextBgColor(color: string): void {
  if (!activeElementId.value) return;
  const el = drawElements.value.find(e => e.id === activeElementId.value);
  if (el && el.type === 'text') {
    el.backgroundColor = color;
    el.showBackground = true;
    isDirty.value = true;
    renderDrawLayer();
    renderSelectionBox();
  }
}

function editActiveTextElement(): void {
  if (!activeElementId.value) return;
  const el = drawElements.value.find(e => e.id === activeElementId.value);
  if (el && el.type === 'text') {
    const rect = { x: el.textX || 0, y: el.textY || 0, w: el.width || 100, h: el.height || 40 };
    openTextInput(rect, el);
  }
}

function commitText() {
  if (!textInput.value.value.trim()) {
    textInput.value.visible = false;
    return;
  }

  saveToHistory();
  isDirty.value = true;

  // fontSize 在 textInput 中是 display 像素，提交到画布时需转为 canvas 像素
  const canvasFontSize = Math.round(displayWToCanvas(textInput.value.fontSize));

  const editingId = textInput.value.editingElementId;
  if (editingId) {
    const el = drawElements.value.find(e => e.id === editingId);
    if (el && el.type === 'text') {
      el.text = textInput.value.value;
      el.textX = textInput.value.canvasX;
      el.textY = textInput.value.canvasY;
      el.fontSize = canvasFontSize;
      el.width = displayWToCanvas(textInput.value.width);
      el.height = displayWToCanvas(textInput.value.height);
      el.backgroundColor = textInput.value.backgroundColor;
      el.showBackground = textShowBackground.value;
      el.color = textInput.value.color;
    }
  } else {
    const id = `el_${++_elementIdCounter}`;
    const newEl: DrawElement = {
      id,
      type: 'text',
      color: textInput.value.color,
      size: drawSize.value,
      opacity: drawOpacity.value,
      offsetX: 0, offsetY: 0,
      text: textInput.value.value,
      textX: textInput.value.canvasX,
      textY: textInput.value.canvasY,
      fontSize: canvasFontSize,
      width: displayWToCanvas(textInput.value.width),
      height: displayWToCanvas(textInput.value.height),
      backgroundColor: textInput.value.backgroundColor,
      showBackground: textShowBackground.value,
    };
    drawElements.value.push(newEl);
  }
  textInput.value.visible = false;
  textInput.value.value = '';
  textInput.value.editingElementId = null;
  renderDrawLayer();
}

function cancelText() {
  const editingId = textInput.value.editingElementId;
  textInput.value.visible = false;
  textInput.value.value = '';
  textInput.value.editingElementId = null;
  // 编辑已有元素时，点击删除应直接删除元素
  if (editingId) {
    saveToHistory();
    drawElements.value = drawElements.value.filter(el => el.id !== editingId);
    activeElementId.value = null;
    isDirty.value = true;
    clearOverlay();
    renderDrawLayer();
  }
}

function onTextKeyDown(e: KeyboardEvent) {
  // Enter 正常换行，不再触发提交
  if (e.key === 'Escape') {
    e.preventDefault();
    cancelText();
  }
}

// ====== Init / Cleanup ======
onMounted(() => {
  loadImageToCanvas();
  initColorPicker();
  window.addEventListener('keydown', handleEditorKeyDown, true);
  window.addEventListener('keyup', handleEditorKeyUp, true);
  window.addEventListener('resize', updateCanvasDisplayScale);
  editorKeyHandler.value = handleEditorKeyDown;
});

onUnmounted(() => {
  endPointerTracking();
  _pickr?.destroy();
  _pickr = null;
  _expandPickr?.destroy();
  _expandPickr = null;
  _textBgPickr?.destroy();
  _textBgPickr = null;
  _textColorPickr?.destroy();
  _textColorPickr = null;
  window.removeEventListener('keydown', handleEditorKeyDown, true);
  window.removeEventListener('keyup', handleEditorKeyUp, true);
  window.removeEventListener('resize', updateCanvasDisplayScale);
  editorKeyHandler.value = null;
});

watch(() => props.imageUrl, () => {
  resetImageEdit(false);
  loadImageToCanvas();
});

watch(drawTool, (t) => {
  if (t === 'expand') {
    nextTick(() => {
      if (!_expandPickr) initExpandColorPicker();
    });
  }
});

watch(canvasZoom, () => nextTick(updateCanvasDisplayScale));

// ====== Coordinate helpers ======
function clampToCanvas(x: number, y: number): { x: number; y: number } {
  const canvas = editCanvasRef.value;
  if (!canvas) return { x, y };
  return {
    x: Math.max(0, Math.min(canvas.width, x)),
    y: Math.max(0, Math.min(canvas.height, y)),
  };
}

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

function clampCropRect(rect: { x: number; y: number; w: number; h: number }) {
  const canvas = editCanvasRef.value;
  if (!canvas) return rect;
  const x = Math.max(0, Math.min(rect.x, canvas.width));
  const y = Math.max(0, Math.min(rect.y, canvas.height));
  const w = Math.max(0, Math.min(rect.w, canvas.width - x));
  const h = Math.max(0, Math.min(rect.h, canvas.height - y));
  return { x, y, w, h };
}

function applyCropRatioToRect(rect: { x: number; y: number; w: number; h: number }) {
  const ratio = cropRatios.find(r => r.label === activeCropRatio.value);
  if (!ratio || ratio.w <= 0 || ratio.h <= 0 || rect.w <= 0 || rect.h <= 0) return rect;
  const targetRatio = ratio.w / ratio.h;
  let { x, y, w, h } = rect;
  const currentRatio = w / h;
  if (currentRatio > targetRatio) {
    w = h * targetRatio;
    if (_cropDragStart.mx < x) x = rect.x + rect.w - w;
  } else {
    h = w / targetRatio;
    if (_cropDragStart.my < y) y = rect.y + rect.h - h;
  }
  return clampCropRect({ x, y, w, h });
}

function getCanvasCoords(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const canvas = editCanvasRef.value;
  if (!canvas) return { x: 0, y: 0 };
  const rect = _cachedCanvasRect || canvas.getBoundingClientRect();
  const scaleX = _cachedCanvasRect ? _cachedScaleX : canvas.width / rect.width;
  const scaleY = _cachedCanvasRect ? _cachedScaleY : canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function getCanvasDisplayCoords(e: { clientX: number; clientY: number }): { x: number; y: number } {
  const canvas = editCanvasRef.value;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const zoom = canvasZoom.value || 1;
  return {
    x: (e.clientX - rect.left) / zoom,
    y: (e.clientY - rect.top) / zoom,
  };
}

function beginPointerTracking() {
  if (_pointerTracking) return;
  _pointerTracking = true;
  const canvas = editCanvasRef.value;
  if (canvas) {
    _cachedCanvasRect = canvas.getBoundingClientRect();
    if (_cachedCanvasRect.width > 0) {
      _cachedScaleX = canvas.width / _cachedCanvasRect.width;
      _cachedScaleY = canvas.height / _cachedCanvasRect.height;
    }
  }
  const wrap = document.querySelector('.ref-edit-canvas-wrap') as HTMLElement | null;
  if (wrap) _cachedWrapRect = wrap.getBoundingClientRect();
  window.addEventListener('pointermove', onCanvasMouseMove);
  window.addEventListener('pointerup', onCanvasMouseUp);
}

function endPointerTracking() {
  if (!_pointerTracking) return;
  _pointerTracking = false;
  _cachedCanvasRect = null;
  _cachedWrapRect = null;
  if (_drawRafId !== null) { cancelAnimationFrame(_drawRafId); _drawRafId = null; }
  if (_cursorRafId !== null) { cancelAnimationFrame(_cursorRafId); _cursorRafId = null; }
  _pendingCursorPos = null;
  window.removeEventListener('pointermove', onCanvasMouseMove);
  window.removeEventListener('pointerup', onCanvasMouseUp);
}

// ====== Mouse events ======
function onCanvasWrapMouseDown(e: PointerEvent) {
  if (e.button === 1) {
    e.preventDefault();
  }

  if (e.button === 0 && !_spacePanning) {
    const drawToolsList = ['pencil', 'eraser', 'arrow', 'circle', 'rect'];
    if (drawToolsList.includes(drawTool.value) && !_drawing) {
      onCanvasMouseDown(e);
      return;
    }
  }
}

function onCanvasWrapMouseMove(e: PointerEvent) {
  if (drawTool.value === 'pencil' || drawTool.value === 'eraser') {
    const wr = _cachedWrapRect;
    if (!wr) return;
    _pendingCursorPos = { x: e.clientX - wr.left, y: e.clientY - wr.top };
    if (_cursorRafId === null) {
      _cursorRafId = requestAnimationFrame(() => {
        _cursorRafId = null;
        if (_pendingCursorPos) {
          brushCursorPos.value = _pendingCursorPos;
          _pendingCursorPos = null;
        }
      });
    }
  }
}

function onCanvasWrapMouseLeave() {
  clearBrushCursor();
  cropHoverHandle.value = '';
  if (drawTool.value === 'expand') clearExpandHover();
  if (drawTool.value === 'split') splitHoverLine.value = '';
}

function onCanvasMouseDown(e: PointerEvent) {
  // Middle button = pan (global, any tool)
  if (e.button === 1) {
    e.preventDefault();
    _panning = true;
    _panStart = { x: e.clientX, y: e.clientY };
    _panInit = { ...canvasPan.value };
    beginPointerTracking();
    return;
  }

  // Only left button from here
  if (e.button !== 0) return;

  // Space key panning
  if (_spacePanning) {
    _panning = true;
    _panStart = { x: e.clientX, y: e.clientY };
    _panInit = { ...canvasPan.value };
    beginPointerTracking();
    return;
  }

  const coords = getCanvasCoords(e);

  // Select tool = element selection / move
  if (drawTool.value === 'select') {
    // 武装拖出窗口外：select 工具下左键按下时记录画布外框，后续 move 超出则触发拖出
    // Corner-resize on selected text element (priority over drag)
    const selCorner = hitTestSelectionCorner(coords.x, coords.y);
    if (selCorner) {
      const el = drawElements.value.find(d => d.id === activeElementId.value);
      if (el && el.type === 'text') {
        _elementResizeCorner = selCorner;
        _elementDragStart = coords;
        _resizeInit = { textX: el.textX || 0, textY: el.textY || 0, width: el.width || 0, height: el.height || 0, fontSize: el.fontSize || 24 };
        saveToHistory();
        isDirty.value = true;
        beginPointerTracking();
      }
      return;
    }
    _dragOutArmed = true;
    _dragOutTriggered = false;
    _dragOutWrapRect = (document.querySelector('.ref-edit-canvas-wrap') as HTMLElement | null)?.getBoundingClientRect() ?? null;
    _dragOutElementRestore = null;

    const hitEl = findHitElement(coords.x, coords.y);
    if (hitEl) {
      // 点击已选中的文字元素 → 直接进入编辑
      if (hitEl.id === activeElementId.value && hitEl.type === 'text') {
        editActiveTextElement();
        return;
      }
      activeElementId.value = hitEl.id;
      _elementDragging = true;
      _elementDragStart = coords;
      _elementDragInitOffset = { x: hitEl.offsetX, y: hitEl.offsetY };
      _dragOutElementRestore = { id: hitEl.id, offsetX: hitEl.offsetX, offsetY: hitEl.offsetY };
      saveToHistory();
      isDirty.value = true;
    } else {
      activeElementId.value = null;
    }
    clearOverlay();
    if (activeElementId.value) renderSelectionBox();
    beginPointerTracking();
    return;
  }

  if (drawTool.value === 'crop') {
    handleCropMouseDown(e, coords);
    beginPointerTracking();
    return;
  }

  if (drawTool.value === 'expand') {
    handleExpandMouseDown(coords);
    beginPointerTracking();
    return;
  }

  if (drawTool.value === 'split') {
    handleSplitMouseDown(coords);
    beginPointerTracking();
    return;
  }

  if (drawTool.value === 'text') {
    // 1) Corner resize on already-selected text element
    const corner = hitTestSelectionCorner(coords.x, coords.y);
    if (corner) {
      const el = drawElements.value.find(d => d.id === activeElementId.value);
      if (el && el.type === 'text') {
        _elementResizeCorner = corner;
        _elementDragStart = coords;
        _resizeInit = { textX: el.textX || 0, textY: el.textY || 0, width: el.width || 0, height: el.height || 0, fontSize: el.fontSize || 24 };
        saveToHistory();
        isDirty.value = true;
        beginPointerTracking();
      }
      return;
    }
    // 2) Click on existing text element: open for re-editing
    const hitEl = findHitElement(coords.x, coords.y);
    if (hitEl && hitEl.type === 'text') {
      // 先提交/取消当前正在编辑的文字
      if (textInput.value.visible && textInput.value.value.trim()) commitText();
      else if (textInput.value.visible) cancelText();
      const rect = {
        x: hitEl.textX || 0,
        y: hitEl.textY || 0,
        w: hitEl.width || 160,
        h: hitEl.height || 60,
      };
      openTextInput(rect, hitEl);
      return;
    }
    // 3) Empty space: create new text box
    if (textInput.value.visible && textInput.value.value.trim()) commitText();
    else if (textInput.value.visible) cancelText();
    saveToHistory();
    isDirty.value = true;
    const canvas = editCanvasRef.value;
    const rect = canvas ? getInitialTextBoxRect(canvas, coords.x, coords.y) : { x: coords.x, y: coords.y, w: 160, h: 60, fontSize: 24 };
    openTextInput(rect);
    return;
  }

  // Pencil = create DrawElement stroke
  if (drawTool.value === 'pencil') {
    saveToHistory();
    isDirty.value = true;
    const pr = getPressure(e);
    const pt = pr !== 1 ? { ...coords, pressure: pr } : coords;
    const id = `el_${++_elementIdCounter}`;
    const newEl: DrawElement = {
      id,
      type: 'stroke',
      color: drawColor.value,
      size: drawSize.value,
      opacity: drawOpacity.value,
      offsetX: 0, offsetY: 0,
      points: [pt],
    };
    drawElements.value.push(newEl);
    _currentDrawingId = id;
    _drawing = true;
    _lastRenderedPointCount = 1;
    beginPointerTracking();
    return;
  }

  // Eraser = pixel-level erase on draw layer
  if (drawTool.value === 'eraser') {
    saveToHistory();
    isDirty.value = true;
    const pr = getPressure(e);
    const pt = pr !== 1 ? { ...coords, pressure: pr } : coords;
    const id = `el_${++_elementIdCounter}`;
    const newEl: DrawElement = {
      id,
      type: 'eraser',
      color: '#000000',
      size: drawSize.value,
      opacity: 100,
      offsetX: 0, offsetY: 0,
      points: [pt],
    };
    drawElements.value.push(newEl);
    _currentDrawingId = id;
    _drawing = true;
    _lastRenderedPointCount = 1;
    renderDrawLayer();
    beginPointerTracking();
    return;
  }

  // Eyedropper = pick color from background canvas
  if (drawTool.value === 'eyedropper') {
    const bgCanvas = editCanvasRef.value;
    if (bgCanvas) {
      const ctx = bgCanvas.getContext('2d')!;
      const pixel = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      drawColor.value = hex;
      if (_pickr) _pickr.setColor(hex);
      ElMessage.success(`已吸取颜色 ${hex}`);
    }
    if (_prevDrawTool) { const prev = _prevDrawTool; _prevDrawTool = null; setDrawTool(prev); }
    return;
  }

  // Arrow / circle / rect = shape preview
  if (drawTool.value === 'arrow' || drawTool.value === 'circle' || drawTool.value === 'rect') {
    _drawing = true;
    _drawStart = coords;
    _lastPoint = coords;
    beginPointerTracking();
    return;
  }
}

function onCanvasMouseMove(e: PointerEvent) {
  // Panning (middle button or space)
  if (_panning) {
    const dx = e.clientX - _panStart.x;
    const dy = e.clientY - _panStart.y;
    canvasPan.value = { x: _panInit.x + dx, y: _panInit.y + dy };
    return;
  }

  // 拖出窗口外：select 工具下按住左键移出画布外框 → 触发外部拖拽
  if (_dragOutArmed && drawTool.value === 'select') {
    if (_dragOutTriggered) return;
    const rect = _dragOutWrapRect;
    if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
      const url = String(props.imageUrl || '');
      if (url) {
        // 回滚已发生的元素位移，避免拖出后元素位置错乱
        if (_dragOutElementRestore) {
          const el = drawElements.value.find(d => d.id === _dragOutElementRestore!.id);
          if (el) { el.offsetX = _dragOutElementRestore.offsetX; el.offsetY = _dragOutElementRestore.offsetY; renderDrawLayer(); }
        }
        _elementDragging = false;
        _dragOutTriggered = true;
        const handled = triggerAssetDragOut({ id: url, url, type: 'image' });
        if (!handled) {
          // 当前环境（如独立浏览器）未接管原生拖拽：恢复交互状态，让用户继续编辑
          _dragOutTriggered = false;
        }
        return;
      }
    }
  }

  if (drawTool.value === 'crop' && _cropDragHandle) {
    handleCropMouseMove(e);
    return;
  }
  if (drawTool.value === 'crop') {
    cropHoverHandle.value = getCropHandleAt(getCanvasCoords(e)).name;
  }

  if (drawTool.value === 'expand') {
    handleExpandMouseMove(e);
    return;
  }

  if (drawTool.value === 'split') {
    handleSplitMouseMove(e);
    return;
  }

  const coords = getCanvasCoords(e);

  // Element corner-resize (text elements)
  if (_elementResizeCorner && activeElementId.value) {
    const el = drawElements.value.find(e => e.id === activeElementId.value);
    if (el && el.type === 'text') {
      resizeTextElement(el, _elementResizeCorner, coords);
      renderDrawLayer();
      clearOverlay();
      renderSelectionBox();
    }
    return;
  }

  // Element dragging
  if (_elementDragging && activeElementId.value) {
    const el = drawElements.value.find(e => e.id === activeElementId.value);
    if (el) {
      const dx = coords.x - _elementDragStart.x;
      const dy = coords.y - _elementDragStart.y;
      el.offsetX = _elementDragInitOffset.x + dx;
      el.offsetY = _elementDragInitOffset.y + dy;
      renderDrawLayer();
      clearOverlay();
      renderSelectionBox();
    }
    return;
  }

  // Pencil / eraser drawing (rAF-throttled rendering)
  if ((drawTool.value === 'pencil' || drawTool.value === 'eraser') && _currentDrawingId) {
    const el = drawElements.value.find(e => e.id === _currentDrawingId);
    if (el?.points) {
      const pr = getPressure(e);
      el.points.push(pr !== 1 ? { ...coords, pressure: pr } : coords);
      if (_drawRafId === null) {
        _drawRafId = requestAnimationFrame(flushPendingStrokes);
      }
    }
    return;
  }

  // Shape preview
  if (_drawing && (drawTool.value === 'arrow' || drawTool.value === 'circle' || drawTool.value === 'rect')) {
    drawShapePreview(drawTool.value, _drawStart, coords);
    return;
  }
}

function onCanvasMouseUp(e: PointerEvent) {
  // 拖出窗口外收尾：解除武装；若已触发拖出，跳过其余 up 处理
  if (_dragOutArmed) {
    const wasTriggered = _dragOutTriggered;
    _dragOutArmed = false;
    _dragOutTriggered = false;
    _dragOutWrapRect = null;
    _dragOutElementRestore = null;
    if (wasTriggered) {
      endPointerTracking();
      return;
    }
  }

  // End panning
  if (_panning) {
    _panning = false;
    endPointerTracking();
    return;
  }

  if (drawTool.value === 'crop' && _cropDragHandle) {
    _cropDragHandle = '';
    endPointerTracking();
    return;
  }

  if (drawTool.value === 'expand') {
    stopExpandDrag();
    endPointerTracking();
    return;
  }

  if (drawTool.value === 'split') {
    stopSplitDrag();
    endPointerTracking();
    return;
  }

  // End element corner-resize
  if (_elementResizeCorner) {
    _elementResizeCorner = '';
    endPointerTracking();
    return;
  }

  // End element dragging
  if (_elementDragging) {
    _elementDragging = false;
    endPointerTracking();
    return;
  }

  // End pencil
  if (drawTool.value === 'pencil' && _currentDrawingId) {
    _currentDrawingId = null;
    _drawing = false;
    endPointerTracking();
    return;
  }

  // End eraser
  if (drawTool.value === 'eraser' && _currentDrawingId) {
    _currentDrawingId = null;
    _drawing = false;
    endPointerTracking();
    return;
  }

  if (!_drawing) {
    endPointerTracking();
    return;
  }
  _drawing = false;

  const coords = getCanvasCoords(e);

  // Commit shape (arrow / circle / rect) -> DrawElement
  if (drawTool.value === 'arrow' || drawTool.value === 'circle' || drawTool.value === 'rect') {
    const dx = coords.x - _drawStart.x;
    const dy = coords.y - _drawStart.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      clearOverlay();
      endPointerTracking();
      return;
    }
    saveToHistory();
    isDirty.value = true;
    const id = `el_${++_elementIdCounter}`;
    const newEl: DrawElement = {
      id,
      type: drawTool.value as 'arrow' | 'circle' | 'rect',
      color: drawColor.value,
      size: drawSize.value,
      opacity: drawOpacity.value,
      offsetX: 0, offsetY: 0,
      startX: _drawStart.x,
      startY: _drawStart.y,
      endX: coords.x,
      endY: coords.y,
    };
    drawElements.value.push(newEl);
    clearOverlay();
    renderDrawLayer();
    endPointerTracking();
    return;
  }

  endPointerTracking();
}

function onCanvasMouseLeave() {
  if (_pointerTracking) return;
  _drawing = false;
  _panning = false;
  if (_cropDragHandle) _cropDragHandle = '';
  stopSplitDrag();
}

// ====== Keyboard ======
function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el === textInputRef.value) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function adjustCanvasZoom(multiplier: number) {
  canvasZoom.value = Math.max(0.2, Math.min(5, canvasZoom.value * multiplier));
}

function resetCanvasView() {
  canvasZoom.value = 1;
  canvasPan.value = { x: 0, y: 0 };
}

function handleEditorKeyDown(e: KeyboardEvent) {
  const isMeta = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const typing = isTypingTarget(e.target);

  if (isMeta && key === 'z') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.shiftKey) drawRedo();
    else drawUndo();
    return;
  }

  if (isMeta && key === 'y') {
    e.preventDefault();
    e.stopImmediatePropagation();
    drawRedo();
    return;
  }

  if (typing) {
    if (e.key === 'Escape' && textInput.value.visible) {
      e.preventDefault();
      cancelText();
      setDrawTool('select');
    }
    return;
  }

  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    _spacePanning = true;
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    if (textInput.value.visible) {
      cancelText();
    } else if (activeElementId.value) {
      activeElementId.value = null;
      clearOverlay();
    } else if (drawTool.value === 'crop' && cropRect.value.w > 0) {
      cropRect.value = { x: 0, y: 0, w: 0, h: 0 };
      clearOverlay();
    } else if (drawTool.value !== 'select') {
      setDrawTool('select');
    } else {
      handleClose();
    }
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && activeElementId.value && !typing) {
    e.preventDefault();
    saveToHistory();
    drawElements.value = drawElements.value.filter(el => el.id !== activeElementId.value);
    activeElementId.value = null;
    isDirty.value = true;
    clearOverlay();
    renderDrawLayer();
    return;
  }

  if (e.key === 'Enter') {
    if (drawTool.value === 'crop' && cropRect.value.w >= 4 && cropRect.value.h >= 4) {
      e.preventDefault();
      applyCropSelection();
      return;
    }
    if (drawTool.value === 'expand' && (expandDrag.value.top || expandDrag.value.bottom || expandDrag.value.left || expandDrag.value.right)) {
      e.preventDefault();
      applyExpand();
      return;
    }
  }

  if (key === '0') {
    e.preventDefault();
    resetCanvasView();
    return;
  }

  if (key === '=' || key === '+') {
    e.preventDefault();
    adjustCanvasZoom(1.1);
    return;
  }

  if (key === '-') {
    e.preventDefault();
    adjustCanvasZoom(0.9);
    return;
  }

  if (key === '[' || key === '【') {
    e.preventDefault();
    drawSize.value = Math.max(1, drawSize.value - 2);
    return;
  }
  if (key === ']' || key === '】') {
    e.preventDefault();
    drawSize.value = Math.min(100, drawSize.value + 2);
    return;
  }

  const toolMap: Partial<Record<string, DrawTool>> = {
    v: 'select',
    b: 'pencil',
    e: 'eraser',
    i: 'eyedropper',
    u: 'arrow',
    t: 'text',
    o: 'circle',
    r: 'rect',
    c: 'crop',
    x: 'expand',
    s: 'split',
    m: 'compress',
  };

  if (!isMeta && key === 'p') {
    e.preventDefault();
    pressureEnabled.value = !pressureEnabled.value;
    return;
  }

  if (!isMeta) {
    const nextTool = toolMap[key];
    if (nextTool) {
      e.preventDefault();
      setDrawTool(nextTool);
    }
  }
}

function handleEditorKeyUp(e: KeyboardEvent) {
  if (e.code !== 'Space') return;
  _spacePanning = false;
  if (_panning) {
    _panning = false;
    endPointerTracking();
  }
}

// ====== Crop tool ======
function setCropRatio(r: { label: string; w: number; h: number }) {
  activeCropRatio.value = r.label;
  if (r.w > 0 && r.h > 0 && cropRect.value.w > 0) {
    const centerX = cropRect.value.x + cropRect.value.w / 2;
    const centerY = cropRect.value.y + cropRect.value.h / 2;
    const newW = cropRect.value.w;
    const newH = (newW * r.h) / r.w;
    cropRect.value = { x: centerX - newW / 2, y: centerY - newH / 2, w: newW, h: newH };
    renderCropOverlay();
  }
}

function renderCropOverlay() {
  const overlay = overlayCanvasRef.value;
  if (!overlay) return;
  const ctx = overlay.getContext('2d')!;
  const { x, y, w, h } = cropRect.value;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (w < 2 || h < 2) return;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, overlay.width, y);
  ctx.fillRect(0, y + h, overlay.width, overlay.height - y - h);
  ctx.fillRect(0, y, x, h);
  ctx.fillRect(x + w, y, overlay.width - x - w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);

  const hs = 8;
  const handles = getCropHandles(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (const { x: hx, y: hy } of handles) {
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  const label = `${Math.round(w)} × ${Math.round(h)}`;
  ctx.font = 'bold 12px sans-serif';
  const tw = ctx.measureText(label).width;
  ctx.fillRect(x + w / 2 - tw / 2 - 4, y + h / 2 - 8, tw + 8, 20);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x + w / 2 - tw / 2, y + h / 2 + 6);
}

function handleCropMouseDown(e: PointerEvent, coords: { x: number; y: number }) {
  const { x, y, w, h } = cropRect.value;
  const hit = getCropHandleAt(coords);
  if (hit.name && hit.name !== 'new') {
    _cropDragHandle = hit.name;
    _cropDragStart = { mx: coords.x, my: coords.y, rx: x, ry: y, rw: w, rh: h };
    return;
  }
  _cropDragHandle = 'new';
  cropRect.value = { x: coords.x, y: coords.y, w: 0, h: 0 };
  _cropDragStart = { mx: coords.x, my: coords.y, rx: coords.x, ry: coords.y, rw: 0, rh: 0 };
}

function handleCropMouseMove(e: PointerEvent) {
  const coords = getCanvasCoords(e);
  const dx = coords.x - _cropDragStart.mx;
  const dy = coords.y - _cropDragStart.my;
  const canvas = editCanvasRef.value;
  if (!canvas) return;

  if (_cropDragHandle === 'new') {
    const rect = normalizeRect(_cropDragStart.mx, _cropDragStart.my, coords.x, coords.y);
    cropRect.value = activeCropRatio.value ? applyCropRatioToRect(rect) : clampCropRect(rect);
    renderCropOverlay();
    return;
  }

  let newRect = { ..._cropDragStart };
  if (_cropDragHandle === 'body') {
    const maxX = canvas.width - newRect.rw;
    const maxY = canvas.height - newRect.rh;
    newRect.rx = Math.max(0, Math.min(newRect.rx + dx, maxX));
    newRect.ry = Math.max(0, Math.min(newRect.ry + dy, maxY));
  } else if (_cropDragHandle.includes('l')) {
    newRect.rx += dx; newRect.rw -= dx;
  } else if (_cropDragHandle.includes('r')) {
    newRect.rw += dx;
  }
  if (_cropDragHandle.includes('t')) {
    newRect.ry += dy; newRect.rh -= dy;
  } else if (_cropDragHandle.includes('b')) {
    newRect.rh += dy;
  }
  if (newRect.rw < 0) { newRect.rx += newRect.rw; newRect.rw = Math.abs(newRect.rw); }
  if (newRect.rh < 0) { newRect.ry += newRect.rh; newRect.rh = Math.abs(newRect.rh); }

  const rect = clampCropRect({ x: newRect.rx, y: newRect.ry, w: newRect.rw, h: newRect.rh });
  cropRect.value = { x: rect.x, y: rect.y, w: Math.max(4, rect.w), h: Math.max(4, rect.h) };
  renderCropOverlay();
}

function getCropHandles(x: number, y: number, w: number, h: number) {
  return [
    { name: 'tl', x, y }, { name: 'tc', x: x + w / 2, y }, { name: 'tr', x: x + w, y },
    { name: 'ml', x, y: y + h / 2 }, { name: 'mr', x: x + w, y: y + h / 2 },
    { name: 'bl', x, y: y + h }, { name: 'bc', x: x + w / 2, y: y + h }, { name: 'br', x: x + w, y: y + h },
  ];
}

function getCropHandleAt(coords: { x: number; y: number }) {
  const { x, y, w, h } = cropRect.value;
  if (w <= 0 || h <= 0) return { name: 'new' };

  const edgeBand = Math.min(10, Math.max(4, Math.min(w, h) / 4));
  const insideBody =
    coords.x >= x + edgeBand &&
    coords.x <= x + w - edgeBand &&
    coords.y >= y + edgeBand &&
    coords.y <= y + h - edgeBand;

  if (insideBody) {
    return { name: 'body' };
  }

  const hs = Math.min(6, Math.max(4, Math.min(w, h) / 6));
  for (const handle of getCropHandles(x, y, w, h)) {
    if (Math.abs(coords.x - handle.x) <= hs && Math.abs(coords.y - handle.y) <= hs) {
      return { name: handle.name };
    }
  }
  if (coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h) {
    return { name: 'body' };
  }
  return { name: 'new' };
}

function resolveCropCursor(handle: string) {
  if (handle === 'body') return 'move';
  if (handle === 'tc' || handle === 'bc') return 'ns-resize';
  if (handle === 'ml' || handle === 'mr') return 'ew-resize';
  if (handle === 'tl' || handle === 'br') return 'nwse-resize';
  if (handle === 'tr' || handle === 'bl') return 'nesw-resize';
  return 'crosshair';
}

function applyCropSelection() {
  const canvas = editCanvasRef.value;
  const overlay = overlayCanvasRef.value;
  if (!canvas || !overlay) return;
  const { x, y, w, h } = cropRect.value;
  if (w < 4 || h < 4) return;

  saveToHistory();
  isDirty.value = true;

  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(x, y, w, h);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(imageData, 0, 0);

  // Adjust draw elements offset
  drawElements.value.forEach(el => {
    el.offsetX -= x;
    el.offsetY -= y;
  });

  cropRect.value = { x: 0, y: 0, w: 0, h: 0 };
  syncAllLayers();
  ElMessage.success('裁剪已应用');
}

return {
  overlayRef,
  Image,
  X,
  editorImageLoading,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Sun,
  Contrast,
  Droplets,
  Pencil,
  Type,
  ArrowRight,
  Circle,
  Square,
  Eraser,
  MousePointer,
  Scissors,
  Crop,
  Pipette,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  editCanvasRef,
  drawLayerRef,
  overlayCanvasRef,
  cursorCanvasRef,
  textInputRef,
  colorPickerEl,
  editImageInfo,
  editFileSizeText,
  imgAdjust,
  activeCropRatio,
  cropRatios,
  cropRect,
  drawTool,
  drawColor,
  drawSize,
  drawOpacity,
  textColorOpacity,
  textBgOpacity,
  textShowBackground,
  pressureEnabled,
  drawHistory,
  drawFuture,
  textInput,
  isDirty,
  drawElements,
  activeElementId,
  canvasZoom,
  canvasPan,
  brushCursorPos,
  brushCursorStyle,
  showBrushProps,
  canvasZoomStyle,
  expandDrag,
  expandColor,
  expandRatio,
  expandInfo,
  expandSummary,
  canApplyExpand,
  isExpandReady,
  expandCursor,
  toolsCollapsed,
  expandRatios,
  drawTools,
  canvasCursor,
  initColorPicker,
  initExpandColorPicker,
  bindExpandColorPickerEl,
  loadImageToCanvas,
  renderImageToCanvas,
  applyCanvasFilters,
  syncAllLayers,
  syncCursorLayerSize,
  syncOverlay,
  syncDrawLayerSize,
  clearBrushCursor,
  clearOverlay,
  renderDrawLayer,
  drawArrowHelper,
  drawShapePreview,
  hitTestElement,
  pointToSegmentDist,
  findHitElement,
  getElementBBox,
  renderSelectionBox,
  applyImageFilters,
  rotateImage,
  flipImage,
  handleClose,
  resetImageEdit,
  prepareEditedImageDragOut,
  handleEditedImageDragOutStart,
  handleEditedImageDragOutEnd,
  applyImageEdit,
  setDrawTool,
  onCanvasWheel,
  createEditorSnapshot,
  restoreEditorSnapshot,
  saveToHistory,
  drawUndo,
  drawRedo,
  commitText,
  cancelText,
  onTextKeyDown,
  autoFitHeight,
  onTextInputInput,
  onCornerPointerDown,
  onEdgePointerDown,
  textResizing,
  textMoving,
  textBgColorPickerEl,
  textColorPickerEl,
  setTextBgColor,
  setTextColor,
  TEXT_BG_PRESETS,
  TEXT_COLOR_PRESETS,
  selectedTextToolbarStyle,
  deleteActiveTextElement,
  setActiveTextBgColor,
  editActiveTextElement,
  clampToCanvas,
  normalizeRect,
  clampCropRect,
  applyCropRatioToRect,
  getCanvasCoords,
  getCanvasDisplayCoords,
  beginPointerTracking,
  endPointerTracking,
  onCanvasWrapMouseDown,
  onCanvasWrapMouseMove,
  onCanvasWrapMouseLeave,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasMouseLeave,
  isTypingTarget,
  adjustCanvasZoom,
  resetCanvasView,
  handleEditorKeyDown,
  handleEditorKeyUp,
  setCropRatio,
  renderCropOverlay,
  handleCropMouseDown,
  handleCropMouseMove,
  applyCropSelection,
  setExpandRatio,
  setExpandInset,
  restoreExpandSnapshot,
  renderExpandOverlay,
  handleExpandMouseDown,
  handleExpandMouseMove,
  stopExpandDrag,
  clearExpandHover,
  resetExpandDrag,
  deactivateExpandPreview,
  applyExpand,
  splitConfig,
  splitting,
  splitUploadProgress,
  splitHoverLine,
  splitCursor,
  customRows,
  customCols,
  maxSplitDimension,
  SPLIT_MODES,
  setSplitMode,
  applyCustomSplitMode,
  applyCustomRows,
  applyCustomCols,
  renderSplitOverlay,
  handleSplitMouseDown,
  handleSplitMouseMove,
  stopSplitDrag,
  applySplit,
  resetSplitState,
  compressRows: compressWorkbench.sortedRows,
  compressSelectedRow: compressWorkbench.selectedRow,
  compressSelectedRowId: compressWorkbench.selectedRowId,
  compressProcessDisabled: computed(() => compressWorkbench.processing.value || !compressWorkbench.canvasReady.value),
  compressProcessMode: compressWorkbench.activeProcessMode,
  compressShowModeSwitch: computed(() => !compressWorkbench.isSingleRowScenario.value && !compressWorkbench.useSourceWidth.value),
  compressTargetWidthInput: compressWorkbench.targetWidthInput,
  compressTargetHeightInput: compressWorkbench.targetHeightInput,
  compressQuality: compressWorkbench.quality,
  compressLockRatio: compressWorkbench.lockRatio,
  compressActiveRatioLabel: compressWorkbench.activeRatioLabel,
  compressUseSourceWidth: compressWorkbench.useSourceWidth,
  compressRatioPresets: compressWorkbench.ratioPresets,
  compressProcessing: compressWorkbench.processing,
  compressProcessActionLabel: compressWorkbench.processActionLabel,
  compressCurrentSourceWidth: compressWorkbench.currentSourceWidth,
  canApplyCompression: compressWorkbench.canApplyCompression,
  setCompressSelectedRowId: (value: string) => { compressWorkbench.selectedRowId.value = value; },
  setCompressProcessMode: compressWorkbench.setProcessMode,
  setCompressTargetWidthInput: (value: string) => { compressWorkbench.targetWidthInput.value = value; },
  setCompressTargetHeightInput: (value: string) => { compressWorkbench.targetHeightInput.value = value; },
  setCompressQuality: (value: number) => { compressWorkbench.quality.value = value; },
  setCompressLockRatio: (value: boolean) => { compressWorkbench.lockRatio.value = value; },
  setCompressUseSourceWidth: (value: boolean) => { compressWorkbench.useSourceWidth.value = value; },
  applyCompressRatioPreset: compressWorkbench.applyRatioPreset,
  processCompressRows: compressWorkbench.processRows,
}
}
