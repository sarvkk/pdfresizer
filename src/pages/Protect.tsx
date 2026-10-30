import { useEffect, useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import SegmentedControl from '../components/SegmentedControl'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { formatUploadLimit } from '../lib/pdf/compressServer'
import { buildOutputName, downloadBlob, formatBytes, toPdfBlob } from '../lib/pdf/load'
import {
  certifyPdfOnServer,
  protectPdfOnServer,
  type ModifyPermission,
  type PrintPermission,
} from '../lib/pdf/protectServer'
import { checkServerHealth } from '../lib/pdf/serverHealth'

type Mode = 'restrict' | 'certify'
type ApiState = 'checking' | 'ready' | 'offline'

const MODE_OPTIONS = [
  { value: 'restrict' as const, label: 'Restrict editing' },
  { value: 'certify' as const, label: 'Certify' },
]

const PRINT_OPTIONS: Array<{ value: PrintPermission; label: string }> = [
  { value: 'full', label: 'High resolution' },
  { value: 'low', label: 'Low resolution only' },
  { value: 'none', label: 'Not allowed' },
]

const MODIFY_OPTIONS: Array<{ value: ModifyPermission; label: string; hint: string }> = [
  { value: 'none', label: 'No changes', hint: 'No editing, comments, forms, or page assembly' },
  { value: 'assembly', label: 'Page assembly', hint: 'Insert, delete, and rotate pages' },
  { value: 'form', label: 'Forms and signing', hint: 'Fill form fields and add signatures' },
  { value: 'annotate', label: 'Comments and forms', hint: 'Comment, fill forms, and sign' },
  { value: 'all', label: 'Everything except extraction', hint: 'Full editing, but copying stays blocked' },
]

const CERTIFY_LEVELS = [
  { value: '1', label: 'No changes allowed' },
  { value: '2', label: 'Form filling and signatures allowed' },
]

const MIN_OWNER_PASSWORD = 6

export default function Protect() {
  const { file, pageCount, loading, error, loadFile, clear, setError } = usePdfFile()
  const [mode, setMode] = useState<Mode>('restrict')
  const [apiState, setApiState] = useState<ApiState>('checking')
  const [qpdfVersion, setQpdfVersion] = useState<string | null>(null)
  const [maxUploadBytes, setMaxUploadBytes] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    bytes: Uint8Array
    originalSize: number
    outputSize: number
    mode: Mode
  } | null>(null)

  const [ownerPassword, setOwnerPassword] = useState('')
  const [print, setPrint] = useState<PrintPermission>('full')
  const [copy, setCopy] = useState(false)
  const [modify, setModify] = useState<ModifyPermission>('none')

  const [p12File, setP12File] = useState<File | null>(null)
  const [p12InputKey, setP12InputKey] = useState(0)
  const [passphrase, setPassphrase] = useState('')
  const [signerName, setSignerName] = useState('')
  const [reason, setReason] = useState('Certified with Sheet')
  const [location, setLocation] = useState('')
  const [certifyLevel, setCertifyLevel] = useState('1')

  const maxUploadLabel = maxUploadBytes > 0 ? formatUploadLimit(maxUploadBytes) : 'the API limit'
  const qpdfMissing = apiState === 'ready' && qpdfVersion === null
  const apiOffline = apiState === 'offline'
  const restrictDisabled = apiOffline || qpdfMissing
  const pageLabel = pageCount === 1 ? '1 page' : `${pageCount} pages`

  useEffect(() => {
    let cancelled = false

    checkServerHealth().then((health) => {
      if (cancelled) return

      setMaxUploadBytes(health.maxUploadBytes)
      setQpdfVersion(health.qpdf ? health.qpdfVersion : null)

      if (!health.reachable) {
        setApiState('offline')
        return
      }

      setApiState('ready')
    })

    return () => {
      cancelled = true
    }
  }, [])

  const resetResult = () => {
    setResult(null)
    setProcessError(null)
  }

  const handleProcess = async () => {
    if (!file) return

    if (mode === 'restrict' && ownerPassword.length < MIN_OWNER_PASSWORD) {
      setProcessError(`Use an owner password with at least ${MIN_OWNER_PASSWORD} characters.`)
      return
    }

    if (mode === 'certify' && !p12File) {
      setProcessError('Choose a .p12 or .pfx certificate file.')
      return
    }

    setProcessing(true)
    setProcessError(null)
    setResult(null)

    try {
      if (mode === 'restrict') {
        const output = await protectPdfOnServer(
          file,
          { ownerPassword, print, copy, modify },
          maxUploadBytes || undefined,
        )
        setResult({ ...output, mode: 'restrict' })
      } else {
        const output = await certifyPdfOnServer(
          file,
          {
            p12: p12File as File,
            passphrase,
            name: signerName,
            reason,
            location,
            permission: certifyLevel === '2' ? 2 : 1,
          },
          maxUploadBytes || undefined,
        )
        setResult({ ...output, mode: 'certify' })
      }
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Protection failed. Try another PDF.')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!file || !result) return
    const suffix = result.mode === 'restrict' ? 'protected' : 'certified'
    downloadBlob(toPdfBlob(result.bytes), buildOutputName(file.name, suffix))
  }

  const handleClear = () => {
    clear()
    setResult(null)
    setProcessError(null)
    setOwnerPassword('')
    setP12File(null)
    setP12InputKey((value) => value + 1)
    setPassphrase('')
    setSignerName('')
    setReason('Certified with Sheet')
    setLocation('')
    setCertifyLevel('1')
    setError(null)
  }

  const handleModeChange = (next: Mode) => {
    setMode(next)
    resetResult()
  }

  return (
    <ToolLayout
      number="08"
      title="Protect PDF"
      description="Restrict editing with an owner password, or certify the document so any later change is cryptographically detectable."
      steps={[
        'Drop a PDF and choose how to protect it.',
        'Set an owner password, or load a signing certificate.',
        'Protect or certify the file, then download it.',
      ]}
      meta={[
        { label: 'Engine', value: 'qpdf / PKCS#7' },
        { label: 'Protection', value: 'Permissions / DocMDP' },
        { label: 'Runs', value: 'Local API' },
      ]}
      note="Permissions and certification run on the local API on this machine. Temp files are deleted after every request. A permissions password is viewer-enforced; certification detects edits rather than preventing them."
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to protect"
        hint={`Single file · up to ${maxUploadLabel} via the local API`}
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
              <span className="field-label">Protection mode</span>
              <SegmentedControl
                label="Protection mode"
                value={mode}
                onChange={handleModeChange}
                options={MODE_OPTIONS.map((option) => ({
                  ...option,
                  disabled: option.value === 'restrict' && restrictDisabled,
                }))}
                disabled={processing}
              />
            </div>

            <span className="selection-count" aria-live="polite">
              {pageLabel}
            </span>
          </div>

          {apiState === 'checking' && (
            <p className="api-status">
              <span className="status-dot is-waiting" aria-hidden="true" />
              Checking the local API…
            </p>
          )}

          {apiState === 'ready' && mode === 'restrict' && (
            <p className="api-status">
              <span className="status-dot" aria-hidden="true" />
              Local API ready{qpdfVersion ? ` · qpdf ${qpdfVersion}` : ''}
            </p>
          )}

          {apiState === 'ready' && mode === 'certify' && (
            <p className="api-status">
              <span className="status-dot" aria-hidden="true" />
              Local API ready · certification runs on this machine
            </p>
          )}

          {apiOffline && (
            <p className="alert alert-info">
              The local API is offline. Start it with <code>pnpm dev:api</code>, then reload this
              page. Both protection modes need it.
            </p>
          )}

          {mode === 'restrict' && (
            <>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="owner-password">Owner password</label>
                  <input
                    id="owner-password"
                    type="password"
                    value={ownerPassword}
                    onChange={(event) => {
                      setOwnerPassword(event.target.value)
                      resetResult()
                    }}
                    placeholder={`At least ${MIN_OWNER_PASSWORD} characters`}
                    autoComplete="new-password"
                    disabled={processing}
                  />
                  <span className="field-help">
                    The file opens without a password. This password is only needed to change or
                    remove the permissions.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="print-permission">Printing</label>
                  <select
                    id="print-permission"
                    value={print}
                    onChange={(event) => {
                      setPrint(event.target.value as PrintPermission)
                      resetResult()
                    }}
                    disabled={processing}
                  >
                    {PRINT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field-help">Acrobat-style printing permission.</span>
                </div>
              </div>

              <div className="field-wide">
                <div className="field">
                  <label htmlFor="modify-permission">Changes allowed</label>
                  <select
                    id="modify-permission"
                    value={modify}
                    onChange={(event) => {
                      setModify(event.target.value as ModifyPermission)
                      resetResult()
                    }}
                    disabled={processing}
                  >
                    {MODIFY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} — {option.hint}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="check-field">
                <input
                  type="checkbox"
                  checked={copy}
                  onChange={(event) => {
                    setCopy(event.target.checked)
                    resetResult()
                  }}
                  disabled={processing}
                />
                <span>
                  <strong>Allow copying text and images</strong>
                  <small>
                    When off, compliant viewers block text selection and graphic extraction. Text
                    extraction for screen readers stays enabled.
                  </small>
                </span>
              </label>

              {qpdfMissing && (
                <p className="alert alert-info">
                  The API is running, but qpdf was not found on <code>PATH</code>. Install it with{' '}
                  <code>sudo apt install qpdf</code> or <code>brew install qpdf</code>, then
                  restart the API. Certification mode works without qpdf.
                </p>
              )}

              <p className="alert alert-info">
                This is an honor-system restriction, not encryption you can rely on. The file opens
                without a password, and qpdf or an online unlocker can strip the flags. Use{' '}
                <strong>Flatten</strong> when the content itself must stop being editable.
              </p>
            </>
          )}

          {mode === 'certify' && (
            <>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="p12-file">Certificate (.p12 / .pfx)</label>
                  <input
                    id="p12-file"
                    key={p12InputKey}
                    type="file"
                    accept=".p12,.pfx,application/x-pkcs12"
                    onChange={(event) => {
                      setP12File(event.target.files?.[0] ?? null)
                      resetResult()
                    }}
                    disabled={processing}
                  />
                  <span className="field-help">
                    {p12File
                      ? `${p12File.name} · ${formatBytes(p12File.size)}`
                      : 'A PKCS#12 export containing the certificate and its private key.'}
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="p12-passphrase">Certificate passphrase</label>
                  <input
                    id="p12-passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value)
                      resetResult()
                    }}
                    placeholder="Passphrase for the certificate"
                    autoComplete="off"
                    disabled={processing}
                  />
                  <span className="field-help">Leave empty only if the certificate has no passphrase.</span>
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="signer-name">Signer name</label>
                  <input
                    id="signer-name"
                    type="text"
                    value={signerName}
                    onChange={(event) => {
                      setSignerName(event.target.value)
                      resetResult()
                    }}
                    placeholder="Shown in the signature panel"
                    disabled={processing}
                  />
                </div>

                <div className="field">
                  <label htmlFor="signer-location">Location</label>
                  <input
                    id="signer-location"
                    type="text"
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value)
                      resetResult()
                    }}
                    placeholder="Optional"
                    disabled={processing}
                  />
                </div>
              </div>

              <div className="field-wide">
                <div className="field">
                  <label htmlFor="signer-reason">Reason</label>
                  <input
                    id="signer-reason"
                    type="text"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      resetResult()
                    }}
                    disabled={processing}
                  />
                </div>
              </div>

              <div className="field-wide">
                <div className="field">
                  <label htmlFor="certify-level">Certification level</label>
                  <select
                    id="certify-level"
                    value={certifyLevel}
                    onChange={(event) => {
                      setCertifyLevel(event.target.value)
                      resetResult()
                    }}
                    disabled={processing}
                  >
                    {CERTIFY_LEVELS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field-help">
                    “No changes allowed” forbids every later edit. Forms and signatures is the
                    more practical level for documents that still need signing.
                  </span>
                </div>
              </div>

              <p className="alert alert-info">
                The certificate and passphrase go only to the local API. Signing must be the last
                step: any edit after certification breaks the signature. A recipient only sees a
                trusted identity if they trust the certificate that signed this file.
              </p>
            </>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleProcess}
              disabled={
                processing ||
                apiOffline ||
                (mode === 'restrict' && qpdfMissing)
              }
            >
              {processing
                ? mode === 'restrict'
                  ? 'Applying permissions…'
                  : 'Certifying…'
                : mode === 'restrict'
                  ? 'Apply permissions'
                  : 'Certify PDF'}
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
              <span className="stat-label">Output</span>
              <span className="stat-value">{formatBytes(result.outputSize)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Protection</span>
              <span className="stat-value stat-value-small">
                {result.mode === 'restrict' ? 'Permissions' : 'Certified'}
              </span>
            </div>
          </div>

          {result.mode === 'restrict' ? (
            <p className="hint">
              The PDF opens without a password. Keep the owner password safe: it is the only way
              to change these permissions from inside a PDF editor. The restrictions are removable
              with qpdf.
            </p>
          ) : (
            <p className="hint">
              The signature covers the current bytes. Open the file in Acrobat, Preview, or another
              validator to see the signer and the certification level. Editing it afterwards will
              raise a warning.
            </p>
          )}

          <div className="btn-row">
            <DownloadButton
              onClick={handleDownload}
              label={result.mode === 'restrict' ? 'Download protected PDF' : 'Download certified PDF'}
            />
          </div>
        </>
      )}
    </ToolLayout>
  )
}
