import { useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import PageThumbnails from '../components/PageThumbnails'
import SegmentedControl from '../components/SegmentedControl'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { parsePageRange, splitPdf } from '../lib/pdf/split'
import { buildOutputName, downloadBlob, toPdfBlob } from '../lib/pdf/load'

type SplitMode = 'click' | 'range'

const MODE_OPTIONS = [
  { value: 'click' as const, label: 'Click pages' },
  { value: 'range' as const, label: 'Type a range' },
]

export default function Split() {
  const { file, pageCount, loading, error, loadFile, clear, setError } = usePdfFile()
  const [rangeInput, setRangeInput] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [mode, setMode] = useState<SplitMode>('click')
  const [processing, setProcessing] = useState(false)

  const rangePages = parsePageRange(rangeInput, pageCount)
  const selectedCount = mode === 'range' ? rangePages.length : selected.length

  const togglePage = (page: number) => {
    setSelected((prev) =>
      prev.includes(page) ? prev.filter((pageNumber) => pageNumber !== page) : [...prev, page].sort((a, b) => a - b),
    )
  }

  const handleSplit = async () => {
    if (!file) return

    const pages = mode === 'range' ? rangePages : selected

    if (pages.length === 0) {
      setError(
        mode === 'range'
          ? 'Enter a valid page range, for example 1-3, 5, 7-9.'
          : 'Select at least one page.',
      )
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const bytes = await splitPdf(file, pages)
      downloadBlob(toPdfBlob(bytes), buildOutputName(file.name, 'split'))
    } catch {
      setError('Split failed. Check your selection and try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleClear = () => {
    clear()
    setSelected([])
    setRangeInput('')
  }

  return (
    <ToolLayout
      number="04"
      title="Split PDF"
      description="Extract the pages you need into a new document. Click individual pages or type a range when you already know the numbers."
      steps={[
        'Drop a PDF and wait for the page count.',
        'Click pages to select them, or type a range like 1-3, 5, 8.',
        'Extract the selection and download it.',
      ]}
      meta={[
        { label: 'Pages', value: 'Any selection' },
        { label: 'Runs', value: 'On-device' },
        { label: 'Output', value: 'PDF' },
      ]}
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to split"
        hint="Single file · pages stay on your device"
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
            <div className="field field-grow">
              <span className="field-label">Selection mode</span>
              <SegmentedControl
                label="Selection mode"
                value={mode}
                onChange={(next) => {
                  setMode(next)
                  setError(null)
                }}
                options={MODE_OPTIONS}
                disabled={processing}
              />
            </div>

            <span className="selection-count" aria-live="polite">
              {selectedCount} of {pageCount} selected
            </span>
          </div>

          {mode === 'click' ? (
            <>
              <div className="btn-row btn-row-tight">
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => setSelected(Array.from({ length: pageCount }, (_, index) => index + 1))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-secondary"
                  onClick={() => setSelected([])}
                >
                  Clear selection
                </button>
              </div>

              <PageThumbnails
                pageCount={pageCount}
                selected={selected}
                onToggle={togglePage}
              />
            </>
          ) : (
            <div className="field field-wide">
              <label htmlFor="range">Page range</label>
              <input
                id="range"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1-3, 5, 8-10"
                value={rangeInput}
                onChange={(event) => {
                  setRangeInput(event.target.value)
                  setError(null)
                }}
                disabled={processing}
              />
              <span className="field-help">
                Use commas and hyphens. Pages outside 1–{pageCount} are ignored.
              </span>
            </div>
          )}

          <div className="btn-row">
            <DownloadButton
              onClick={handleSplit}
              disabled={processing}
              label={processing ? 'Splitting…' : 'Extract & download'}
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
