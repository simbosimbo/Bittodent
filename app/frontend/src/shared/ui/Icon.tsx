export const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

export const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  calendar: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  tooth: 'M8 3c-2.5 0-4 2-4 4.5 0 3 1 5.5 2 9 .5 2 1 4.5 2.5 4.5S10 19 10.5 17c.4-1.5.8-2.5 1.5-2.5s1.1 1 1.5 2.5c.5 2 1 4 2.5 4s2-2.5 2.5-4.5c1-3.5 2-6 2-9C20.5 5 19 3 16.5 3c-1.8 0-2.8 1-4.5 1S9.8 3 8 3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
}
