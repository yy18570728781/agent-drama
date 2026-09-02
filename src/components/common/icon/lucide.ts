import lucideIconsData from '@iconify-json/lucide/icons.json'
import type { IconifyIcon, IconifyJSON } from '@iconify/types'
import { defineComponent, h, mergeProps } from 'vue'

type LucideIconData = IconifyIcon & {
  parent?: string
  left?: number
  top?: number
  width?: number
  height?: number
  hFlip?: boolean
  vFlip?: boolean
  rotate?: number
}

type ResolvedLucideIcon = {
  body: string
  left: number
  top: number
  width: number
  height: number
}

type LucideIconifyData = IconifyJSON & {
  aliases?: Record<string, LucideIconData>
}

const defaultViewBoxSize = 24
const lucideData = lucideIconsData as unknown as LucideIconifyData
const lucideIconSet = {
  ...(lucideData.icons as Record<string, LucideIconData>),
  ...((lucideData.aliases ?? {}) as Record<string, LucideIconData>),
}
const namePattern = /[A-Z]?[a-z]+|[0-9]+x[0-9]+|[0-9]+|[A-Z]+(?![a-z])/g
const iconCache = new Map<string, ResolvedLucideIcon>()

function toLucideIconName(exportName: string): string {
  const segments = exportName.match(namePattern)
  if (!segments) {
    return exportName.toLowerCase()
  }

  return segments.map((segment) => segment.toLowerCase()).join('-')
}

function normalizeRotation(rotate: number | undefined): number {
  return ((rotate ?? 0) % 4 + 4) % 4
}

function resolveIconData(exportName: string, iconName: string, seen = new Set<string>()): LucideIconData {
  if (seen.has(iconName)) {
    throw new Error(`Circular lucide alias: ${exportName} -> ${iconName}`)
  }

  const rawIcon = lucideIconSet[iconName]

  if (!rawIcon) {
    throw new Error(`Unknown lucide icon export: ${exportName} -> ${iconName}`)
  }

  if (!rawIcon.parent) {
    return {
      ...rawIcon,
      body: rawIcon.body ?? '',
      left: rawIcon.left ?? 0,
      top: rawIcon.top ?? 0,
      width: rawIcon.width ?? defaultViewBoxSize,
      height: rawIcon.height ?? defaultViewBoxSize,
      hFlip: Boolean(rawIcon.hFlip),
      vFlip: Boolean(rawIcon.vFlip),
      rotate: normalizeRotation(rawIcon.rotate),
    }
  }

  seen.add(iconName)
  const parentIcon = resolveIconData(exportName, rawIcon.parent, seen)

  return {
    ...parentIcon,
    ...rawIcon,
    body: rawIcon.body ?? parentIcon.body,
    left: rawIcon.left ?? parentIcon.left ?? 0,
    top: rawIcon.top ?? parentIcon.top ?? 0,
    width: rawIcon.width ?? parentIcon.width ?? defaultViewBoxSize,
    height: rawIcon.height ?? parentIcon.height ?? defaultViewBoxSize,
    hFlip: Boolean(parentIcon.hFlip) !== Boolean(rawIcon.hFlip),
    vFlip: Boolean(parentIcon.vFlip) !== Boolean(rawIcon.vFlip),
    rotate: normalizeRotation((parentIcon.rotate ?? 0) + (rawIcon.rotate ?? 0)),
  }
}

function applyIconTransforms(icon: LucideIconData): string {
  const transforms: string[] = []
  const left = icon.left ?? 0
  const top = icon.top ?? 0
  const width = icon.width ?? defaultViewBoxSize
  const height = icon.height ?? defaultViewBoxSize
  const centerX = left + width / 2
  const centerY = top + height / 2

  if (icon.hFlip) {
    transforms.push(`translate(${left * 2 + width} 0) scale(-1 1)`)
  }

  if (icon.vFlip) {
    transforms.push(`translate(0 ${top * 2 + height}) scale(1 -1)`)
  }

  if (icon.rotate === 1) {
    transforms.unshift(`rotate(90 ${centerX} ${centerY})`)
  } else if (icon.rotate === 2) {
    transforms.unshift(`rotate(180 ${centerX} ${centerY})`)
  } else if (icon.rotate === 3) {
    transforms.unshift(`rotate(-90 ${centerX} ${centerY})`)
  }

  if (!transforms.length) {
    return icon.body ?? ''
  }

  return `<g transform="${transforms.join(' ')}">${icon.body ?? ''}</g>`
}

function resolveIcon(exportName: string, strokeWidth: number | string): ResolvedLucideIcon {
  const iconName = toLucideIconName(exportName)
  const cacheKey = `${iconName}:${strokeWidth}`
  const cachedIcon = iconCache.get(cacheKey)

  if (cachedIcon) {
    return cachedIcon
  }

  const baseIcon = resolveIconData(exportName, iconName)
  const transformedBody = applyIconTransforms(baseIcon)

  const resolvedIcon = String(strokeWidth) === '2'
    ? {
        body: transformedBody,
        left: baseIcon.left ?? 0,
        top: baseIcon.top ?? 0,
        width: baseIcon.width ?? defaultViewBoxSize,
        height: baseIcon.height ?? defaultViewBoxSize,
      }
    : {
        body: transformedBody.replace(/stroke-width="[^"]+"/g, `stroke-width="${strokeWidth}"`),
        left: baseIcon.left ?? 0,
        top: baseIcon.top ?? 0,
        width: baseIcon.width ?? defaultViewBoxSize,
        height: baseIcon.height ?? defaultViewBoxSize,
      }

  iconCache.set(cacheKey, resolvedIcon)

  return resolvedIcon
}

function createLucideIcon(exportName: string) {
  return defineComponent({
    name: exportName,
    inheritAttrs: false,
    props: {
      size: {
        type: [Number, String],
        default: 24,
      },
      color: {
        type: String,
        default: undefined,
      },
      strokeWidth: {
        type: [Number, String],
        default: 2,
      },
      absoluteStrokeWidth: {
        type: Boolean,
        default: false,
      },
    },
    setup(props, { attrs }) {
      const iconName = toLucideIconName(exportName)

      return () => {
        const numericSize = typeof props.size === 'number' ? props.size : Number(props.size)
        const numericStrokeWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : Number(props.strokeWidth)
        const resolvedStrokeWidth = props.absoluteStrokeWidth && Number.isFinite(numericSize) && numericSize > 0 && Number.isFinite(numericStrokeWidth)
          ? (numericStrokeWidth * defaultViewBoxSize) / numericSize
          : props.strokeWidth
        const icon = resolveIcon(exportName, resolvedStrokeWidth)

        return h('svg', mergeProps({
          xmlns: 'http://www.w3.org/2000/svg',
          width: props.size,
          height: props.size,
          viewBox: `${icon.left} ${icon.top} ${icon.width} ${icon.height}`,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': resolvedStrokeWidth,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          class: ['lucide', `lucide-${iconName}`],
          style: {
            color: props.color,
            display: 'inline-block',
            flexShrink: 0,
            verticalAlign: 'middle',
          },
          innerHTML: icon.body,
        }, attrs))
      }
    },
  })
}

export const AlignStartHorizontal = createLucideIcon('AlignStartHorizontal')
export const AlignCenterHorizontal = createLucideIcon('AlignCenterHorizontal')
export const AlignEndHorizontal = createLucideIcon('AlignEndHorizontal')
export const AlignStartVertical = createLucideIcon('AlignStartVertical')
export const AlignCenterVertical = createLucideIcon('AlignCenterVertical')
export const AlignEndVertical = createLucideIcon('AlignEndVertical')
export const AlignHorizontalDistributeCenter = createLucideIcon('AlignHorizontalDistributeCenter')
export const History = createLucideIcon('History')
export const Heart = createLucideIcon('Heart')
export const HeartOff = createLucideIcon('HeartOff')
export const Home = createLucideIcon('Home')
export const AlignVerticalDistributeCenter = createLucideIcon('AlignVerticalDistributeCenter')
export const Activity = createLucideIcon('Activity')
export const AlertCircle = createLucideIcon('AlertCircle')
export const ArrowDownWideNarrow = createLucideIcon('ArrowDownWideNarrow')
export const ArrowDownLeft = createLucideIcon('ArrowDownLeft')
export const ArrowDownToLine = createLucideIcon('ArrowDownToLine')
export const ArrowLeft = createLucideIcon('ArrowLeft')
export const ArrowLeftRight = createLucideIcon('ArrowLeftRight')
export const ArrowDown = createLucideIcon('ArrowDown')
export const ArrowRight = createLucideIcon('ArrowRight')
export const ArrowUp = createLucideIcon('ArrowUp')
export const ArrowUpDown = createLucideIcon('ArrowUpDown')
export const ArrowUpWideNarrow = createLucideIcon('ArrowUpWideNarrow')
export const ArrowUpRight = createLucideIcon('ArrowUpRight')
export const ArrowUpToLine = createLucideIcon('ArrowUpToLine')
export const AudioLines = createLucideIcon('AudioLines')
export const Bookmark = createLucideIcon('Bookmark')
export const Bot = createLucideIcon('Bot')
export const Box = createLucideIcon('Box')
export const Brush = createLucideIcon('Brush')
export const Bug = createLucideIcon('Bug')
export const Building2 = createLucideIcon('Building2')
export const Calendar = createLucideIcon('Calendar')
export const Camera = createLucideIcon('Camera')
export const Check = createLucideIcon('Check')
export const Key = createLucideIcon('Key')
export const CircleCheckBig = createLucideIcon('CircleCheckBig')
export const CheckCircle2 = createLucideIcon('CheckCircle2')
export const ChevronDown = createLucideIcon('ChevronDown')
export const ChevronUp = createLucideIcon('ChevronUp')
export const ChevronLeft = createLucideIcon('ChevronLeft')
export const ChevronRight = createLucideIcon('ChevronRight')
export const ChevronsLeft = createLucideIcon('ChevronsLeft')
export const ChevronsRight = createLucideIcon('ChevronsRight')
export const Circle = createLucideIcon('Circle')
export const CircleStop = createLucideIcon('CircleStop')
export const CircleX = createLucideIcon('CircleX')
export const ClipboardList = createLucideIcon('ClipboardList')
export const Contrast = createLucideIcon('Contrast')
export const Copy = createLucideIcon('Copy')
export const Cpu = createLucideIcon('Cpu')
export const Crop = createLucideIcon('Crop')
export const Database = createLucideIcon('Database')
export const Download = createLucideIcon('Download')
export const Droplet = createLucideIcon('Droplet')
export const Droplets = createLucideIcon('Droplets')
export const Edit2 = createLucideIcon('Edit2')
export const Edit3 = createLucideIcon('Edit3')
export const Eraser = createLucideIcon('Eraser')
export const Expand = createLucideIcon('Expand')
export const Eye = createLucideIcon('Eye')
export const FileText = createLucideIcon('FileText')
export const Film = createLucideIcon('Film')
export const FlipHorizontal2 = createLucideIcon('FlipHorizontal2')
export const FlipVertical2 = createLucideIcon('FlipVertical2')
export const Folder = createLucideIcon('Folder')
export const FolderEdit = createLucideIcon('FolderEdit')
export const FolderOpen = createLucideIcon('FolderOpen')
export const FolderPlus = createLucideIcon('FolderPlus')
export const Globe = createLucideIcon('Globe')
export const Grid = createLucideIcon('Grid')
export const Grid3x3 = createLucideIcon('Grid3x3')
export const GripHorizontal = createLucideIcon('GripHorizontal')
export const Hand = createLucideIcon('Hand')
export const HardDrive = createLucideIcon('HardDrive')
export const Image = createLucideIcon('Image')
export const ImageDown = createLucideIcon('ImageDown')
export const ImagePlus = createLucideIcon('ImagePlus')
export const Inbox = createLucideIcon('Inbox')
export const Info = createLucideIcon('Info')
export const Keyboard = createLucideIcon('Keyboard')
export const Layers = createLucideIcon('Layers')
export const Layout = createLucideIcon('Layout')
export const Link = createLucideIcon('Link')
export const Link2 = createLucideIcon('Link2')
export const List = createLucideIcon('List')
export const LoaderCircle = createLucideIcon('LoaderCircle')
export const Loader2 = createLucideIcon('Loader2')
export const MapIcon = createLucideIcon('Map')
export const MapPin = createLucideIcon('MapPin')
export const Merge = createLucideIcon('Merge')
export const Network = createLucideIcon('Network')
export const LayoutGrid = createLucideIcon('LayoutGrid')
export const Maximize = createLucideIcon('Maximize')
export const Maximize2 = createLucideIcon('Maximize2')
export const MessageSquare = createLucideIcon('MessageSquare')
export const Minimize2 = createLucideIcon('Minimize2')
export const Minus = createLucideIcon('Minus')
export const Monitor = createLucideIcon('Monitor')
export const MoreHorizontal = createLucideIcon('MoreHorizontal')
export const MousePointer = createLucideIcon('MousePointer')
export const Music = createLucideIcon('Music')
export const Package = createLucideIcon('Package')
export const Palette = createLucideIcon('Palette')
export const Paperclip = createLucideIcon('Paperclip')
export const Pencil = createLucideIcon('Pencil')
export const PenLine = createLucideIcon('PenLine')
export const PenTool = createLucideIcon('PenTool')
export const Play = createLucideIcon('Play')
export const Pause = createLucideIcon('Pause')
export const Plus = createLucideIcon('Plus')
export const Power = createLucideIcon('Power')
export const RectangleHorizontal = createLucideIcon('RectangleHorizontal')
export const Redo2 = createLucideIcon('Redo2')
export const RefreshCcw = createLucideIcon('RefreshCcw')
export const RefreshCw = createLucideIcon('RefreshCw')
export const Repeat = createLucideIcon('Repeat')
export const RotateCcw = createLucideIcon('RotateCcw')
export const RotateCw = createLucideIcon('RotateCw')
export const Save = createLucideIcon('Save')
export const Scan = createLucideIcon('Scan')
export const Scissors = createLucideIcon('Scissors')
export const Search = createLucideIcon('Search')
export const Send = createLucideIcon('Send')
export const SendHorizontal = createLucideIcon('SendHorizontal')
export const Server = createLucideIcon('Server')
export const Settings = createLucideIcon('Settings')
export const Settings2 = createLucideIcon('Settings2')
export const Share2 = createLucideIcon('Share2')
export const Shield = createLucideIcon('Shield')
export const SlidersHorizontal = createLucideIcon('SlidersHorizontal')
export const Sparkles = createLucideIcon('Sparkles')
export const Square = createLucideIcon('Square')
export const Star = createLucideIcon('Star')
export const Sun = createLucideIcon('Sun')
export const Terminal = createLucideIcon('Terminal')
export const Trash2 = createLucideIcon('Trash2')
export const TriangleAlert = createLucideIcon('TriangleAlert')
export const Type = createLucideIcon('Type')
export const Undo2 = createLucideIcon('Undo2')
export const Upload = createLucideIcon('Upload')
export const User = createLucideIcon('User')
export const Users = createLucideIcon('Users')
export const UserRound = createLucideIcon('UserRound')
export const UserRoundPlus = createLucideIcon('UserRoundPlus')
export const UserSquare = createLucideIcon('UserSquare')
export const Video = createLucideIcon('Video')
export const VolumeX = createLucideIcon('VolumeX')
export const Wallet = createLucideIcon('Wallet')
export const Wand2 = createLucideIcon('Wand2')
export const Wind = createLucideIcon('Wind')
export const Workflow = createLucideIcon('Workflow')
export const X = createLucideIcon('X')
export const Zap = createLucideIcon('Zap')
export const Pipette = createLucideIcon('Pipette')
export const SquarePen = createLucideIcon('SquarePen')
