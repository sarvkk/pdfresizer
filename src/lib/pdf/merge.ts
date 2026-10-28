import { PDFDocument } from 'pdf-lib'
import { loadPdfDocument, savePdf } from './load'

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  for (const file of files) {
    const source = await loadPdfDocument(file)
    const pageIndices = source.getPageIndices()
    const copied = await merged.copyPages(source, pageIndices)
    copied.forEach((page) => merged.addPage(page))
  }

  return savePdf(merged)
}
