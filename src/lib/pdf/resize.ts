import {
  PDFDocument,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from 'pdf-lib'
import type { PDFEmbeddedPage } from 'pdf-lib'
import { loadPdfDocument } from './load'

export const MM_TO_PT = 72 / 25.4

export const PAPER_OPTIONS = [
  { value: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { value: 'letter', label: 'US Letter', widthMm: 215.9, heightMm: 279.4 },
  { value: 'legal', label: 'US Legal', widthMm: 215.9, heightMm: 355.6 },
  { value: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
  { value: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
] as const

type StandardPreset = (typeof PAPER_OPTIONS)[number]['value']

export type PageSizePreset = StandardPreset | 'custom'
export type PageOrientation = 'portrait' | 'landscape' | 'auto'
export type FitMode = 'fit' | 'fill' | 'stretch'
export type PageRotation = 0 | 90 | 180 | 270

export interface ResizeOptions {
  preset: PageSizePreset
  orientation: PageOrientation
  fit: FitMode
  marginMm: number
  customWidthMm: number
  customHeightMm: number
}

export interface PageGeometry {
  width: number
  height: number
  rotation: number
}

export interface PagePlacement {
  x: number
  y: number
  xScale: number
  yScale: number
  rotate: PageRotation
  clip: { x: number; y: number; width: number; height: number } | null
}

export interface ResizeResult {
  bytes: Uint8Array
  pageCount: number
  firstPageWidth: number
  firstPageHeight: number
  sizeLabel: string
  originalSize: number
  outputSize: number
}

function normalizeRotation(rotation: number): PageRotation {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360
  return normalized as PageRotation
}

function paperOption(preset: StandardPreset) {
  const option = PAPER_OPTIONS.find((paper) => paper.value === preset)
  if (!option) throw new Error(`Unknown paper size: ${preset}`)
  return option
}

export function resolveTargetSize(
  options: ResizeOptions,
  sourceWidth: number,
  sourceHeight: number,
  rotation = 0,
): [number, number] {
  if (options.preset === 'custom') {
    const width = Math.max(1, options.customWidthMm) * MM_TO_PT
    const height = Math.max(1, options.customHeightMm) * MM_TO_PT
    return [width, height]
  }

  const paper = paperOption(options.preset)
  let landscape: boolean

  if (options.orientation === 'auto') {
    const displayedWidth = normalizeRotation(rotation) % 180 === 0 ? sourceWidth : sourceHeight
    const displayedHeight = normalizeRotation(rotation) % 180 === 0 ? sourceHeight : sourceWidth
    landscape = displayedWidth > displayedHeight
  } else {
    landscape = options.orientation === 'landscape'
  }

  const widthMm = landscape ? paper.heightMm : paper.widthMm
  const heightMm = landscape ? paper.widthMm : paper.heightMm

  return [widthMm * MM_TO_PT, heightMm * MM_TO_PT]
}

export function computePlacement(
  geometry: PageGeometry,
  targetWidth: number,
  targetHeight: number,
  fit: FitMode,
  marginPt: number,
): PagePlacement {
  const rotation = normalizeRotation(geometry.rotation)
  const drawRotation = ((360 - rotation) % 360) as PageRotation
  const rotated = drawRotation === 90 || drawRotation === 270

  const effectiveWidth = rotated ? geometry.height : geometry.width
  const effectiveHeight = rotated ? geometry.width : geometry.height

  const maxMargin = Math.max(0, Math.min(targetWidth, targetHeight) / 2 - 1)
  const margin = Math.min(Math.max(marginPt, 0), maxMargin)
  const availableWidth = Math.max(1, targetWidth - margin * 2)
  const availableHeight = Math.max(1, targetHeight - margin * 2)

  let xScale: number
  let yScale: number

  if (fit === 'stretch') {
    xScale = rotated ? availableHeight / geometry.width : availableWidth / geometry.width
    yScale = rotated ? availableWidth / geometry.height : availableHeight / geometry.height
  } else {
    const scale =
      fit === 'fill'
        ? Math.max(availableWidth / effectiveWidth, availableHeight / effectiveHeight)
        : Math.min(availableWidth / effectiveWidth, availableHeight / effectiveHeight)
    xScale = scale
    yScale = scale
  }

  const drawWidth = rotated ? yScale * geometry.height : xScale * geometry.width
  const drawHeight = rotated ? xScale * geometry.width : yScale * geometry.height

  const offsetX = margin + (availableWidth - drawWidth) / 2
  const offsetY = margin + (availableHeight - drawHeight) / 2

  let x = offsetX
  let y = offsetY

  if (drawRotation === 90) {
    x = offsetX + drawWidth
  } else if (drawRotation === 180) {
    x = offsetX + drawWidth
    y = offsetY + drawHeight
  } else if (drawRotation === 270) {
    y = offsetY + drawHeight
  }

  return {
    x,
    y,
    xScale,
    yScale,
    rotate: drawRotation,
    clip:
      fit === 'fill'
        ? { x: margin, y: margin, width: availableWidth, height: availableHeight }
        : null,
  }
}

export function describeTargetSize(options: ResizeOptions): string {
  if (options.preset === 'custom') {
    return `${round(options.customWidthMm)} × ${round(options.customHeightMm)} mm`
  }

  const paper = paperOption(options.preset)
  const orientation =
    options.orientation === 'auto'
      ? 'match page'
      : options.orientation === 'landscape'
        ? 'landscape'
        : 'portrait'

  return `${paper.label} · ${orientation}`
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

async function renderResizedDocument(
  source: PDFDocument,
  options: ResizeOptions,
): Promise<Omit<ResizeResult, 'originalSize'>> {
  const output = await PDFDocument.create()
  const pages = source.getPages()

  if (pages.length === 0) {
    throw new Error('This PDF has no pages.')
  }

  const embeddedPages: Array<PDFEmbeddedPage | null> = pages.map(() => null)
  const embeddableIndexes = pages
    .map((page, index) => (page.node.Contents() === undefined ? -1 : index))
    .filter((index) => index >= 0)

  if (embeddableIndexes.length > 0) {
    const embedded = await output.embedPages(embeddableIndexes.map((index) => pages[index]))
    embeddableIndexes.forEach((pageIndex, index) => {
      embeddedPages[pageIndex] = embedded[index]
    })
  }

  const marginPt = Math.max(0, options.marginMm) * MM_TO_PT

  let firstPageWidth = 0
  let firstPageHeight = 0

  pages.forEach((page, index) => {
    const { width, height } = page.getSize()
    const rotation = page.getRotation().angle
    const [targetWidth, targetHeight] = resolveTargetSize(options, width, height, rotation)
    const placement = computePlacement(
      { width, height, rotation },
      targetWidth,
      targetHeight,
      options.fit,
      marginPt,
    )

    if (index === 0) {
      firstPageWidth = targetWidth
      firstPageHeight = targetHeight
    }

    const outputPage = output.addPage([targetWidth, targetHeight])
    const embeddedPage = embeddedPages[index]

    if (embeddedPage && placement.clip) {
      outputPage.pushOperators(
        pushGraphicsState(),
        rectangle(
          placement.clip.x,
          placement.clip.y,
          placement.clip.width,
          placement.clip.height,
        ),
        clip(),
        endPath(),
      )
    }

    if (embeddedPage) {
      outputPage.drawPage(embeddedPage, {
        x: placement.x,
        y: placement.y,
        xScale: placement.xScale,
        yScale: placement.yScale,
        rotate: degrees(placement.rotate),
      })
    }

    if (embeddedPage && placement.clip) {
      outputPage.pushOperators(popGraphicsState())
    }
  })

  output.setCreator('Sheet PDF Tools')
  output.setProducer('Sheet PDF Tools')

  const bytes = await output.save({ useObjectStreams: true })

  return {
    bytes,
    pageCount: pages.length,
    firstPageWidth,
    firstPageHeight,
    sizeLabel: describeTargetSize(options),
    outputSize: bytes.length,
  }
}

export async function resizePdf(file: File, options: ResizeOptions): Promise<ResizeResult> {
  if (file.size === 0) throw new Error('This file is empty.')
  const source = await loadPdfDocument(file)
  const result = await renderResizedDocument(source, options)
  return { ...result, originalSize: file.size }
}

export async function resizePdfBytes(
  bytes: Uint8Array | ArrayBuffer,
  options: ResizeOptions,
): Promise<ResizeResult> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const result = await renderResizedDocument(source, options)
  const originalSize = bytes instanceof Uint8Array ? bytes.byteLength : bytes.byteLength
  return { ...result, originalSize }
}
