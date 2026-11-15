/** Reserved-height loading placeholders. Visible "Memuat…" stays for screen readers and existing tests. */
export function PageSkeleton({ label = 'Memuat…', variant = 'page' }: { label?: string; variant?: 'page' | 'home' | 'list' | 'record' | 'invoice' | 'schedule' | 'app' }) {
  if (variant === 'app') {
    return (
      <div className="app-shell sk-app" role="status" aria-label={label}>
        <span className="sr-only">{label}</span>
        <aside className="shell-side" aria-hidden="true">
          <div className="sk sk-brand" />
          <div className="sk sk-block sk-clinic" />
          <div className="sk sk-line" />
          <div className="sk sk-line" />
          <div className="sk sk-line w2" />
        </aside>
        <div className="shell-col">
          <div className="sk-topbar" />
          <main className="shell-main"><Body /></main>
        </div>
      </div>
    )
  }
  return (
    <div className={`sk-page sk-${variant}`} role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{variant === 'home' ? <Home /> : variant === 'list' ? <List /> : variant === 'record' ? <Record /> : variant === 'invoice' ? <Invoice /> : variant === 'schedule' ? <Schedule /> : <Body />}</div>
    </div>
  )
}

function Home() {
  return (
    <div className="sk-row">
      <div className="sk-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-kpi" />)}</div>
      <div className="sk sk-title" />
      <div className="sk sk-block sk-board" />
    </div>
  )
}
function List() {
  return (
    <div className="sk-row">
      <div className="sk sk-line sk-search" />
      <div className="sk sk-line w2" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-rowline" />)}
    </div>
  )
}
function Record() {
  return (
    <div className="sk-row">
      <div className="sk-head">
        <div className="sk sk-avatar" />
        <div className="sk-col">
          <div className="sk sk-title" />
          <div className="sk sk-line w2" />
        </div>
      </div>
      <div className="sk sk-block sk-board" />
    </div>
  )
}
function Invoice() {
  return (
    <div className="sk-row">
      <div className="sk sk-title" />
      <div className="sk sk-line w2" />
      <div className="sk sk-block" />
      <div className="sk sk-block" />
    </div>
  )
}
function Schedule() {
  return (
    <div className="sk-row">
      <div className="sk sk-line sk-search" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-rowline" />)}
    </div>
  )
}
function Body() {
  return (
    <div className="sk-row">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line w2" />
      <div className="sk sk-block" />
    </div>
  )
}
