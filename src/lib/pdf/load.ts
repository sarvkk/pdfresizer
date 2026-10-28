import { PDFDocument } from 'pdf-lib'

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer()
}

export async function loadPdfDocument(file: File): Promise<PDFDocument> {
  const bytes = await readFileAsArrayBuffer(file)
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

export async function loadPdfFromBytes(bytes: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function buildOutputName(originalName: string, suffix: string): string {
  const base = originalName.replace(/\.pdf$/i, '')
  return `${base}-${suffix}.pdf`
}

export async function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true })
}

export function toPdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}
