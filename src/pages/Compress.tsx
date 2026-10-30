import { useEffect, useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import SegmentedControl from '../components/SegmentedControl'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { compressPdf, compressionSavings, type CompressionLevel } from '../lib/pdf/compress'
import {
  DEFAULT_MAX_SERVER_BYTES,
  checkCompressApi,
  compressPdfOnServer,
  formatUploadLimit,
} from '../lib/pdf/compressServer'
import { buildOutputName, downloadBlob, formatBytes, toPdfBlob } from '../lib/pdf/load'

type CompressMode = 'server' | 'client'
type ApiState = 'checking' | 'ready' | 'missing' | 'offline'

const MODE_OPTIONS = [
  { value: 'server' as const, label: 'Ghostscript API' },
  { value: 'client' as const, label: 'In-browser' },
]

const LEVEL_OPTIONS: Array<{ value: CompressionLevel; label: string; hint: string }> = [
  { value: 'light', label: 'Light', hint: 'Higher quality, larger file' },
  { value: 'balanced', label: 'Balanced', hint: 'Good default, ebook quality' },
  { value: 'aggressive', label: 'Aggressive', hint: 'Smallest file, screen quality' },
]

export default function Compress() {
  const { file, loading, error, loadFile, clear } = usePdfFile()
  const [mode, setMode] = useState<CompressMode>('server')
  const [level, setLevel] = useState<CompressionLevel>('balanced')
  const [processing, setProcessing] = useState(false)
  const [apiState, setApiState] = useState<ApiState>('checking')
  const [apiVersion, setApiVersion] = useState<string | null>(null)
  const [maxUploadBytes, setMaxUploadBytes] = useState(DEFAULT_MAX_SERVER_BYTES)
  const [processError, setProcessError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    originalSize: number
    compressedSize: number
    bytes: Uint8Array
    mode: CompressMode
  } | null>(null)
  const maxUploadLabel = formatUploadLimit(maxUploadBytes)

  useEffect(() => {
    let cancelled = false

    checkCompressApi().then((status) => {
      if (cancelled) return

      setMaxUploadBytes(status.maxUploadBytes)

      if (!status.reachable) {
        setApiState('offline')
        setMode('client')
        return
      }

      if (!status.ghostscript) {
        setApiState('missing')
        setMode('client')
        return
      }

      setApiState('ready')
      setApiVersion(status.version)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const handleCompress = async () => {
    if (!file) return

    if (mode === 'server' && file.size > maxUploadBytes) {
      setProcessError(
        `Server mode accepts files up to ${maxUploadLabel}. Switch to in-browser mode.`,
      )
      return
    }

    setProcessing(true)
    setProcessError(null)
    setResult(null)

    try {
      if (mode === 'server') {
        const output = await compressPdfOnServer(file, level, maxUploadBytes)
        setResult({ ...output, mode: 'server' })
      } else {
        const output = await compressPdf(file, 'balanced')
        setResult({ ...output, mode: 'client' })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Compression failed. Try a different PDF.'
      setProcessError(message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!file || !result) return
    downloadBlob(toPdfBlob(result.bytes), buildOutputName(file.name, 'compressed'))
  }

  const handleClear = () => {
    clear()
    setResult(null)
    setProcessError(null)
  }

  const savings = result ? compressionSavings(result.originalSize, result.compressedSize) : 0
  const serverDisabled = apiState === 'offline' || apiState === 'missing'

  return (
    <ToolLayout
      number="01"
      title="Compress PDF"
      description="Make a PDF lighter. Ghostscript does the real image downsampling through a local API; in-browser mode strips structure without sending the file anywhere."
      steps={[
        `Drop a PDF up to ${maxUploadLabel} for server mode.`,
        'Choose an engine and a compression level.',
        'Compress, check the savings, then download.',
      ]}
      meta={[
        { label: 'Engine', value: 'Ghostscript / pdf-lib' },
        { label: 'Max size', value: `${maxUploadLabel} (server)` },
        { label: 'Output', value: 'PDF' },
      ]}
      note="Server mode sends the file to the local API on this machine. Temp files are deleted after every request. In-browser mode never leaves the tab."
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to compress"
        hint={`Single file · up to ${maxUploadLabel} in server mode`}
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
              <span className="field-label">Compression engine</span>
              <SegmentedControl
                label="Compression engine"
                value={mode}
                onChange={(next) => {
                  setMode(next)
                  setResult(null)
                  setProcessError(null)
                }}
                options={MODE_OPTIONS.map((option) => ({
                  ...option,
                  disabled: option.value === 'server' && serverDisabled,
                }))}
                disabled={processing}
              />
            </div>

            {mode === 'server' && (
              <div className="field">
                <label htmlFor="level">Compression level</label>
                <select
                  id="level"
                  value={level}
                  onChange={(event) => {
                    setLevel(event.target.value as CompressionLevel)
                    setResult(null)
                  }}
                  disabled={processing}
                >
                  {LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {apiState === 'checking' && (
            <p className="api-status">
              <span className="status-dot is-waiting" aria-hidden="true" />
              Checking the local compression API…
            </p>
          )}

          {apiState === 'ready' && (
            <p className="api-status">
              <span className="status-dot" aria-hidden="true" />
              Local API ready{apiVersion ? ` · Ghostscript ${apiVersion}` : ''}
            </p>
          )}

          {apiState === 'offline' && (
            <p className="alert alert-info">
              The compress API is offline. Start it with <code>pnpm dev:api</code>, then reload
              this page — or keep using in-browser mode below. In-browser mode only rewrites
              structure, so savings are limited.
            </p>
          )}

          {apiState === 'missing' && (
            <p className="alert alert-info">
              The API is running, but Ghostscript was not found on <code>PATH</code>. Install it
              with <code>sudo apt install ghostscript</code>, then restart the API. In-browser
              mode is available meanwhile.
            </p>
          )}

          {mode === 'client' && (
            <p className="alert alert-info">
              In-browser mode keeps the file on your device. It can remove metadata and rewrite
              object streams, but it cannot downsample images, so don&apos;t expect dramatic
              savings.
            </p>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCompress}
              disabled={processing}
            >
              {processing ? 'Compressing…' : 'Compress PDF'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClear}>
              Clear
            </button>
          </div>
        </>
      )}

      {processError && (
        <p className="alert alert-error" role="alert">
          {processError}
        </p>
      )}

      {result && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-label">Original</span>
              <span className="stat-value">{formatBytes(result.originalSize)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Compressed</span>
              <span className="stat-value">{formatBytes(result.compressedSize)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Saved</span>
              <span className={`stat-value${savings > 0 ? ' is-positive' : ''}`}>
                {savings > 0 ? `${savings}%` : 'No reduction'}
              </span>
            </div>
          </div>

          {savings <= 0 && result.mode === 'client' && (
            <p className="alert alert-info">
              In-browser mode could not shrink this file. Switch to Ghostscript mode for real
              image compression.
            </p>
          )}

          {savings <= 0 && result.mode === 'server' && (
            <p className="alert alert-info">
              Ghostscript found little to remove — this PDF may already be heavily compressed.
            </p>
          )}

          <div className="btn-row">
            <DownloadButton onClick={handleDownload} label="Download compressed PDF" />
          </div>
        </>
      )}
    </ToolLayout>
  )
}
