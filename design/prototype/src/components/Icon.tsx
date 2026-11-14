// Ikon garis sederhana buatan sendiri (24x24, stroke).
const P: Record<string, string> = {
  jadwal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  keluarga: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 11a2.5 2.5 0 1 0 0-5M21 20c0-2.6-1.6-4.8-4-5.6',
  tagihan: 'M4 7h16v12H4zM4 7l2-3h12l2 3M15 13h2',
  rencana: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M8 12h8M8 16h5',
  charting: 'M8 3c-2.5 0-4 2-4 4.5 0 3 1.2 5 2 8 .6 2.3 1 5.5 2.5 5.5s1.6-3 2.2-5c.3-1 .6-1.5 1.3-1.5s1 .5 1.3 1.5c.6 2 .7 5 2.2 5S18.4 18.3 19 16c.8-3 2-5 2-8.5C21 5 19.5 3 17 3c-2 0-3 1.2-4.5 1.2S10 3 8 3z',
  gambar: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1.5 1.5 0 1 0 0-.01',
  kelola: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2-1.3 1.3L4 8l-1 3 2 1v0l-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z',
  desain: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5S13 18 13 17s.8-1.5 1.5-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3zM7.5 12a1 1 0 1 0 0-.01M10 7.5a1 1 0 1 0 0-.01M15 7.5a1 1 0 1 0 0-.01',
  alur: 'M5 6a2 2 0 1 0 0-.01M5 8v8M5 18a2 2 0 1 0 0-.01M7 6h6a4 4 0 0 1 4 4v6M19 18a2 2 0 1 0 0-.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  x: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.3 7.3C3.6 9 2 12 2 12s3.5 6 10 6c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  check: 'M5 12l5 5L20 7',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M19 13a10 10 0 0 0-2.3-1.6M2 9a15 15 0 0 1 4.5-2.8M12 20v.01M22 9a15 15 0 0 0-11-3.9',
  plus: 'M12 5v14M5 12h14',
  print: 'M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z',
  chat: 'M4 5h16v11H9l-5 4zM8 10h8M8 13h5',
  grip: 'M9 6v.01M15 6v.01M9 12v.01M15 12v.01M9 18v.01M15 18v.01',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0',
  help: 'M9.1 9a3 3 0 1 1 4.2 2.7C12.5 12.5 12 13 12 14.2M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
}

export type IconName = keyof typeof P
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
