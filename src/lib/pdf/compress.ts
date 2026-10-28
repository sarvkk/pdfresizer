import { loadPdfDocument } from './load'

export type CompressionLevel = 'light' | 'balanced' | 'aggressive'

export interface CompressResult {
  bytes: Uint8Array
  originalSize: number
  compressedSize: number
}

export async function compressPdf(
  file: File,
  level: CompressionLevel = 'balanced',
): Promise<CompressResult> {
  const originalSize = file.size
  const doc = await loadPdfDocument(file)

  doc.setTitle('')
  doc.setAuthor('')
  doc.setSubject('')
  doc.setKeywords([])
  doc.setCreator('')
  doc.setProducer('Sheet PDF Tools')

  const useObjectStreams = level !== 'light'

  const bytes = await doc.save({
    useObjectStreams,
    addDefaultPage: false,
  })

  return {
    bytes,
    originalSize,
    compressedSize: bytes.length,
  }
}

export function compressionSavings(original: number, compressed: number): number {
  if (original === 0) return 0
  return Math.round(((original - compressed) / original) * 100)
}
