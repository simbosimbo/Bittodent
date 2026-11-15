// Browser-only: grayscale, contrast, resize. Optional crop-to-card (ISO ID-1 1.5858).
export { CARD_RATIO, type Crop } from './detectCard'
import { CARD_RATIO, type Crop, detectFrontCard as detectFromRgba } from './detectCard'

/** Centered ISO ID-1 crop covering as much of the image as possible. */
export function cardCrop(w: number, h: number): Crop {
  if (w / h > CARD_RATIO) {
    const cw = h * CARD_RATIO
    return { x: (w - cw) / 2, y: 0, w: cw, h }
  }
  const ch = w / CARD_RATIO
  return { x: 0, y: (h - ch) / 2, w, h: ch }
}

export async function fileToKtpCanvas(file: File, crop?: Crop, longEdge = 1800): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const src = crop ?? { x: 0, y: 0, w: bmp.width, h: bmp.height }
  const scale = longEdge / Math.max(src.w, src.h)
  const w = Math.max(1, Math.round(src.w * (src.w < longEdge ? Math.max(scale, 1) : scale)))
  const h = Math.max(1, Math.round(src.h * (w / src.w)))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, src.x, src.y, src.w, src.h, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const contrast = 1.4
  const intercept = 128 * (1 - contrast)
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    const v = Math.max(0, Math.min(255, y * contrast + intercept))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  bmp.close()
  return c
}


/** Front e-KTP on a scanned page (two-sided scans included). Falls back to a centered ID-1 crop. */
export function frontCardCrop(img: ImageData): Crop {
  return detectFromRgba(img.width, img.height, img.data) ?? cardCrop(img.width, img.height)
}
