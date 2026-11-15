// Lazy Tesseract.js loader. Worker + wasm + traineddata are same-origin under /tesseract (no CDN).
// The raw OCR text stays in this module’s return value for the parser; the form must not send or log it.
import type { OcrFlag, KtpDraft, WordConf } from './parseKtp'
import { parseKtpText } from './parseKtp'
import { cardCrop, fileToKtpCanvas } from './preprocess'

const TESS = '/tesseract'

export type KtpOcrResult = { draft: KtpDraft; flags: OcrFlag[] }

type WorkerLike = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string; words?: { text: string; confidence: number }[] } }>
  setParameters: (p: Record<string, string | number>) => Promise<void>
  terminate: () => Promise<void>
}

let workerPromise: Promise<WorkerLike> | null = null

async function worker(): Promise<WorkerLike> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js')
      const w = await createWorker(['ind', 'eng'], 1, {
        workerPath: `${TESS}/worker.min.js`,
        corePath: `${TESS}/tesseract-core-simd-lstm.wasm.js`,
        langPath: TESS,
        gzip: true,
        workerBlobURL: false,
        logger: () => {}, // never log text or payload
        errorHandler: () => {},
      })
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      return w as unknown as WorkerLike
    })().catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

/** Preprocess + OCR in a Web Worker + parse. Image never leaves the browser. */
export async function runKtpOcr(file: File, onProgress?: (p: number) => void): Promise<KtpOcrResult> {
  onProgress?.(0.05)
  const bmp = await createImageBitmap(file)
  const crop = cardCrop(bmp.width, bmp.height)
  bmp.close()
  const canvas = await fileToKtpCanvas(file, crop)
  onProgress?.(0.15)
  const w = await worker()
  onProgress?.(0.2)
  const { data } = await w.recognize(canvas)
  onProgress?.(0.9)
  const words: WordConf[] = (data.words ?? []).map((x) => ({ text: x.text, confidence: x.confidence }))
  const result = parseKtpText(data.text ?? '', words)
  onProgress?.(1)
  return result
}

export function discardOcrWorker() {
  const p = workerPromise
  workerPromise = null
  void p?.then((w) => w.terminate(), () => undefined)
}
