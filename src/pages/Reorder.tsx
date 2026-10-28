import { useEffect, useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import PageThumbnails from '../components/PageThumbnails'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { reorderPages } from '../lib/pdf/reorder'
import { buildOutputName, downloadBlob, toPdfBlob } from '../lib/pdf/load'

export default function Reorder() {
  const { file, pageCount, loading, error, loadFile, clear, setError } = usePdfFile()
  const [order, setOrder] = useState<number[]>([])
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (pageCount > 0) {
      setOrder(Array.from({ length: pageCount }, (_, index) => index + 1))
    } else {
      setOrder([])
    }
  }, [pageCount])

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const resetOrder = () => {
    setOrder(Array.from({ length: pageCount }, (_, index) => index + 1))
  }

  const handleDownload = async () => {
    if (!file || order.length === 0) return

    setProcessing(true)
    setError(null)

    try {
      const bytes = await reorderPages(file, order)
      downloadBlob(toPdfBlob(bytes), buildOutputName(file.name, 'reordered'))
    } catch {
      setError('Reorder failed. Try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleClear = () => {
    clear()
    setOrder([])
  }

  return (
    <ToolLayout
      number="06"
      title="Reorder PDF"
      description="Move pages around like cards. Drag them into a new sequence, then download the document without touching the original."
      steps={[
        'Drop a PDF and check the page grid.',
        'Drag pages into place, or focus a card and press Alt plus an arrow key.',
        'Download the reordered document.',
      ]}
      meta={[
        { label: 'Pages', value: 'All pages' },
        { label: 'Control', value: 'Drag / keyboard' },
        { label: 'Runs', value: 'On-device' },
      ]}
      note="Reordering is a browser-side page copy. Links, form fields, and annotations on individual pages are not preserved."
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to reorder"
        hint="Single file · drag the page cards after loading"
        files={file ? [file] : []}
        onRemove={handleClear}
        disabled={loading || processing}
      />

      {loading && <p className="loading">Reading PDF…</p>}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {file && pageCount > 0 && !loading && (
        <>
          <div className="field-row field-row-spread">
            <p className="hint">
              Drag pages to reorder · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            </p>
            <button type="button" className="btn btn-small btn-secondary" onClick={resetOrder}>
              Reset order
            </button>
          </div>

          <PageThumbnails
            pageCount={pageCount}
            order={order}
            draggable
            onReorder={handleReorder}
          />

          <div className="btn-row">
            <DownloadButton
              onClick={handleDownload}
              disabled={processing}
              label={processing ? 'Processing…' : 'Download reordered PDF'}
            />
            <button type="button" className="btn btn-secondary" onClick={handleClear}>
              Clear
            </button>
          </div>
        </>
      )}
    </ToolLayout>
  )
}
