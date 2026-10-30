import { useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import SegmentedControl from '../components/SegmentedControl'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import {
  FLATTEN_QUALITY,
  flattenPdf,
  type FlattenProgress,
  type FlattenQuality,
  type FlattenResult,
} from '../lib/pdf/flatten'
import { buildOutputName, downloadBlob, formatBytes, toPdfBlob } from '../lib/pdf/load'

const QUALITY_OPTIONS = (Object.keys(FLATTEN_QUALITY) as FlattenQuality[]).map((value) => ({
  value,
  label: `${FLATTEN_QUALITY[value].label} · ${FLATTEN_QUALITY[value].dpi}`,
}))

export default function Flatten() {
  const { file, pageCount, loading, error, loadFile, clear, setError } = usePdfFile()
  const [quality, setQuality] = useState<FlattenQuality>('balanced')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<FlattenProgress | null>(null)
  const [result, setResult] = useState<FlattenResult | null>(null)

  const handleFlatten = async () => {
    if (!file) return

    setProcessing(true)
    setProgress(null)
    setResult(null)
    setError(null)

    try {
      const output = await flattenPdf(file, quality, setProgress)
      setResult(output)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Flattening failed. Try a different PDF.'
      setError(message)
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  const handleDownload = () => {
    if (!file || !result) return
    downloadBlob(toPdfBlob(result.bytes), buildOutputName(file.name, 'flattened'))
  }

  const handleClear = () => {
    clear()
    setResult(null)
    setProgress(null)
  }

  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0
  const qualityInfo = FLATTEN_QUALITY[quality]
  const pageLabel = pageCount === 1 ? '1 page' : `${pageCount} pages`

  return (
    <ToolLayout
      number="07"
      title="Flatten PDF"
      description="Bake every page into a single image layer. Text stops being selectable, searchable, or convertible into an editable Word document."
      steps={[
        'Drop a PDF and check the page count.',
        'Choose a resolution that balances sharpness and file size.',
        'Flatten the whole document, then download it.',
      ]}
      meta={[
        { label: 'Pages', value: 'Whole document' },
        { label: 'Resolution', value: '150–300 DPI' },
        { label: 'Runs', value: 'On-device' },
      ]}
      note="Pages become images. Text can no longer be selected, searched, or edited in Word. This is flattening, not redaction — visible text can still be read by OCR."
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to flatten"
        hint="Single file · output is image-only"
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

      {file && !loading && (
        <>
          <div className="field-row">
            <div className="field field-grow">
              <span className="field-label">Output resolution</span>
              <SegmentedControl
                label="Output resolution"
                value={quality}
                onChange={(next) => {
                  setQuality(next)
                  setResult(null)
                  setError(null)
                }}
                options={QUALITY_OPTIONS}
                disabled={processing}
              />
            </div>

            <span className="selection-count" aria-live="polite">
              {pageLabel}
            </span>
          </div>

          <p className="hint">
            {qualityInfo.label} renders at {qualityInfo.dpi} DPI. {qualityInfo.hint}.
          </p>

          <p className="alert alert-info">
            Flattening trades editable text for a fixed image. The result will not open as
            editable text in Word, but it also cannot be searched or copied. Higher resolutions
            look sharper and produce larger files.
          </p>

          {processing && (
            <div
              className="progress"
              role="progressbar"
              aria-label="Flattening progress"
              aria-valuemin={0}
              aria-valuemax={progress?.total ?? 100}
              aria-valuenow={progress?.done}
            >
              <div className="progress-head">
                <span>
                  {progress
                    ? `Flattening page ${progress.done} of ${progress.total}`
                    : 'Preparing pages…'}
                </span>
                {progress && <span>{percent}%</span>}
              </div>
              <div className="progress-track">
                <span
                  className={`progress-bar${progress ? '' : ' is-indeterminate'}`}
                  style={progress ? { width: `${percent}%` } : undefined}
                />
              </div>
            </div>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleFlatten}
              disabled={processing}
            >
              {processing ? 'Flattening…' : 'Flatten PDF'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={processing}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {result && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-label">Pages</span>
              <span className="stat-value">{result.pageCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Resolution</span>
              <span className="stat-value stat-value-small">{result.dpi} DPI</span>
            </div>
            <div className="stat">
              <span className="stat-label">File size</span>
              <span className="stat-value">{formatBytes(result.outputSize)}</span>
            </div>
          </div>

          <p className="hint">
            Text is now part of the page image: it cannot be selected, searched, or converted into
            editable text. The flattened file is often larger than the original — run it through
            Compress afterwards if size matters.
          </p>

          <div className="btn-row">
            <DownloadButton onClick={handleDownload} label="Download flattened PDF" />
          </div>
        </>
      )}
    </ToolLayout>
  )
}
