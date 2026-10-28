import { useRef, useState } from 'react'
import { formatBytes } from '../lib/pdf/load'
import Icon from './Icon'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  label?: string
  hint?: string
  files?: File[]
  onRemove?: (index: number) => void
  disabled?: boolean
}

export default function DropZone({
  onFiles,
  multiple = false,
  label = 'Drop a PDF here',
  hint = 'PDF files only',
  files = [],
  onRemove,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(false)

  const handleFiles = (list: FileList | null) => {
    if (!list || disabled) return
    onFiles(Array.from(list))
  }

  return (
    <div>
      <div
        className={`dropzone${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setActive(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setActive(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setActive(false)
          if (!disabled) handleFiles(event.dataTransfer.files)
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!disabled) inputRef.current?.click()
          }
        }}
      >
        <span className="dropzone-icon" aria-hidden="true">
          <Icon name="upload" size={30} />
        </span>
        <p className="dropzone-title">{label}</p>
        <p className="dropzone-hint">{hint}</p>
        <span className="dropzone-action">Browse files</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}-${file.size}`} className="file-item">
              <span className="file-icon" aria-hidden="true">
                <Icon name="file" size={18} />
              </span>
              <span className="file-item-name">{file.name}</span>
              <span className="file-item-meta">{formatBytes(file.size)}</span>
              {onRemove && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
