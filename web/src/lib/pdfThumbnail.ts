import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

const cache = new Map<string, Promise<string | null>>()

/**
 * Renders page 1 of a PDF (by URL) to a PNG data URL for use as an <img src>.
 * Cached per URL for the life of the page — receipts don't change once
 * uploaded, so there's no need to re-render on every re-render/remount.
 */
export function getPdfThumbnail(url: string, maxWidth = 300): Promise<string | null> {
  let cached = cache.get(url)
  if (!cached) {
    cached = renderPdfThumbnail(url, maxWidth)
    cache.set(url, cached)
  }
  return cached
}

async function renderPdfThumbnail(
  url: string,
  maxWidth: number,
): Promise<string | null> {
  try {
    const pdf = await getDocument({ url }).promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxWidth / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch (e) {
    console.error('PDF thumbnail render failed', e)
    return null
  }
}
