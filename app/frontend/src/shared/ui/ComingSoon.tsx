// Honest placeholder for nav items whose screens are not built yet: no fake queue, prescriptions, cash or reports.
export const ComingSoon = ({ title }: { title: string }) => (
  <>
    <div className="page-head"><h1 className="shell-dup-title">{title}</h1></div>
    <div className="card state-card muted">Segera hadir</div>
  </>
)
