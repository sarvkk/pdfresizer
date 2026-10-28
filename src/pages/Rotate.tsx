import { useState } from 'react'
import DownloadButton from '../components/DownloadButton'
import DropZone from '../components/DropZone'
import PageThumbnails from '../components/PageThumbnails'
import SegmentedControl from '../components/SegmentedControl'
import ToolLayout from '../components/ToolLayout'
import { usePdfFile } from '../hooks/usePdfFile'
import { rotatePages, type RotationAngle } from '../lib/pdf/rotate'
import { buildOutputName, downloadBlob, toPdfBlob } from '../lib/pdf/load'

const ANGLE_OPTIONS = [
  { value: '90' as const, label: '90°' },
  { value: '180' as const, label: '180°' },
  { value: '270' as const, label: '270°' },
]

export default function Rotate() {
  const { file, pageCount, loading, error, loadFile, clear, setError } = usePdfFile()
  const [selected, setSelected] = useState<number[]>([])
  const [angle, setAngle] = useState<RotationAngle>(90)
  const [processing, setProcessing] = useState(false)

  const togglePage = (page: number) => {
    setSelected((prev) =>
      prev.includes(page) ? prev.filter((pageNumber) => pageNumber !== page) : [...prev, page].sort((a, b) => a - b),
    )
  }

  const selectAll = () => {
    setSelected(Array.from({ length: pageCount }, (_, index) => index + 1))
  }

  const handleRotate = async () => {
    if (!file) return
    if (selected.length === 0) {
      setError('Select at least one page to rotate.')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const bytes = await rotatePages(file, selected, angle)
      downloadBlob(toPdfBlob(bytes), buildOutputName(file.name, 'rotated'))
    } catch {
      setError('Rotation failed. Try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleClear = () => {
    clear()
    setSelected([])
  }

  return (
    <ToolLayout
      number="05"
      title="Rotate PDF"
      description="Turn individual pages or the whole document clockwise. Rotations stack, so you can run the tool again if a page needs another quarter turn."
      steps={[
        'Drop a PDF and check the page grid.',
        'Select pages and choose 90°, 180°, or 270°.',
        'Rotate and download the updated document.',
      ]}
      meta={[
        { label: 'Pages', value: 'Any selection' },
        { label: 'Direction', value: 'Clockwise' },
        { label: 'Runs', value: 'On-device' },
      ]}
    >
      <DropZone
        onFiles={(files) => {
          handleClear()
          if (files[0]) loadFile(files[0])
        }}
        label="Drop a PDF to rotate"
        hint="Single file · rotations stack if you run it again"
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
              <span className="field-label">Rotation</span>
              <SegmentedControl
                label="Rotation angle"
                value={String(angle) as '90' | '180' | '270'}
                onChange={(next) => setAngle(Number(next) as RotationAngle)}
                options={ANGLE_OPTIONS}
                disabled={processing}
              />
            </div>

            <span className="selection-count" aria-live="polite">
              {selected.length} of {pageCount} selected
            </span>
          </div>

          <div className="btn-row btn-row-tight">
            <button type="button" className="btn btn-small btn-secondary" onClick={selectAll}>
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

          <PageThumbnails pageCount={pageCount} selected={selected} onToggle={togglePage} />

          <div className="btn-row">
            <DownloadButton
              onClick={handleRotate}
              disabled={processing}
              label={processing ? 'Rotating…' : 'Rotate & download'}
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
