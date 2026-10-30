import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, degrees } from 'pdf-lib'
import {
  MM_TO_PT,
  computePlacement,
  describeTargetSize,
  resizePdfBytes,
  resolveTargetSize,
  type ResizeOptions,
} from '../src/lib/pdf/resize'
import { parsePageRange } from '../src/lib/pdf/split'
import {
  FLATTEN_QUALITY,
  MAX_RENDER_EDGE,
  MAX_RENDER_PIXELS,
  assembleFlattenedPdf,
  computeRenderGeometry,
} from '../src/lib/pdf/flatten'

const A4_WIDTH = 210 * MM_TO_PT
const A4_HEIGHT = 297 * MM_TO_PT

const baseOptions: ResizeOptions = {
  preset: 'a4',
  orientation: 'auto',
  fit: 'fit',
  marginMm: 0,
  customWidthMm: 210,
  customHeightMm: 297,
}

function close(actual: number, expected: number, tolerance = 0.1): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

test('parsePageRange handles commas, ranges, and duplicates', () => {
  assert.deepEqual(parsePageRange('1-3, 5, 8-10', 12), [1, 2, 3, 5, 8, 9, 10])
  assert.deepEqual(parsePageRange('5, 3, 5, 1', 8), [1, 3, 5])
  assert.deepEqual(parsePageRange('8-5', 10), [5, 6, 7, 8])
  assert.deepEqual(parsePageRange('0, 12, 99', 10), [])
  assert.deepEqual(parsePageRange('', 10), [])
})

test('resolveTargetSize follows the requested paper and orientation', () => {
  const portrait = resolveTargetSize(baseOptions, 612, 792)
  close(portrait[0], A4_WIDTH)
  close(portrait[1], A4_HEIGHT)

  const landscape = resolveTargetSize(
    { ...baseOptions, orientation: 'landscape' },
    612,
    792,
  )
  close(landscape[0], A4_HEIGHT)
  close(landscape[1], A4_WIDTH)

  const autoLandscape = resolveTargetSize(baseOptions, 792, 612)
  close(autoLandscape[0], A4_HEIGHT)
  close(autoLandscape[1], A4_WIDTH)

  const custom = resolveTargetSize(
    { ...baseOptions, preset: 'custom', customWidthMm: 100, customHeightMm: 200 },
    612,
    792,
  )
  close(custom[0], 100 * MM_TO_PT)
  close(custom[1], 200 * MM_TO_PT)
})

test('computePlacement fits, fills, and clips correctly', () => {
  const fit = computePlacement({ width: 612, height: 792, rotation: 0 }, A4_WIDTH, A4_HEIGHT, 'fit', 0)
  const fitScale = A4_WIDTH / 612
  close(fit.x, 0)
  close(fit.y, (A4_HEIGHT - 792 * fitScale) / 2)
  close(fit.xScale, fitScale, 0.0001)
  close(fit.yScale, fitScale, 0.0001)
  assert.equal(fit.rotate, 0)
  assert.equal(fit.clip, null)

  const fill = computePlacement({ width: 612, height: 792, rotation: 0 }, A4_WIDTH, A4_HEIGHT, 'fill', 0)
  close(fill.x, (A4_WIDTH - 612 * (A4_HEIGHT / 792)) / 2)
  assert.notEqual(fill.clip, null)
  close(fill.clip?.width ?? 0, A4_WIDTH)
  close(fill.clip?.height ?? 0, A4_HEIGHT)
})

test('computePlacement compensates for page rotation', () => {
  const placement = computePlacement(
    { width: 300, height: 400, rotation: 90 },
    A4_WIDTH,
    A4_HEIGHT,
    'fit',
    0,
  )

  const scale = A4_WIDTH / 400
  const drawHeight = 300 * scale
  const offsetY = (A4_HEIGHT - drawHeight) / 2

  assert.equal(placement.rotate, 270)
  close(placement.x, 0)
  close(placement.y, offsetY + drawHeight)
  close(placement.yScale * 400, A4_WIDTH)
})

test('resizePdfBytes rebuilds every page at the target size', async () => {
  const source = await PDFDocument.create()
  source.addPage([612, 792])
  const rotated = source.addPage([612, 792])
  rotated.setRotation(degrees(90))
  const bytes = await source.save()

  const result = await resizePdfBytes(bytes, baseOptions)
  const output = await PDFDocument.load(result.bytes)

  assert.equal(result.pageCount, 2)
  assert.equal(output.getPageCount(), 2)

  const portrait = output.getPage(0).getSize()
  close(portrait.width, A4_WIDTH)
  close(portrait.height, A4_HEIGHT)

  const landscape = output.getPage(1).getSize()
  close(landscape.width, A4_HEIGHT)
  close(landscape.height, A4_WIDTH)
  assert.equal(result.sizeLabel, 'A4 · match page')
})

test('describeTargetSize names standard and custom sizes', () => {
  assert.equal(describeTargetSize(baseOptions), 'A4 · match page')
  assert.equal(
    describeTargetSize({ ...baseOptions, preset: 'letter', orientation: 'portrait' }),
    'US Letter · portrait',
  )
  assert.equal(
    describeTargetSize({
      ...baseOptions,
      preset: 'custom',
      customWidthMm: 100,
      customHeightMm: 150,
    }),
    '100 × 150 mm',
  )
})

// A 1×1 white JPEG, used to exercise the flatten assembler without a canvas.
const TINY_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64',
  ),
)

test('computeRenderGeometry converts DPI to pixels and caps oversized pages', () => {
  const a4 = computeRenderGeometry(A4_WIDTH, A4_HEIGHT, FLATTEN_QUALITY.print.dpi)
  assert.equal(a4.dpi, 300)
  close(a4.width, 2480, 1)
  close(a4.height, 3507, 1)

  const huge = computeRenderGeometry(20000, 20000, 300)
  assert.ok(huge.width <= MAX_RENDER_EDGE)
  assert.ok(huge.height <= MAX_RENDER_EDGE)
  assert.ok(huge.width * huge.height <= MAX_RENDER_PIXELS)
  assert.ok(huge.dpi < 300)
})

test('assembleFlattenedPdf writes one image-backed page per rendered page', async () => {
  const bytes = await assembleFlattenedPdf([
    { bytes: TINY_JPEG, width: 595.28, height: 841.89 },
    { bytes: TINY_JPEG, width: 841.89, height: 595.28 },
  ])
  const output = await PDFDocument.load(bytes)

  assert.equal(output.getPageCount(), 2)
  assert.equal(output.getCreator(), 'Sheet PDF Tools')

  const first = output.getPage(0).getSize()
  close(first.width, 595.28, 0.01)
  close(first.height, 841.89, 0.01)

  const second = output.getPage(1).getSize()
  close(second.width, 841.89, 0.01)
  close(second.height, 595.28, 0.01)
})

test('assembleFlattenedPdf rejects an empty document', async () => {
  await assert.rejects(() => assembleFlattenedPdf([]), /no pages/i)
})

test('flatten quality presets stay ordered by resolution', () => {
  assert.ok(FLATTEN_QUALITY.screen.dpi < FLATTEN_QUALITY.balanced.dpi)
  assert.ok(FLATTEN_QUALITY.balanced.dpi < FLATTEN_QUALITY.print.dpi)
  assert.equal(FLATTEN_QUALITY.balanced.dpi, 200)
})
