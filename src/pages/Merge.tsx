import { useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import Icon from '../components/Icon'
import ToolLayout from '../components/ToolLayout'
import { usePdfFiles } from '../hooks/usePdfFiles'
import { mergePdfs } from '../lib/pdf/merge'
import { buildOutputName, downloadBlob, formatBytes, toPdfBlob } from '../lib/pdf/load'

export default function Merge() {
  const { files, loading, error, addFiles, removeFile, reorderFiles, clear, setError } =
    usePdfFiles()
  const [processing, setProcessing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const totalPages = files.reduce((sum, entry) => sum + entry.pageCount, 0)

  const handleMerge = async () => {
    if (files.length < 2) {
      setError('Add at least two PDFs to merge.')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const bytes = await mergePdfs(files.map((entry) => entry.file))
      downloadBlob(toPdfBlob(bytes), buildOutputName(files[0].file.name, 'merged'))
    } catch {
      setError('Merge failed. Check that all files are valid PDFs.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <ToolLayout
      number="03"
      title="Merge PDFs"
      description="Combine documents into one file. The queue sets the order, so drag the list before you run the job."
      steps={[
        'Drop two or more PDFs into the queue.',
        'Drag the list — or use Alt plus arrow keys — to set the order.',
        'Merge and download the combined document.',
      ]}
      meta={[
        { label: 'Files', value: '2 or more' },
        { label: 'Runs', value: 'On-device' },
        { label: 'Output', value: 'PDF' },
      ]}
    >
      <DropZone
        onFiles={addFiles}
        multiple
        label="Drop PDFs to merge"
        hint="Add two or more files · drag to reorder after loading"
        disabled={loading || processing}
      />

      {loading && <p className="loading">Reading PDFs…</p>}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <>
          <p className="hint">
            {files.length} {files.length === 1 ? 'file' : 'files'} · {totalPages}{' '}
            {totalPages === 1 ? 'page' : 'pages'} · drag to reorder
          </p>

          <ul className="file-list file-list-queue">
            {files.map((entry, index) => (
              <li
                key={entry.id}
                className={[
                  'file-item',
                  'file-item-draggable',
                  dragIndex === index ? 'is-dragging' : '',
                  overIndex === index && dragIndex !== index ? 'is-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                tabIndex={0}
                onDragStart={(event) => {
                  setDragIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', String(index))
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOverIndex(index)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragIndex !== null && dragIndex !== index) {
                    reorderFiles(dragIndex, index)
                  }
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onKeyDown={(event) => {
                  if (
                    event.altKey &&
                    (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                  ) {
                    event.preventDefault()
                    const next = index + (event.key === 'ArrowDown' ? 1 : -1)
                    if (next >= 0 && next < files.length) reorderFiles(index, next)
                  }
                }}
                aria-label={`${entry.file.name}, position ${index + 1} of ${files.length}. Use Alt plus arrow keys to move.`}
              >
                <span className="file-drag" aria-hidden="true">
                  <Icon name="reorder" size={16} />
                </span>
                <span className="file-item-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="file-item-name">{entry.file.name}</span>
                <span className="file-item-meta">
                  {entry.pageCount} pg · {formatBytes(entry.file.size)}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeFile(entry.id)}
                  aria-label={`Remove ${entry.file.name}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>

          <div className="btn-row">
            <DownloadButton
              onClick={handleMerge}
              disabled={processing || files.length < 2}
              label={processing ? 'Merging…' : 'Merge & download'}
            />
            <button type="button" className="btn btn-secondary" onClick={clear}>
              Clear all
            </button>
          </div>
        </>
      )}
    </ToolLayout>
  )
}
