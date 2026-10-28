import { useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { buildOutputName, downloadBlob, formatBytes, toPdfBlob } from '../lib/pdf/load'
import {
  MM_TO_PT,
  PAPER_OPTIONS,
  resizePdf,
  type FitMode,
  type PageOrientation,
  type PageSizePreset,
  type ResizeResult,
} from '../lib/pdf/resize'

const FIT_OPTIONS: Array<{ value: FitMode; label: string }> = [
  { value: 'fit', label: 'Fit — whole page' },
  { value: 'fill', label: 'Fill — crop edges' },
  { value: 'stretch', label: 'Stretch — fill exactly' },
]

function formatMm(points: number): string {
  return `${Math.round((points / MM_TO_PT) * 10) / 10} mm`
}

export default function Resize() {
  const { file, loading, error, loadFile, clear, setError } = usePdfFile()
  const [preset, setPreset] = useState<PageSizePreset>('a4')
  const [orientation, setOrientation] = useState<PageOrientation>('auto')
  const [fit, setFit] = useState<FitMode>('fit')
  const [marginMm, setMarginMm] = useState(0)
  const [customWidth, setCustomWidth] = useState('210')
  const [customHeight, setCustomHeight] = useState('297')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)

  const handleClear = () => {
    clear()
    setResult(null)
  }

  const handleResize = async () => {
    if (!file) return

    const width = Number(customWidth)
    const height = Number(customHeight)

    if (
      preset === 'custom' &&
      (!Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < 10 ||
        height < 10 ||
        width > 1000 ||
        height > 1000)
    ) {
      setError('Custom size must be between 10 and 1000 mm on each side.')
      return
    }

    setProcessing(true)
    setError(null)
    setResult(null)

    try {
      const output = await resizePdf(file, {
        preset,
        orientation,
        fit,
        marginMm,
        customWidthMm: width || 210,
        customHeightMm: height || 297,
      })
      setResult(output)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Resize failed. Try a different PDF.'
      setError(message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!file || !result) return
    downloadBlob(toPdfBlob(result.bytes), buildOutputName(file.name, 'resized'))
  }

  return (
    <ToolLayout
      number="02"
      title="Resize PDF"
      description="Give every page the same paper size. Pick a standard sheet or set exact dimensions, then choose how the original page should sit inside it."
      steps={[
        'Drop a PDF and check the page count.',
        'Choose a paper size, orientation, scaling mode, and margin.',
        'Resize, inspect the result, then download.',
      ]}
      meta={[
        { label: 'Paper', value: 'A3–A5, Letter, Legal, Custom' },
        { label: 'Runs', value: 'On-device' },
        { label: 'Output', value: 'PDF' },
      ]}
      note="Pages are re-embedded, so text stays selectable. Links, form fields, and annotations are not carried over to the resized file."
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to resize"
        hint="Single file · processed in your browser"
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
          <div className="field-grid">
            <div className="field">
              <label htmlFor="preset">Paper size</label>
              <select
                id="preset"
                value={preset}
                onChange={(event) => {
                  setPreset(event.target.value as PageSizePreset)
                  setResult(null)
                }}
                disabled={processing}
              >
                {PAPER_OPTIONS.map((paper) => (
                  <option key={paper.value} value={paper.value}>
                    {paper.label} — {paper.widthMm} × {paper.heightMm} mm
                  </option>
                ))}
                <option value="custom">Custom size</option>
              </select>
            </div>

            {preset === 'custom' ? (
              <>
                <div className="field">
                  <label htmlFor="custom-width">Width (mm)</label>
                  <input
                    id="custom-width"
                    type="number"
                    min={10}
                    max={1000}
                    step={0.1}
                    value={customWidth}
                    onChange={(event) => {
                      setCustomWidth(event.target.value)
                      setResult(null)
                    }}
                    disabled={processing}
                  />
                </div>
                <div className="field">
                  <label htmlFor="custom-height">Height (mm)</label>
                  <input
                    id="custom-height"
                    type="number"
                    min={10}
                    max={1000}
                    step={0.1}
                    value={customHeight}
                    onChange={(event) => {
                      setCustomHeight(event.target.value)
                      setResult(null)
                    }}
                    disabled={processing}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="orientation">Orientation</label>
                <select
                  id="orientation"
                  value={orientation}
                  onChange={(event) => {
                    setOrientation(event.target.value as PageOrientation)
                    setResult(null)
                  }}
                  disabled={processing}
                >
                  <option value="auto">Match each page</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            )}

            <div className="field">
              <label htmlFor="fit">Scaling</label>
              <select
                id="fit"
                value={fit}
                onChange={(event) => {
                  setFit(event.target.value as FitMode)
                  setResult(null)
                }}
                disabled={processing}
              >
                {FIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="margin">Margin (mm)</label>
              <input
                id="margin"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={marginMm}
                onChange={(event) => {
                  setMarginMm(Math.max(0, Math.min(50, Number(event.target.value) || 0)))
                  setResult(null)
                }}
                disabled={processing}
              />
            </div>
          </div>

          <p className="hint">
            {fit === 'fit' && 'Whole page stays visible. Extra space becomes margin.'}
            {fit === 'fill' && 'Page fills the sheet. Content beyond the edges is cropped.'}
            {fit === 'stretch' && 'Page fills the sheet exactly. Proportions may change.'}
          </p>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResize}
              disabled={processing}
            >
              {processing ? 'Resizing…' : 'Resize PDF'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear}>
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
              <span className="stat-label">Paper</span>
              <span className="stat-value stat-value-small">{result.sizeLabel}</span>
            </div>
            <div className="stat">
              <span className="stat-label">File size</span>
              <span className="stat-value">{formatBytes(result.outputSize)}</span>
            </div>
          </div>

          <p className="hint">
            First page: {formatMm(result.firstPageWidth)} × {formatMm(result.firstPageHeight)}.
            Resizing rebuilds the file, so the download may be larger than the original. Run it
            through Compress afterwards if size matters.
          </p>

          <div className="btn-row">
            <DownloadButton onClick={handleDownload} label="Download resized PDF" />
          </div>
        </>
      )}
    </ToolLayout>
  )
}
