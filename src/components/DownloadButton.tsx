import Icon from './Icon'

interface DownloadButtonProps {
  onClick: () => void
  disabled?: boolean
  label?: string
}

export default function DownloadButton({
  onClick,
  disabled = false,
  label = 'Download PDF',
}: DownloadButtonProps) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick} disabled={disabled}>
      <Icon name="download" size={17} />
      {label}
    </button>
  )
}
