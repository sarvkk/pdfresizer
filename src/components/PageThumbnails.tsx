import { useState } from 'react'
import Icon from './Icon'

interface PageThumbnailsProps {
  pageCount: number
  selected?: number[]
  onToggle?: (page: number) => void
  draggable?: boolean
  order?: number[]
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export default function PageThumbnails({
  pageCount,
  selected = [],
  onToggle,
  draggable = false,
  order,
  onReorder,
}: PageThumbnailsProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const pages = order ?? Array.from({ length: pageCount }, (_, i) => i + 1)

  return (
    <div className="page-grid">
      {pages.map((pageNum, index) => {
        const isSelected = selected.includes(pageNum)
        const isDragging = dragIndex === index
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index
        const canMove = draggable && Boolean(onReorder)

        return (
          <div
            key={`page-${pageNum}-${index}`}
            className={[
              'page-card',
              isSelected ? 'is-selected' : '',
              canMove ? 'is-draggable' : '',
              isDragging ? 'is-dragging' : '',
              isOver ? 'is-over' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable={canMove}
            onClick={() => onToggle?.(pageNum)}
            onDragStart={(event) => {
              if (!canMove) return
              setDragIndex(index)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', String(index))
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            onDragOver={(event) => {
              if (!canMove) return
              event.preventDefault()
              setOverIndex(index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragIndex !== null && dragIndex !== index) {
                onReorder?.(dragIndex, index)
              }
              setDragIndex(null)
              setOverIndex(null)
            }}
            role={onToggle ? 'button' : undefined}
            tabIndex={onToggle || canMove ? 0 : undefined}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && onToggle) {
                event.preventDefault()
                onToggle(pageNum)
                return
              }

              if (
                canMove &&
                event.altKey &&
                (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
              ) {
                event.preventDefault()
                const next = index + (event.key === 'ArrowRight' ? 1 : -1)
                if (next >= 0 && next < pages.length) onReorder?.(index, next)
              }
            }}
            aria-pressed={onToggle ? isSelected : undefined}
            aria-label={
              canMove
                ? `Page ${pageNum}, position ${index + 1} of ${pages.length}. Use Alt plus arrow keys to move.`
                : `Page ${pageNum}${isSelected ? ', selected' : ''}`
            }
          >
            {isSelected && (
              <span className="page-check" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            )}
            {canMove && (
              <span className="page-drag-handle" aria-hidden="true">
                <Icon name="reorder" size={13} />
              </span>
            )}
            <span className="page-num">{pageNum}</span>
            <span className="page-label">Page</span>
          </div>
        )
      })}
    </div>
  )
}
