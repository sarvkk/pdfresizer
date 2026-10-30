import { PDFDocument } from 'pdf-lib'

export type FlattenQuality = 'screen' | 'balanced' | 'print'

export interface FlattenQualityInfo {
  dpi: number
  jpegQuality: number
  label: string
  hint: string
}

export const FLATTEN_QUALITY: Record<FlattenQuality, FlattenQualityInfo> = {
  screen: {
    dpi: 150,
    jpegQuality: 0.82,
    label: 'Screen',
    hint: 'Best for on-screen reading',
  },
  balanced: {
    dpi: 200,
    jpegQuality: 0.9,
    label: 'Balanced',
    hint: 'Sharp text without huge files',
  },
  print: {
    dpi: 300,
    jpegQuality: 0.94,
    label: 'Print',
    hint: 'Sharpest output for printing',
  },
}

// Browsers cap canvas dimensions and memory. A4 at 300 DPI is about 8.7 MP;
// these ceilings only kick in for unusually large page sizes.
export const MAX_RENDER_EDGE = 8192
export const MAX_RENDER_PIXELS = 16_000_000

export interface RenderGeometry {
  width: number
  height: number
  scale: number
  dpi: number
}

export interface RenderedPage {
  bytes: Uint8Array
  width: number
  height: number
}

export interface FlattenResult {
  bytes: Uint8Array
  pageCount: number
  dpi: number
  quality: FlattenQuality
  originalSize: number
  outputSize: number
}

export interface FlattenProgress {
  done: number
  total: number
}

export function computeRenderGeometry(
  widthPt: number,
  heightPt: number,
  dpi: number,
  maxEdge = MAX_RENDER_EDGE,
  maxPixels = MAX_RENDER_PIXELS,
): RenderGeometry {
  const width = Math.max(1, widthPt)
  const height = Math.max(1, heightPt)
  const requestedScale = Math.max(0.01, dpi / 72)
  const edgeScale = maxEdge / Math.max(width, height)
  const pixelScale = Math.sqrt(maxPixels / (width * height))
  const scale = Math.max(0.01, Math.min(requestedScale, edgeScale, pixelScale))

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
    dpi: Math.round(scale * 72),
  }
}

export async function assembleFlattenedPdf(
  pages: readonly RenderedPage[],
): Promise<Uint8Array> {
  if (pages.length === 0) {
    throw new Error('There are no pages to flatten.')
  }

  const output = await PDFDocument.create()

  for (const page of pages) {
    const image = await output.embedJpg(page.bytes)
    const outputPage = output.addPage([page.width, page.height])
    outputPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    })
  }

  output.setCreator('Sheet PDF Tools')
  output.setProducer('Sheet PDF Tools')

  return output.save({ useObjectStreams: true })
}

export async function flattenPdf(
  file: File,
  quality: FlattenQuality = 'balanced',
  onProgress?: (progress: FlattenProgress) => void,
): Promise<FlattenResult> {
  const originalSize = file.size
  const data = new Uint8Array(await file.arrayBuffer())
  const settings = FLATTEN_QUALITY[quality]

  // pdf.js touches the DOM (canvas, worker), so it is loaded only when the
  // user actually runs a flatten job instead of on every page view.
  const { renderPdfPages } = await import('./renderPdfPages')

  const rendered = await renderPdfPages(data, {
    dpi: settings.dpi,
    jpegQuality: settings.jpegQuality,
    onProgress: (progress) => onProgress?.(progress),
  })

  const bytes = await assembleFlattenedPdf(rendered)

  return {
    bytes,
    pageCount: rendered.length,
    dpi: settings.dpi,
    quality,
    originalSize,
    outputSize: bytes.length,
  }
}
