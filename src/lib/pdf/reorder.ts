import { PDFDocument } from 'pdf-lib'
import { loadPdfDocument, savePdf } from './load'

export async function reorderPages(
  file: File,
  order: number[],
): Promise<Uint8Array> {
  const source = await loadPdfDocument(file)
  const output = await PDFDocument.create()
  const total = source.getPageCount()

  const indices = order
    .map((n) => n - 1)
    .filter((i) => i >= 0 && i < total)

  if (indices.length !== total) {
    throw new Error('Page order must include every page exactly once.')
  }

  const copied = await output.copyPages(source, indices)
  copied.forEach((page) => output.addPage(page))

  return savePdf(output)
}
