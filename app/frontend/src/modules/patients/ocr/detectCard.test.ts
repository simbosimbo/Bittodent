import { expect, test } from 'vitest'
import { CARD_RATIO, cardCropsFromRgba, isKtpBlue, pickFrontCard } from './detectCard'

function page(w: number, h: number) {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255 }
  const fill = (x: number, y: number, cw: number, ch: number, rgb: [number, number, number]) => {
    for (let yy = y; yy < y + ch; yy++) {
      for (let xx = x; xx < x + cw; xx++) {
        const i = (yy * w + xx) * 4
        rgba[i] = rgb[0]; rgba[i + 1] = rgb[1]; rgba[i + 2] = rgb[2]
      }
    }
  }
  return { w, h, rgba, fill }
}

test('isKtpBlue accepts teal card pixels and rejects white/photo-like red', () => {
  expect(isKtpBlue(100, 160, 200)).toBe(true)
  expect(isKtpBlue(255, 255, 255)).toBe(false)
  expect(isKtpBlue(30, 40, 180)).toBe(true)
})

test('picks the front card (ID-1, photo on the right) on a two-sided page, not the back', () => {
  const { w, h, rgba, fill } = page(768, 1024)
  // Front: ID-1-ish teal rectangle in the upper half, with a contrasting photo on the right.
  fill(150, 180, 470, 300, [110, 170, 210])
  fill(500, 240, 100, 140, [40, 70, 180]) // photo
  // Back: lower teal band, no photo, slightly off aspect after partial fill.
  fill(150, 540, 470, 280, [90, 160, 200])
  const crops = cardCropsFromRgba(w, h, rgba)
  expect(crops.length).toBeGreaterThanOrEqual(1)
  const front = pickFrontCard(crops, w, h, rgba)
  expect(front).toBeTruthy()
  expect(front!.y).toBeLessThan(400)
  expect(front!.y + front!.h).toBeLessThan(540)
  // Must not be a centered crop that swallows both cards (old bug).
  expect(front!.h).toBeLessThan(h * 0.55)
  expect(Math.abs(front!.w / front!.h - CARD_RATIO)).toBeLessThan(0.6)
})

test('splits a two-sided page when a thin blue strip fuses the front and back', () => {
  const { w, h, rgba, fill } = page(768, 1024)
  fill(154, 175, 469, 277, [110, 170, 210])
  fill(500, 230, 100, 140, [40, 70, 180]) // photo on the front
  fill(154, 454, 470, 66, [100, 160, 200]) // thin connector
  fill(155, 531, 470, 164, [90, 160, 200])
  const crops = cardCropsFromRgba(w, h, rgba)
  const front = pickFrontCard(crops, w, h, rgba)
  expect(front).toBeTruthy()
  expect(front!.y).toBeLessThan(200)
  expect(front!.y + front!.h).toBeLessThan(470)
  expect(front!.h).toBeLessThan(360)
})
