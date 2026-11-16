import type { Symbol } from './taxonomy'

// Official black-and-white symbols (Panduan Rekam Medis Kedokteran Gigi, Kemenkes + PDGI 2015; board OVv2-04), drawn in a size x size box.
// Whole-tooth / span symbols are glyphs over the tooth; surface symbols are fills of the surface polygon (see odontogram.css data-symbol).
// Status is a line shape, never a colour: rencana = dashed, no fill.
export function Glyph({ symbol, code, size = 44, planned = false }: { symbol: Symbol; code?: string | null; size?: number; planned?: boolean }) {
  const S = size, m = S / 2, w = Math.max(2, S / 14)
  const dash = planned ? `${w * 2} ${w * 1.5}` : undefined
  const line = { stroke: 'currentColor', strokeWidth: w, strokeDasharray: dash, fill: 'none' }
  const txt = (t: string) => <text x={m} y={m + S * 0.12} textAnchor="middle" fontSize={S * 0.32} fontWeight={700} fill="currentColor">{t}</text>
  switch (symbol) {
    case 'x': return <g {...line} strokeLinecap="square"><line x1={4} y1={4} x2={S - 4} y2={S - 4} /><line x1={S - 4} y1={4} x2={4} y2={S - 4} /></g>
    case 'x_code': return <g><g {...line}><line x1={4} y1={4} x2={S - 4} y2={S - 4} /><line x1={S - 4} y1={4} x2={4} y2={S - 4} /></g>{code && txt(code)}</g>
    case 'v': return <path d={`M6 ${S * 0.3} L${m} ${S - 6} L${S - 6} ${S * 0.3}`} {...line} strokeLinejoin="round" />
    case 'root_open': return <path d={`M${m - S * 0.22} ${S * 0.25} L${m} ${S - 5} L${m + S * 0.22} ${S * 0.25} Z`} {...line} />
    case 'root_fill': return <path d={`M${m - S * 0.22} ${S * 0.25} L${m} ${S - 5} L${m + S * 0.22} ${S * 0.25} Z`} {...line} fill={planned ? 'none' : 'currentColor'} />
    case 'frame': return <rect x={-3} y={-3} width={S + 6} height={S + 6} rx={6} {...line} strokeWidth={w * 1.6} />
    case 'frame_hatch': return <g><rect x={-3} y={-3} width={S + 6} height={S + 6} rx={6} {...line} strokeWidth={w * 1.6} />
      {!planned && <rect x={2} y={2} width={S - 4} height={S - 4} fill="url(#odo-hatch)" />}</g>
    case 'frame_code': return <g><rect x={-3} y={-3} width={S + 6} height={S + 6} rx={6} {...line} strokeWidth={w * 1.6} />{txt(code ?? '')}</g>
    case 'bar': return <line x1={-6} y1={-7} x2={S + 6} y2={-7} {...line} strokeWidth={w * 1.6} />
    case 'bar_frame': return <g><line x1={-6} y1={-7} x2={S + 6} y2={-7} {...line} strokeWidth={w * 1.6} />
      <rect x={-3} y={-3} width={S + 6} height={S + 6} rx={6} {...line} strokeWidth={w * 1.4} /></g>
    case 'arrow': return <g {...line}><line x1={8} y1={m} x2={S - 8} y2={m} /><path d={`M${S - 16} ${m - 7} L${S - 8} ${m} L${S - 16} ${m + 7}`} /></g>
    case 'text': return code ? txt(code) : null
    case 'hash': return txt('#')
    default: return null
  }
}

/** 28px card icon: a tooth square with the symbol (surface symbols fill the centre surface). */
export function SymbolIcon({ symbol, code, size = 28, planned = false }: { symbol: Symbol; code?: string | null; size?: number; planned?: boolean }) {
  const surface = ['outline', 'fill', 'hatch', 'crosshatch'].includes(symbol)
  const k = size * 0.28
  return (
    <svg className="sym-icon" width={size} height={size} viewBox={`-4 -9 ${size + 8} ${size + 13}`} aria-hidden="true">
      <rect x={0} y={0} width={size} height={size} rx={3} fill="none" stroke="currentColor" strokeWidth={1.2} />
      {surface && <rect x={k} y={k} width={size - 2 * k} height={size - 2 * k} className="sym-surface" data-symbol={symbol} data-planned={planned || undefined} />}
      {!surface && <Glyph symbol={symbol} code={code} size={size} planned={planned} />}
    </svg>
  )
}

/** Shared SVG defs (hatch for sewarna gigi, crosshatch for sealant). Render once inside every <svg> that uses them. */
export const SymbolDefs = () => (
  <defs>
    <pattern id="odo-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.4" /></pattern>
    <pattern id="odo-cross" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5M0 0H5" stroke="currentColor" strokeWidth="1.2" /></pattern>
  </defs>
)
