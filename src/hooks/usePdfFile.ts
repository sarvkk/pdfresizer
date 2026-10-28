import { useCallback, useState } from 'react'
import { loadPdfDocument } from '../lib/pdf/load'

export function usePdfFile() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (next: File) => {
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const doc = await loadPdfDocument(next)
      setFile(next)
      setPageCount(doc.getPageCount())
    } catch {
      setFile(null)
      setPageCount(0)
      setError('Could not read this PDF. It may be corrupted or password-protected.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setError(null)
  }, [])

  return { file, pageCount, loading, error, loadFile, clear, setError }
}
