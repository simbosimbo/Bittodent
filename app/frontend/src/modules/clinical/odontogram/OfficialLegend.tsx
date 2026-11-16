import { SymbolDefs, SymbolIcon } from './symbols'
import { conditionsIn, TAXONOMY, type ConditionGroup } from './taxonomy'

// Board OVv2-04: official symbols (Kemenkes + PDGI 2015), black and white; status as line shape, never colour.
const GROUPS: [ConditionGroup, string][] = [['surface', 'Permukaan'], ['tooth', 'Seluruh gigi'], ['span', 'Rentang dan protesa'], ['implant', 'Implan']]
const MARK: Record<string, string> = { solid: 'garis utuh', solid_badge_L: 'garis utuh + L', dashed: 'garis putus, tanpa isi', solid_check: 'garis utuh + ✓' }

export function OfficialLegend() {
  return (
    <div className="odo-official" aria-label="Legenda simbol resmi (PDGI 2015)">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><SymbolDefs /></svg>
      <ul className="odo-legend" aria-label="Status">
        {TAXONOMY.statuses.map((s) => <li key={s.key}><strong>{s.label}</strong> <span className="muted small">{MARK[s.mark]}</span></li>)}
      </ul>
      {GROUPS.map(([g, label]) => (
        <details key={g} open={g === 'surface'}>
          <summary>{label}</summary>
          <ul className="odo-legend">
            {conditionsIn(g).filter((c) => c.key !== 'sehat').map((c) => (
              <li key={c.key}><SymbolIcon symbol={c.symbol} code={c.code} /> {c.label} <code>{c.code ?? 'panah'}</code></li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}
