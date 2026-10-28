import { degrees } from 'pdf-lib'
import { loadPdfDocument, savePdf } from './load'

export type RotationAngle = 90 | 180 | 270

export async function rotatePages(
  file: File,
  pageNumbers: number[],
  angle: RotationAngle,
): Promise<Uint8Array> {
  const doc = await loadPdfDocument(file)
  const total = doc.getPageCount()

  for (const pageNum of pageNumbers) {
    const index = pageNum - 1
    if (index < 0 || index >= total) continue
    const page = doc.getPage(index)
    const current = page.getRotation().angle
    page.setRotation(degrees(current + angle))
  }

  return savePdf(doc)
}
