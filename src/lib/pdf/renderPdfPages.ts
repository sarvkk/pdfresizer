import { GlobalWorkerOptions, PasswordException, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { computeRenderGeometry, type FlattenProgress, type RenderedPage } from './flatten'

GlobalWorkerOptions.workerSrc = workerUrl

interface RenderPdfOptions {
  dpi: number
  jpegQuality: number
  onProgress?: (progress: FlattenProgress) => void
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode a page as an image.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

export async function renderPdfPages(
  data: Uint8Array,
  { dpi, jpegQuality, onProgress }: RenderPdfOptions,
): Promise<RenderedPage[]> {
  const loadingTask = getDocument({ data })

  let pdf
  try {
    pdf = await loadingTask.promise
  } catch (err) {
    await loadingTask.destroy().catch(() => undefined)
    if (err instanceof PasswordException) {
      throw new Error('This PDF is password-protected. Unlock it first, then flatten it.')
    }
    throw new Error('This PDF could not be opened for flattening.')
  }

  try {
    const pages: RenderedPage[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const geometry = computeRenderGeometry(base.width, base.height, dpi)
      const viewport = page.getViewport({ scale: geometry.scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas rendering is not available in this browser.')
      }

      // PDF pages are transparent by default. Paint white so the JPEG does not
      // turn black where the page has no background.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      try {
        await page.render({ canvas, viewport }).promise
        const blob = await canvasToJpeg(canvas, jpegQuality)
        pages.push({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          width: base.width,
          height: base.height,
        })
      } finally {
        page.cleanup()
        canvas.width = 0
        canvas.height = 0
      }

      onProgress?.({ done: pageNumber, total: pdf.numPages })
    }

    return pages
  } finally {
    await loadingTask.destroy()
  }
}
