import type { Record3 } from './Odontogram3D'

// Test-only stand-in for public/odontogram-3d/tooth3d.js + manifest.json (synthetic, never loads the real renders).
const view = (anchors: Record<string, number[]>, h: number) => ({ h, cejY: 0.6, mask: 'masks/m.webp', anchors })
export const manifest = {
  models: {
    m: {
      crownWidthPx: 40,
      buccal: view({ M: [0.8, 0.7, 0.03], D: [0.2, 0.7, 0.03], O: [0.5, 0.9, 0.05], B: [0.5, 0.7, 0.16], L: [0.5, 0.5, 0.0016] }, 160),
      occlusal: view({ M: [0.85, 0.5, 0.05], D: [0.15, 0.5, 0.05], O: [0.5, 0.5, 0.2], B: [0.5, 0.15, 0.08], L: [0.5, 0.85, 0.08] }, 72),
    },
  },
}

export function mockView(record: Record3, v: string) {
  const c = document.createElement('div')
  c.className = 't3'
  c.dataset.tooth = String(record.tooth)
  c.dataset.view = v
  c.setAttribute('role', 'img')
  const whole = record.layers.find((l) => !l.surfaces)
  if (whole) c.dataset.condition = whole.condition
  if (record.baseline) c.dataset.baseline = record.baseline
  const box = document.createElement('div')
  box.className = 't3-box'
  Object.assign(box.style, { width: '40px', height: `${v === 'buccal' ? 160 : 72}px` })
  for (const l of record.layers) for (const s of l.surfaces ?? []) {
    const d = document.createElement('div')
    d.className = 't3-layer'
    Object.assign(d.dataset, { condition: l.condition, status: l.status, surface: s })
    box.appendChild(d)
  }
  c.appendChild(box)
  return c
}

export const mockTooth3D = { view: mockView, info: (t: number) => ({ model: 'm', scale: 1, upper: [1, 2, 5, 6].includes(Math.floor(t / 10)) }) }
