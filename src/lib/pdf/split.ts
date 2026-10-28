import { PDFDocument } from 'pdf-lib'
import { loadPdfDocument, savePdf } from './load'

export async function splitPdf(
  file: File,
  pageNumbers: number[],
): Promise<Uint8Array> {
  const source = await loadPdfDocument(file)
  const output = await PDFDocument.create()
  const total = source.getPageCount()

  const indices = pageNumbers
    .map((n) => n - 1)
    .filter((i) => i >= 0 && i < total)

  if (indices.length === 0) {
    throw new Error('No valid pages selected.')
  }

  const copied = await output.copyPages(source, indices)
  copied.forEach((page) => output.addPage(page))

  return savePdf(output)
}

export function parsePageRange(input: string, totalPages: number): number[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  const pages = new Set<number>()

  for (const part of trimmed.split(',')) {
    const segment = part.trim()
    if (!segment) continue

    if (segment.includes('-')) {
      const [startStr, endStr] = segment.split('-').map((s) => s.trim())
      const start = Number(startStr)
      const end = Number(endStr)
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      for (let i = lo; i <= hi; i++) {
        if (i >= 1 && i <= totalPages) pages.add(i)
      }
    } else {
      const n = Number(segment)
      if (!Number.isNaN(n) && n >= 1 && n <= totalPages) pages.add(n)
    }
  }

  return [...pages].sort((a, b) => a - b)
}
