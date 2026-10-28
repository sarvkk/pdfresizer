import { useCallback, useState } from 'react'
import { loadPdfDocument } from '../lib/pdf/load'

export interface PdfFileEntry {
  id: string
  file: File
  pageCount: number
}

export function usePdfFiles() {
  const [files, setFiles] = useState<PdfFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )

    if (pdfs.length === 0) {
      setError('Please choose PDF files.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const entries: PdfFileEntry[] = []
      for (const file of pdfs) {
        const doc = await loadPdfDocument(file)
        entries.push({
          id: crypto.randomUUID(),
          file,
          pageCount: doc.getPageCount(),
        })
      }
      setFiles((prev) => [...prev, ...entries])
    } catch {
      setError('One or more PDFs could not be read.')
    } finally {
      setLoading(false)
    }
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setFiles([])
    setError(null)
  }, [])

  return { files, loading, error, addFiles, removeFile, reorderFiles, clear, setError }
}
